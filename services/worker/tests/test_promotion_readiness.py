from fastapi import FastAPI
from fastapi.testclient import TestClient

from app import promotion_readiness


app = FastAPI()
app.include_router(promotion_readiness.router)
client = TestClient(app)


def configure(monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "test-service-key-not-a-real-secret")


def test_readiness_resolves_tenant_and_calls_rpc(monkeypatch):
    configure(monkeypatch)
    calls = []

    async def fake_request(self, method, path, *, json=None, prefer=None):
        calls.append((method, path, json))
        if path.startswith("/rest/v1/organization_memberships"):
            return [{"organization_id": "00000000-0000-0000-0000-000000000010"}]
        if path == "/rest/v1/rpc/p1_promotion_readiness":
            return {
                "summary": {"requested_total": 3, "ready": 1, "blocked": 2, "already_promoted": 0},
                "candidates": [{"observation_id": 1, "readiness_status": "ready", "reasons": []}],
                "policy": {"confidence_threshold": 0.9},
            }
        raise AssertionError(path)

    monkeypatch.setattr(promotion_readiness.WorkerRepository, "_request", fake_request)

    response = client.post(
        "/v1/promotions/readiness",
        json={"actor_user_id": "00000000-0000-0000-0000-000000000001", "limit": 25},
    )
    assert response.status_code == 200
    assert response.json()["summary"]["ready"] == 1
    assert calls[1][1] == "/rest/v1/rpc/p1_promotion_readiness"
    assert calls[1][2]["p_limit"] == 25


def test_readiness_requires_membership(monkeypatch):
    configure(monkeypatch)

    async def fake_request(self, method, path, *, json=None, prefer=None):
        return []

    monkeypatch.setattr(promotion_readiness.WorkerRepository, "_request", fake_request)
    response = client.post(
        "/v1/promotions/readiness",
        json={"actor_user_id": "00000000-0000-0000-0000-000000000001"},
    )
    assert response.status_code == 400
    assert "organization access" in response.json()["detail"]


def test_grouped_readiness_calls_group_rpc(monkeypatch):
    configure(monkeypatch)
    calls = []

    async def fake_request(self, method, path, *, json=None, prefer=None):
        calls.append((method, path, json))
        if path.startswith("/rest/v1/organization_memberships"):
            return [{"organization_id": "00000000-0000-0000-0000-000000000010"}]
        if path == "/rest/v1/rpc/p1_grouped_rfq_readiness":
            return {
                "summary": {"multi_line_threads": 2, "ready": 1, "blocked": 1},
                "threads": [
                    {
                        "thread_id": "00000000-0000-0000-0000-000000000020",
                        "readiness_status": "ready",
                        "line_count": 2,
                        "reasons": [],
                    }
                ],
                "policy": {"minimum_lines": 2},
            }
        raise AssertionError(path)

    monkeypatch.setattr(promotion_readiness.WorkerRepository, "_request", fake_request)

    response = client.post(
        "/v1/promotions/group-readiness",
        json={"actor_user_id": "00000000-0000-0000-0000-000000000001", "limit": 10},
    )
    assert response.status_code == 200
    assert response.json()["summary"]["ready"] == 1
    assert calls[1][1] == "/rest/v1/rpc/p1_grouped_rfq_readiness"
    assert calls[1][2]["p_limit"] == 10


def test_identity_readiness_calls_identity_rpc(monkeypatch):
    configure(monkeypatch)
    calls = []

    async def fake_request(self, method, path, *, json=None, prefer=None):
        calls.append((method, path, json))
        if path.startswith("/rest/v1/organization_memberships"):
            return [{"organization_id": "00000000-0000-0000-0000-000000000010"}]
        if path == "/rest/v1/rpc/p1_rfq_identity_readiness":
            return {
                "summary": {
                    "promoted_rfqs": 1,
                    "conversation_ready": 1,
                    "conversation_linked": 0,
                    "message_linked": 0,
                    "company_linked": 0,
                    "contact_linked": 0,
                },
                "rfqs": [
                    {
                        "rfq_id": "00000000-0000-0000-0000-000000000020",
                        "conversation_status": "ready",
                        "message_status": "blocked_missing_message_evidence",
                    }
                ],
            }
        raise AssertionError(path)

    monkeypatch.setattr(promotion_readiness.WorkerRepository, "_request", fake_request)

    response = client.post(
        "/v1/promotions/identity-readiness",
        json={"actor_user_id": "00000000-0000-0000-0000-000000000001", "limit": 10},
    )
    assert response.status_code == 200
    assert response.json()["summary"]["conversation_ready"] == 1
    assert calls[1][1] == "/rest/v1/rpc/p1_rfq_identity_readiness"
    assert calls[1][2]["p_limit"] == 10
