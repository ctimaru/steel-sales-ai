import hashlib
from io import BytesIO
from uuid import UUID

from fastapi.testclient import TestClient

import app.source_reingest as source_reingest
from app.server import app


class FakeRepo:
    def __init__(self):
        self.failed = []
        self.completed = []

    async def claim_offer_source_reingest(self, *, reingest_id, owner_id):
        return {
            "status": "claimed",
            "reingest_id": reingest_id,
            "owner_id": str(owner_id),
            "thread_id": "00000000-0000-0000-0000-000000000031",
            "source_only": True,
        }

    async def complete_offer_source_reingest(
        self,
        *,
        reingest_id,
        source_job_id,
        filename,
        storage_path,
        content_checksum,
        size_bytes,
    ):
        self.completed.append(
            {
                "reingest_id": reingest_id,
                "source_job_id": source_job_id,
                "filename": filename,
                "storage_path": storage_path,
                "content_checksum": content_checksum,
                "size_bytes": size_bytes,
            }
        )
        return {
            "status": "consumed",
            "reingest_id": reingest_id,
            "source_job_id": str(source_job_id),
            "successor_run_id": 44,
            "candidate_only": True,
            "observation_mutation": False,
            "automatic_promotion": False,
        }

    async def fail_offer_source_reingest(self, *, reingest_id, error):
        self.failed.append((reingest_id, error))
        return {"status": "failed", "reingest_id": reingest_id}


def test_pa2303_source_reingest_is_source_only_and_executes_successor(monkeypatch):
    repo = FakeRepo()
    payload = b"Subject: 406x6,3\n\nOffro P265GH 406,4x6,3x12000 EUR 68,38/mt"
    owner_id = UUID("f45fab6e-3da8-41aa-8711-fc1b337a7dde")

    monkeypatch.setattr(source_reingest, "WorkerRepository", lambda: repo)

    async def fake_upload(**kwargs):
        assert kwargs["content"] == payload
        assert kwargs["extension"] == ".eml"
        return "2026/09/23/source-recovery.eml"

    async def fake_reparse(run_id):
        assert run_id == 44
        return {
            "status": "completed",
            "run_id": 44,
            "candidate_count": 1,
            "extraction_count": 1,
        }

    monkeypatch.setattr(source_reingest, "upload_private_object", fake_upload)
    monkeypatch.setattr(source_reingest, "execute_offer_source_reparse", fake_reparse)

    client = TestClient(app)
    response = client.post(
        "/v1/remediation/offer-source-reingest/12",
        data={"owner_id": str(owner_id)},
        files={"upload": ("original.eml", BytesIO(payload), "message/rfc822")},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "consumed"
    assert body["successor_run_id"] == 44
    assert body["source_checksum_verified"] is True
    assert body["reparse"]["status"] == "completed"
    assert repo.completed[0]["content_checksum"] == hashlib.sha256(payload).hexdigest()
    assert repo.failed == []


def test_pa2303_rejects_non_eml_and_marks_recovery_failed(monkeypatch):
    repo = FakeRepo()
    monkeypatch.setattr(source_reingest, "WorkerRepository", lambda: repo)

    client = TestClient(app)
    response = client.post(
        "/v1/remediation/offer-source-reingest/13",
        data={"owner_id": "f45fab6e-3da8-41aa-8711-fc1b337a7dde"},
        files={"upload": ("wrong.pdf", BytesIO(b"pdf"), "application/pdf")},
    )

    assert response.status_code == 415
    assert repo.completed == []
    assert repo.failed
    assert repo.failed[0][0] == 13


def test_pa2303_owner_mismatch_is_not_claimable(monkeypatch):
    class MismatchRepo(FakeRepo):
        async def claim_offer_source_reingest(self, *, reingest_id, owner_id):
            return {"status": "blocked", "reason": "owner_mismatch"}

    monkeypatch.setattr(source_reingest, "WorkerRepository", lambda: MismatchRepo())

    client = TestClient(app)
    response = client.post(
        "/v1/remediation/offer-source-reingest/14",
        data={"owner_id": "f45fab6e-3da8-41aa-8711-fc1b337a7dde"},
        files={"upload": ("original.eml", BytesIO(b"Subject: test"), "message/rfc822")},
    )

    assert response.status_code == 409
