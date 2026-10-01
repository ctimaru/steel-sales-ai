import os
from datetime import UTC, datetime, timedelta
from uuid import UUID

from fastapi.testclient import TestClient

os.environ["WORKER_STORAGE_MODE"] = "memory"

import app.tenant_admin as tenant_admin_module  # noqa: E402
from app.server import app  # noqa: E402
from app.tenant_admin import (  # noqa: E402
    TenantAdminError,
    _normalize_email,
    _redirect_with_invitation,
    _validate_redirect,
)

client = TestClient(app)


def test_invitation_input_normalization() -> None:
    assert _normalize_email("  SALES@Example.COM ") == "sales@example.com"
    assert _validate_redirect("https://www.smartsteelsales.com/auth/finish?invited=1") == (
        "https://www.smartsteelsales.com/auth/finish?invited=1"
    )
    assert _validate_redirect("http://localhost:3000/auth/finish") == (
        "http://localhost:3000/auth/finish"
    )


def test_invitation_redirect_is_bound_to_one_invitation() -> None:
    invitation_id = "00000000-0000-0000-0000-000000000301"
    target = _redirect_with_invitation(
        "https://www.smartsteelsales.com/auth/finish?invited=1",
        invitation_id=invitation_id,
        set_password=True,
    )
    assert target is not None
    assert "invited=1" in target
    assert f"invitation_id={invitation_id}" in target
    assert "set_password=1" in target

    existing_target = _redirect_with_invitation(
        "https://www.smartsteelsales.com/auth/finish",
        invitation_id=invitation_id,
        set_password=False,
    )
    assert existing_target is not None
    assert "set_password=0" in existing_target


def test_invitation_input_rejects_invalid_values() -> None:
    for value in ("not-an-email", "missing@domain"):
        try:
            _normalize_email(value)
        except TenantAdminError:
            pass
        else:
            raise AssertionError("invalid email was accepted")

    try:
        _validate_redirect("http://example.com/auth/finish")
    except TenantAdminError:
        pass
    else:
        raise AssertionError("insecure external redirect was accepted")


def test_internal_invitation_route(monkeypatch) -> None:
    actor = UUID("00000000-0000-0000-0000-000000000101")
    organization = UUID("00000000-0000-0000-0000-000000000201")
    invitation = UUID("00000000-0000-0000-0000-000000000301")
    expires_at = datetime.now(UTC) + timedelta(days=7)

    class FakeService:
        async def invite_member(self, **kwargs):
            assert kwargs["actor_user_id"] == actor
            assert kwargs["organization_id"] == organization
            assert kwargs["email"] == "member@example.com"
            assert kwargs["role"] == "viewer"
            assert kwargs["business_role"] == "salesperson"
            assert kwargs["redirect_to"].endswith("/auth/finish?invited=1")
            return {
                "id": str(invitation),
                "invitation_id": str(invitation),
                "organization_id": str(organization),
                "email": "member@example.com",
                "role": "viewer",
                "business_role": "salesperson",
                "status": "pending",
                "email_delivery": "sent",
                "expires_at": expires_at.isoformat(),
                "send_count": 1,
            }

    monkeypatch.setattr(tenant_admin_module, "TenantAdminService", FakeService)
    monkeypatch.setenv("WORKER_INTERNAL_TOKEN", "p1-test-token")
    response = client.post(
        "/v1/admin/organization-invitations",
        headers={"x-worker-token": "p1-test-token"},
        json={
            "actor_user_id": str(actor),
            "organization_id": str(organization),
            "email": "member@example.com",
            "role": "viewer",
            "business_role": "salesperson",
            "redirect_to": "https://www.smartsteelsales.com/auth/finish?invited=1",
        },
    )
    assert response.status_code == 201
    payload = response.json()
    assert payload["invitation_id"] == str(invitation)
    assert payload["email_delivery"] == "sent"
    assert payload["business_role"] == "salesperson"
    assert payload["send_count"] == 1
    monkeypatch.delenv("WORKER_INTERNAL_TOKEN")


def test_internal_invitation_route_requires_configured_token(monkeypatch) -> None:
    monkeypatch.delenv("WORKER_INTERNAL_TOKEN", raising=False)
    response = client.post(
        "/v1/admin/organization-invitations",
        json={
            "actor_user_id": "00000000-0000-0000-0000-000000000101",
            "organization_id": "00000000-0000-0000-0000-000000000201",
            "email": "member@example.com",
            "role": "member",
        },
    )
    assert response.status_code == 503


def test_internal_invitation_route_rejects_wrong_token(monkeypatch) -> None:
    monkeypatch.setenv("WORKER_INTERNAL_TOKEN", "p1-test-token")
    response = client.post(
        "/v1/admin/organization-invitations",
        headers={"x-worker-token": "wrong"},
        json={
            "actor_user_id": "00000000-0000-0000-0000-000000000101",
            "organization_id": "00000000-0000-0000-0000-000000000201",
            "email": "member@example.com",
            "role": "member",
        },
    )
    assert response.status_code == 401
    monkeypatch.delenv("WORKER_INTERNAL_TOKEN")


def test_admin_authorization_failure_is_403(monkeypatch) -> None:
    class FakeService:
        async def invite_member(self, **kwargs):
            raise TenantAdminError("Organization admin role required.")

    monkeypatch.setattr(tenant_admin_module, "TenantAdminService", FakeService)
    monkeypatch.setenv("WORKER_INTERNAL_TOKEN", "p1-test-token")
    response = client.post(
        "/v1/admin/organization-invitations",
        headers={"x-worker-token": "p1-test-token"},
        json={
            "actor_user_id": "00000000-0000-0000-0000-000000000101",
            "organization_id": "00000000-0000-0000-0000-000000000201",
            "email": "member@example.com",
            "role": "member",
        },
    )
    assert response.status_code == 403
    monkeypatch.delenv("WORKER_INTERNAL_TOKEN")


def test_existing_active_member_is_conflict(monkeypatch) -> None:
    class FakeService:
        async def invite_member(self, **kwargs):
            raise TenantAdminError("User already has active organization membership.")

    monkeypatch.setattr(tenant_admin_module, "TenantAdminService", FakeService)
    monkeypatch.setenv("WORKER_INTERNAL_TOKEN", "p1-test-token")
    response = client.post(
        "/v1/admin/organization-invitations",
        headers={"x-worker-token": "p1-test-token"},
        json={
            "actor_user_id": "00000000-0000-0000-0000-000000000101",
            "organization_id": "00000000-0000-0000-0000-000000000201",
            "email": "member@example.com",
            "role": "member",
            "business_role": "operations",
        },
    )
    assert response.status_code == 409
    monkeypatch.delenv("WORKER_INTERNAL_TOKEN")
