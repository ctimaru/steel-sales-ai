import os
from datetime import UTC, datetime, timedelta
from uuid import UUID

from fastapi.testclient import TestClient

os.environ["WORKER_STORAGE_MODE"] = "memory"

import app.tenant_admin as tenant_admin_module  # noqa: E402
from app.server import app  # noqa: E402
from app.tenant_admin import TenantAdminError, _normalize_email, _validate_redirect  # noqa: E402

client = TestClient(app)


def test_invitation_input_normalization() -> None:
    assert _normalize_email("  SALES@Example.COM ") == "sales@example.com"
    assert _validate_redirect("https://steel-sales-ai.vercel.app/onboarding") == (
        "https://steel-sales-ai.vercel.app/onboarding"
    )
    assert _validate_redirect("http://localhost:3000/onboarding") == (
        "http://localhost:3000/onboarding"
    )


def test_invitation_input_rejects_invalid_values() -> None:
    for value in ("not-an-email", "missing@domain"):
        try:
            _normalize_email(value)
        except TenantAdminError:
            pass
        else:
            raise AssertionError("invalid email was accepted")

    try:
        _validate_redirect("http://example.com/onboarding")
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
            assert kwargs["redirect_to"].endswith("/onboarding?invited=1")
            return {
                "id": str(invitation),
                "invitation_id": str(invitation),
                "organization_id": str(organization),
                "email": "member@example.com",
                "role": "viewer",
                "status": "pending",
                "email_delivery": "sent",
                "expires_at": expires_at.isoformat(),
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
            "redirect_to": "https://steel-sales-ai.vercel.app/onboarding?invited=1",
        },
    )
    assert response.status_code == 201
    payload = response.json()
    assert payload["invitation_id"] == str(invitation)
    assert payload["email_delivery"] == "sent"
    monkeypatch.delenv("WORKER_INTERNAL_TOKEN")


def test_internal_invitation_route_requires_token(monkeypatch) -> None:
    monkeypatch.setenv("WORKER_INTERNAL_TOKEN", "p1-test-token")
    response = client.post(
        "/v1/admin/organization-invitations",
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
    response = client.post(
        "/v1/admin/organization-invitations",
        json={
            "actor_user_id": "00000000-0000-0000-0000-000000000101",
            "organization_id": "00000000-0000-0000-0000-000000000201",
            "email": "member@example.com",
            "role": "member",
        },
    )
    assert response.status_code == 403
