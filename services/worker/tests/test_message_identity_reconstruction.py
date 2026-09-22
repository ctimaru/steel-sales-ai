from fastapi import FastAPI
from fastapi.testclient import TestClient

from app import message_identity_reconstruction as mir


app = FastAPI()
app.include_router(mir.router)
client = TestClient(app)


def configure(monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "test-service-key-not-a-real-secret")


def test_reconstruct_historical_eml(monkeypatch):
    configure(monkeypatch)

    async def fake_get_job(self, job_id):
        return {
            "id": str(job_id),
            "filename": "historical.eml",
            "extension": ".eml",
            "organization_id": "00000000-0000-0000-0000-000000000010",
            "thread_id": "00000000-0000-0000-0000-000000000020",
            "storage_path": "organizations/x/historical.eml",
        }

    async def fake_request(self, method, path, *, json=None, prefer=None):
        if path.startswith("/rest/v1/organization_memberships"):
            return [{"user_id": "00000000-0000-0000-0000-000000000001"}]
        raise AssertionError(path)

    persisted = {}
    async def fake_persist(self, *, job_id, identity):
        persisted["identity"] = identity

    async def fake_materialize(self, job_id):
        return {
            "status": "materialized",
            "message_id": "00000000-0000-0000-0000-000000000030",
            "conversation_id": "00000000-0000-0000-0000-000000000040",
        }

    class FakeBucket:
        def download(self, path):
            assert path == "organizations/x/historical.eml"
            return (
                b"From: Buyer <buyer@example.com>\r\n"
                b"To: Sales <sales@steel.example>\r\n"
                b"Date: Tue, 22 Sep 2026 08:15:00 +0200\r\n"
                b"Message-ID: <historical@example.com>\r\n"
                b"Subject: Historical RFQ\r\n\r\n"
                b"S355 273x8 12000\r\n"
            )

    monkeypatch.setattr(mir.WorkerRepository, "get_job", fake_get_job)
    monkeypatch.setattr(mir.WorkerRepository, "_request", fake_request)
    monkeypatch.setattr(mir.WorkerRepository, "persist_message_identity", fake_persist)
    monkeypatch.setattr(mir.WorkerRepository, "materialize_message_identity", fake_materialize)
    monkeypatch.setattr(mir.MessageReconstructionService, "_storage_client", lambda self: FakeBucket())

    response = client.post(
        "/v1/message-identity/reconstruct",
        json={
            "actor_user_id": "00000000-0000-0000-0000-000000000001",
            "job_id": "00000000-0000-0000-0000-000000000050",
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["identity"]["source_message_id"] == "<historical@example.com>"
    assert body["identity"]["sender_email"] == "buyer@example.com"
    assert body["materialization"]["status"] == "materialized"
    assert persisted["identity"]["email_subject"] == "Historical RFQ"


def test_reconstruct_rejects_cross_tenant_actor(monkeypatch):
    configure(monkeypatch)

    async def fake_get_job(self, job_id):
        return {
            "id": str(job_id),
            "filename": "historical.eml",
            "extension": ".eml",
            "organization_id": "00000000-0000-0000-0000-000000000010",
            "thread_id": "00000000-0000-0000-0000-000000000020",
            "storage_path": "organizations/x/historical.eml",
        }

    async def fake_request(self, method, path, *, json=None, prefer=None):
        return []

    monkeypatch.setattr(mir.WorkerRepository, "get_job", fake_get_job)
    monkeypatch.setattr(mir.WorkerRepository, "_request", fake_request)

    response = client.post(
        "/v1/message-identity/reconstruct",
        json={
            "actor_user_id": "00000000-0000-0000-0000-000000000001",
            "job_id": "00000000-0000-0000-0000-000000000050",
        },
    )
    assert response.status_code == 400
    assert "write membership" in response.json()["detail"]
