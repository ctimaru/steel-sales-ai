from uuid import UUID

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app import data_source_center


app = FastAPI()
app.include_router(data_source_center.router)
client = TestClient(app)


def configure_service(monkeypatch) -> None:
    monkeypatch.setenv("SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "test-service-key-not-a-real-secret")


def test_history_endpoint_enforces_internal_token(monkeypatch) -> None:
    monkeypatch.setenv("WORKER_INTERNAL_TOKEN", "source-secret")
    response = client.post(
        "/v1/data-sources/history",
        json={"actor_user_id": "00000000-0000-0000-0000-000000000001"},
    )
    assert response.status_code == 401
    monkeypatch.delenv("WORKER_INTERNAL_TOKEN")


def test_history_resolves_tenant_before_calling_service_role_rpc(monkeypatch) -> None:
    configure_service(monkeypatch)
    actor_id = UUID("00000000-0000-0000-0000-000000000001")
    organization_id = "00000000-0000-0000-0000-000000000010"
    calls: list[tuple[str, str, object]] = []

    async def fake_request(self, method, path, *, json=None, prefer=None):
        calls.append((method, path, json))
        if path.startswith("/rest/v1/organization_memberships"):
            return [
                {
                    "organization_id": organization_id,
                    "user_id": str(actor_id),
                    "role": "admin",
                    "is_default": True,
                    "created_at": "2026-09-16T00:00:00+00:00",
                }
            ]
        if path == "/rest/v1/rpc/p1_data_source_center":
            assert json["p_organization_id"] == organization_id
            assert json["p_search"] == "offer"
            assert json["p_state"] == "duplicate"
            assert json["p_source_key"] == "manual_bulk"
            return {
                "summary": {
                    "total": 1,
                    "indexed": 1,
                    "indexing": 0,
                    "duplicates": 1,
                    "errors": 0,
                    "discarded": 0,
                    "processing": 0,
                    "last_sync_at": "2026-09-16T10:00:00+00:00",
                    "active_model_key": "model-v1",
                    "active_model_name": "Model V1",
                },
                "sources": [
                    {
                        "source_key": "manual_bulk",
                        "source_name": "Upload manuale",
                        "source_type": "import_batch",
                        "total_items": 1,
                        "indexed_items": 1,
                        "duplicate_items": 1,
                        "error_items": 0,
                        "last_sync_at": "2026-09-16T10:00:00+00:00",
                    }
                ],
                "items": [
                    {
                        "history_id": "batch:00000000-0000-0000-0000-000000000020",
                        "batch_id": "00000000-0000-0000-0000-000000000030",
                        "item_id": "00000000-0000-0000-0000-000000000020",
                        "document_id": "00000000-0000-0000-0000-000000000040",
                        "display_name": "offer.pdf",
                        "media_type": "file",
                        "source_key": "manual_bulk",
                        "source_name": "Upload manuale",
                        "source_type": "import_batch",
                        "state": "duplicate",
                        "indexing_state": "indexed",
                        "deduplicated": True,
                        "error": None,
                        "attempt_count": 0,
                        "size_bytes": 100,
                        "chunk_count": 2,
                        "embedded_count": 2,
                        "imported_at": "2026-09-16T09:00:00+00:00",
                        "last_sync_at": "2026-09-16T10:00:00+00:00",
                    }
                ],
                "total_filtered": 1,
                "limit": 25,
                "offset": 0,
            }
        raise AssertionError(f"unexpected path: {path}")

    monkeypatch.setattr(data_source_center.WorkerRepository, "_request", fake_request)
    response = client.post(
        "/v1/data-sources/history",
        json={
            "actor_user_id": str(actor_id),
            "search": "offer",
            "state": "duplicate",
            "source_key": "manual_bulk",
            "limit": 25,
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["summary"]["duplicates"] == 1
    assert body["items"][0]["indexing_state"] == "indexed"
    assert calls[0][1].startswith("/rest/v1/organization_memberships")
    assert calls[1][1] == "/rest/v1/rpc/p1_data_source_center"


def test_history_rejects_actor_without_active_membership(monkeypatch) -> None:
    configure_service(monkeypatch)

    async def fake_request(self, method, path, *, json=None, prefer=None):
        return []

    monkeypatch.setattr(data_source_center.WorkerRepository, "_request", fake_request)
    response = client.post(
        "/v1/data-sources/history",
        json={"actor_user_id": "00000000-0000-0000-0000-000000000001"},
    )
    assert response.status_code == 400
    assert "organization access" in response.json()["detail"]
