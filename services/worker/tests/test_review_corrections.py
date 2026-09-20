from uuid import UUID

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app import review_corrections


app = FastAPI()
app.include_router(review_corrections.router)
client = TestClient(app)


def configure(monkeypatch) -> None:
    monkeypatch.setenv("SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "test-service-key-not-a-real-secret")


def test_review_correction_requires_internal_token(monkeypatch) -> None:
    monkeypatch.setenv("WORKER_INTERNAL_TOKEN", "review-secret")
    response = client.post(
        "/v1/reviews/2/correct",
        json={
            "actor_user_id": "00000000-0000-0000-0000-000000000001",
            "corrected_values": {"grade": "P265GH"},
        },
    )
    assert response.status_code == 401
    monkeypatch.delenv("WORKER_INTERNAL_TOKEN")


def test_review_correction_resolves_write_membership_before_rpc(monkeypatch) -> None:
    configure(monkeypatch)
    actor = UUID("00000000-0000-0000-0000-000000000001")
    calls = []

    async def fake_request(self, method, path, *, json=None, prefer=None):
        calls.append((method, path, json))
        if path.startswith("/rest/v1/organization_memberships"):
            return [{
                "organization_id": "00000000-0000-0000-0000-000000000010",
                "user_id": str(actor),
                "role": "member",
                "is_default": True,
                "created_at": "2026-09-20T00:00:00+00:00",
            }]
        if path == "/rest/v1/rpc/p1_apply_review_correction":
            assert json["p_review_id"] == 2
            assert json["p_actor_user_id"] == str(actor)
            assert json["p_organization_id"] == "00000000-0000-0000-0000-000000000010"
            assert json["p_corrected_values"]["grade"] == "P265GH"
            assert json["p_metadata"]["source"] == "review_queue_web"
            return {
                "applied": True,
                "idempotent": False,
                "event_id": "00000000-0000-0000-0000-000000000099",
                "observation_id": 44,
            }
        raise AssertionError(f"unexpected path: {path}")

    monkeypatch.setattr(review_corrections.WorkerRepository, "_request", fake_request)
    response = client.post(
        "/v1/reviews/2/correct",
        json={
            "actor_user_id": str(actor),
            "corrected_values": {"grade": "P265GH"},
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["applied"] is True
    assert body["access"]["membership_verified"] is True
    assert calls[0][1].startswith("/rest/v1/organization_memberships")
    assert calls[1][1] == "/rest/v1/rpc/p1_apply_review_correction"


def test_review_correction_rejects_viewer_or_missing_write_membership(monkeypatch) -> None:
    configure(monkeypatch)

    async def fake_request(self, method, path, *, json=None, prefer=None):
        return []

    monkeypatch.setattr(review_corrections.WorkerRepository, "_request", fake_request)
    response = client.post(
        "/v1/reviews/2/correct",
        json={
            "actor_user_id": "00000000-0000-0000-0000-000000000001",
            "corrected_values": {"grade": "P265GH"},
        },
    )
    assert response.status_code == 400
    assert "write access" in response.json()["detail"]
