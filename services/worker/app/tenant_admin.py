from __future__ import annotations

import asyncio
import os
import re
from datetime import UTC, datetime, timedelta
from typing import Annotated, Literal
from urllib.parse import urlparse
from uuid import UUID

import httpx
from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field
from supabase import create_client
from supabase.lib.client_options import ClientOptions

from .repository import RepositoryConfigurationError

router = APIRouter(prefix="/v1/admin", tags=["tenant-admin"])

_EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")


class TenantAdminError(RuntimeError):
    pass


class OrganizationInviteRequest(BaseModel):
    actor_user_id: UUID
    organization_id: UUID
    email: str = Field(min_length=3, max_length=320)
    role: Literal["admin", "member", "viewer"] = "member"
    redirect_to: str | None = Field(default=None, max_length=1000)


class OrganizationInviteResponse(BaseModel):
    invitation_id: UUID
    organization_id: UUID
    email: str
    role: Literal["admin", "member", "viewer"]
    status: str
    email_delivery: str
    expires_at: datetime


def _require_worker_token(x_worker_token: str | None) -> None:
    expected = os.getenv("WORKER_INTERNAL_TOKEN")
    if expected and x_worker_token != expected:
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

    async def _pending_invitation(
        self, *, organization_id: UUID, email: str
    ) -> dict[str, object] | None:
        rows = await self._request(
            "GET",
            "/rest/v1/organization_invitations"
            f"?organization_id=eq.{organization_id}"
            f"&email=eq.{email}"
            "&status=eq.pending&select=id,organization_id,email,role,status,expires_at&limit=1",
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
    ) -> dict[str, object]:
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
                    "invited_by": str(actor_user_id),
                    "invited_at": now.isoformat(),
                    "expires_at": expires_at.isoformat(),
                    "updated_at": now.isoformat(),
                },
                prefer="return=representation",
            )
        else:
            result = await self._request(
                "POST",
                "/rest/v1/organization_invitations",
                json={
                    "organization_id": str(organization_id),
                    "email": email,
                    "role": role,
                    "status": "pending",
                    "invited_by": str(actor_user_id),
                    "invited_at": now.isoformat(),
                    "expires_at": expires_at.isoformat(),
                },
                prefer="return=representation",
            )
        if not isinstance(result, list) or len(result) != 1:
            raise TenantAdminError("Invitation persistence returned an invalid payload.")
        return result[0]

    async def _revoke_invitation(self, invitation_id: str) -> None:
        now = datetime.now(UTC).isoformat()
        try:
            await self._request(
                "PATCH",
                f"/rest/v1/organization_invitations?id=eq.{invitation_id}",
                json={"status": "revoked", "revoked_at": now, "updated_at": now},
                prefer="return=minimal",
            )
        except TenantAdminError:
            # Preserve the original Auth delivery error for callers. A stale
            # pending invitation is harmless because claim is email-matched and
            # time-bounded, and can be revoked on the next admin retry.
            pass

    async def _send_auth_invite(self, *, email: str, redirect_to: str | None) -> None:
        options = ClientOptions(auto_refresh_token=False, persist_session=False)
        client = create_client(self.base_url, self.key, options=options)
        invite_options = {"redirect_to": redirect_to} if redirect_to else None

        def send() -> None:
            if invite_options:
                client.auth.admin.invite_user_by_email(email, invite_options)
            else:
                client.auth.admin.invite_user_by_email(email)

        await asyncio.to_thread(send)

    async def invite_member(
        self,
        *,
        actor_user_id: UUID,
        organization_id: UUID,
        email: str,
        role: Literal["admin", "member", "viewer"],
        redirect_to: str | None,
    ) -> dict[str, object]:
        normalized_email = _normalize_email(email)
        safe_redirect = _validate_redirect(redirect_to)
        await self._assert_admin(
            actor_user_id=actor_user_id,
            organization_id=organization_id,
        )
        invitation = await self._store_invitation(
            actor_user_id=actor_user_id,
            organization_id=organization_id,
            email=normalized_email,
            role=role,
        )
        try:
            await self._send_auth_invite(
                email=normalized_email,
                redirect_to=safe_redirect,
            )
        except Exception as exc:  # Supabase Auth raises typed API errors across SDK releases.
            await self._revoke_invitation(str(invitation["id"]))
            raise TenantAdminError(f"Supabase Auth invitation delivery failed: {exc}") from exc

        return {
            **invitation,
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
        code = 403 if "admin role required" in detail.lower() else 503
        if "valid invitation email" in detail.lower() or "redirect" in detail.lower():
            code = 400
        raise HTTPException(status_code=code, detail=detail) from exc
