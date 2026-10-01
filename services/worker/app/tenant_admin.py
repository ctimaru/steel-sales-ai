from __future__ import annotations

import asyncio
import os
import re
from datetime import UTC, datetime, timedelta
from typing import Annotated, Literal
from urllib.parse import parse_qsl, urlencode, urlparse, urlsplit, urlunsplit
from uuid import UUID

import httpx
from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field
from supabase import create_client
from supabase.lib.client_options import ClientOptions

from .repository import RepositoryConfigurationError

router = APIRouter(prefix="/v1/admin", tags=["tenant-admin"])

_EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
BusinessRole = Literal["sales_director", "salesperson", "operations"]


class TenantAdminError(RuntimeError):
    pass


class OrganizationInviteRequest(BaseModel):
    actor_user_id: UUID
    organization_id: UUID
    email: str = Field(min_length=3, max_length=320)
    role: Literal["admin", "member", "viewer"] = "member"
    business_role: BusinessRole | None = None
    redirect_to: str | None = Field(default=None, max_length=1000)


class OrganizationInviteResponse(BaseModel):
    invitation_id: UUID
    organization_id: UUID
    email: str
    role: Literal["admin", "member", "viewer"]
    business_role: BusinessRole | None
    status: str
    email_delivery: str
    expires_at: datetime
    send_count: int


def _require_worker_token(x_worker_token: str | None) -> None:
    expected = os.getenv("WORKER_INTERNAL_TOKEN")
    if not expected:
        raise HTTPException(status_code=503, detail="Worker internal token is not configured.")
    if x_worker_token != expected:
        raise HTTPException(status_code=401, detail="Invalid worker token.")


def _normalize_email(email: str) -> str:
    normalized = email.strip().lower()
    if not _EMAIL_RE.match(normalized):
        raise TenantAdminError("A valid invitation email is required.")
    return normalized


def _validate_redirect(value: str | None) -> str | None:
    if not value:
        return None
    parsed = urlparse(value)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise TenantAdminError("Invitation redirect must be an absolute HTTP(S) URL.")
    if parsed.scheme == "http" and parsed.hostname not in {"localhost", "127.0.0.1"}:
        raise TenantAdminError("Non-local invitation redirects must use HTTPS.")
    return value


def _redirect_with_invitation(
    redirect_to: str | None,
    *,
    invitation_id: str,
    set_password: bool,
) -> str | None:
    if not redirect_to:
        return None
    parsed = urlsplit(redirect_to)
    query = dict(parse_qsl(parsed.query, keep_blank_values=True))
    query["invited"] = "1"
    query["invitation_id"] = invitation_id
    query["set_password"] = "1" if set_password else "0"
    return urlunsplit(
        (
            parsed.scheme,
            parsed.netloc,
            parsed.path,
            urlencode(query),
            parsed.fragment,
        )
    )


class TenantAdminService:
    def __init__(self) -> None:
        self.base_url = os.getenv("SUPABASE_URL", "").rstrip("/")
        self.key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
        if not self.base_url or not self.key:
            raise RepositoryConfigurationError(
                "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required."
            )
        self.headers = {
            "Authorization": f"Bearer {self.key}",
            "apikey": self.key,
            "Content-Type": "application/json",
        }

    async def _request(
        self,
        method: str,
        path: str,
        *,
        json: object | None = None,
        prefer: str | None = None,
    ) -> object:
        headers = dict(self.headers)
        if prefer:
            headers["Prefer"] = prefer
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.request(
                method,
                f"{self.base_url}{path}",
                headers=headers,
                json=json,
            )
        if response.is_error:
            detail = response.text.strip()
            raise TenantAdminError(
                f"Tenant administration persistence failed with HTTP {response.status_code}."
                + (f" {detail[:400]}" if detail else "")
            )
        if not response.content:
            return None
        return response.json()

    async def _assert_admin(self, *, actor_user_id: UUID, organization_id: UUID) -> None:
        rows = await self._request(
            "GET",
            "/rest/v1/organization_memberships"
            f"?organization_id=eq.{organization_id}"
            f"&user_id=eq.{actor_user_id}"
            "&status=eq.active&role=eq.admin&select=organization_id&limit=1",
        )
        if not isinstance(rows, list) or not rows:
            raise TenantAdminError("Organization admin role required.")

    async def _auth_identity(self, *, email: str) -> dict[str, object]:
        payload = await self._request(
            "POST",
            "/rest/v1/rpc/hp8_auth_user_lookup",
            json={"p_email": email},
        )
        if not isinstance(payload, dict):
            raise TenantAdminError("Auth identity lookup returned an invalid payload.")
        return payload

    async def _assert_not_active_member(
        self,
        *,
        organization_id: UUID,
        auth_identity: dict[str, object],
    ) -> None:
        user_id = auth_identity.get("user_id")
        if not user_id:
            return
        rows = await self._request(
            "GET",
            "/rest/v1/organization_memberships"
            f"?organization_id=eq.{organization_id}"
            f"&user_id=eq.{user_id}"
            "&status=eq.active&select=user_id&limit=1",
        )
        if not isinstance(rows, list):
            raise TenantAdminError("Organization membership lookup returned an invalid payload.")
        if rows:
            raise TenantAdminError("User already has active organization membership.")

    async def _pending_invitation(
        self, *, organization_id: UUID, email: str
    ) -> dict[str, object] | None:
        rows = await self._request(
            "GET",
            "/rest/v1/organization_invitations"
            f"?organization_id=eq.{organization_id}"
            f"&email=eq.{email}"
            "&status=eq.pending"
            "&select=id,organization_id,email,role,business_role,status,expires_at,send_count"
            "&limit=1",
        )
        if not isinstance(rows, list):
            raise TenantAdminError("Invitation lookup returned an invalid payload.")
        return rows[0] if rows else None

    async def _store_invitation(
        self,
        *,
        actor_user_id: UUID,
        organization_id: UUID,
        email: str,
        role: str,
        business_role: BusinessRole | None,
    ) -> tuple[dict[str, object], bool]:
        now = datetime.now(UTC)
        expires_at = now + timedelta(days=7)
        existing = await self._pending_invitation(
            organization_id=organization_id,
            email=email,
        )

        if existing:
            result = await self._request(
                "PATCH",
                f"/rest/v1/organization_invitations?id=eq.{existing['id']}",
                json={
                    "role": role,
                    "business_role": business_role,
                    "invited_by": str(actor_user_id),
                    "invited_at": now.isoformat(),
                    "expires_at": expires_at.isoformat(),
                    "delivery_status": "pending",
                    "last_delivery_error": None,
                    "updated_at": now.isoformat(),
                },
                prefer="return=representation",
            )
            was_existing = True
        else:
            result = await self._request(
                "POST",
                "/rest/v1/organization_invitations",
                json={
                    "organization_id": str(organization_id),
                    "email": email,
                    "role": role,
                    "business_role": business_role,
                    "status": "pending",
                    "invited_by": str(actor_user_id),
                    "invited_at": now.isoformat(),
                    "expires_at": expires_at.isoformat(),
                    "delivery_status": "pending",
                    "send_count": 0,
                },
                prefer="return=representation",
            )
            was_existing = False

        if not isinstance(result, list) or len(result) != 1:
            raise TenantAdminError("Invitation persistence returned an invalid payload.")
        return result[0], was_existing

    async def _record_delivery_success(
        self,
        *,
        invitation: dict[str, object],
        delivery_mode: Literal["invite", "magic_link"],
    ) -> dict[str, object]:
        now = datetime.now(UTC).isoformat()
        result = await self._request(
            "PATCH",
            f"/rest/v1/organization_invitations?id=eq.{invitation['id']}",
            json={
                "delivery_status": "sent",
                "delivery_mode": delivery_mode,
                "send_count": int(invitation.get("send_count") or 0) + 1,
                "last_sent_at": now,
                "last_delivery_error": None,
                "updated_at": now,
            },
            prefer="return=representation",
        )
        if not isinstance(result, list) or len(result) != 1:
            raise TenantAdminError("Invitation delivery persistence returned an invalid payload.")
        return result[0]

    async def _record_delivery_failure(
        self,
        *,
        invitation: dict[str, object],
        error: Exception,
        revoke: bool,
    ) -> None:
        now = datetime.now(UTC).isoformat()
        payload: dict[str, object] = {
            "delivery_status": "failed",
            "last_delivery_error": str(error)[:500],
            "updated_at": now,
        }
        if revoke:
            payload.update(
                {
                    "status": "revoked",
                    "revoked_at": now,
                }
            )
        try:
            await self._request(
                "PATCH",
                f"/rest/v1/organization_invitations?id=eq.{invitation['id']}",
                json=payload,
                prefer="return=minimal",
            )
        except TenantAdminError:
            pass

    def _auth_client(self):
        options = ClientOptions(auto_refresh_token=False, persist_session=False)
        return create_client(self.base_url, self.key, options=options)

    async def _send_auth_invite(
        self,
        *,
        email: str,
        redirect_to: str | None,
        existing_identity: bool,
    ) -> Literal["invite", "magic_link"]:
        client = self._auth_client()

        if existing_identity:
            def send_magic_link() -> None:
                client.auth.sign_in_with_otp(
                    {
                        "email": email,
                        "options": {
                            "should_create_user": False,
                            **(
                                {"email_redirect_to": redirect_to}
                                if redirect_to
                                else {}
                            ),
                        },
                    }
                )

            await asyncio.to_thread(send_magic_link)
            return "magic_link"

        invite_options = {"redirect_to": redirect_to} if redirect_to else None

        def send_invite() -> None:
            if invite_options:
                client.auth.admin.invite_user_by_email(email, invite_options)
            else:
                client.auth.admin.invite_user_by_email(email)

        await asyncio.to_thread(send_invite)
        return "invite"

    async def invite_member(
        self,
        *,
        actor_user_id: UUID,
        organization_id: UUID,
        email: str,
        role: Literal["admin", "member", "viewer"],
        business_role: BusinessRole | None,
        redirect_to: str | None,
    ) -> dict[str, object]:
        normalized_email = _normalize_email(email)
        safe_redirect = _validate_redirect(redirect_to)

        await self._assert_admin(
            actor_user_id=actor_user_id,
            organization_id=organization_id,
        )

        auth_identity = await self._auth_identity(email=normalized_email)
        await self._assert_not_active_member(
            organization_id=organization_id,
            auth_identity=auth_identity,
        )

        invitation, was_existing = await self._store_invitation(
            actor_user_id=actor_user_id,
            organization_id=organization_id,
            email=normalized_email,
            role=role,
            business_role=business_role,
        )

        existing_identity = auth_identity.get("exists") is True
        email_confirmed = auth_identity.get("email_confirmed") is True
        delivery_redirect = _redirect_with_invitation(
            safe_redirect,
            invitation_id=str(invitation["id"]),
            set_password=not existing_identity or not email_confirmed,
        )

        try:
            delivery_mode = await self._send_auth_invite(
                email=normalized_email,
                redirect_to=delivery_redirect,
                existing_identity=existing_identity,
            )
            invitation = await self._record_delivery_success(
                invitation=invitation,
                delivery_mode=delivery_mode,
            )
        except Exception as exc:
            await self._record_delivery_failure(
                invitation=invitation,
                error=exc,
                revoke=not was_existing,
            )
            raise TenantAdminError(f"Supabase Auth invitation delivery failed: {exc}") from exc

        return {
            **invitation,
            "invitation_id": invitation["id"],
            "email_delivery": "sent",
        }


@router.post(
    "/organization-invitations",
    response_model=OrganizationInviteResponse,
    status_code=201,
)
async def create_organization_invitation(
    request: OrganizationInviteRequest,
    x_worker_token: Annotated[str | None, Header()] = None,
) -> OrganizationInviteResponse:
    _require_worker_token(x_worker_token)
    try:
        result = await TenantAdminService().invite_member(**request.model_dump())
        return OrganizationInviteResponse(**result)
    except (RepositoryConfigurationError, TenantAdminError) as exc:
        detail = str(exc)
        normalized = detail.lower()
        if "admin role required" in normalized:
            code = 403
        elif "already has active organization membership" in normalized:
            code = 409
        elif "valid invitation email" in normalized or "redirect" in normalized:
            code = 400
        else:
            code = 503
        raise HTTPException(status_code=code, detail=detail) from exc
