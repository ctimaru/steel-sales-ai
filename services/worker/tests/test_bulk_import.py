from uuid import UUID

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app import bulk_import
from app.bulk_import import BulkFileDescriptor, PrepareBatchRequest


app = FastAPI()
app.include_router(bulk_import.router)
client = TestClient(app)


def descriptor(name: str = "offer.eml", checksum: str = "a" * 64, size: int = 100):
    return {"filename": name, "size_bytes": size, "content_checksum": checksum}


def configure_service(monkeypatch) -> None:
    monkeypatch.setenv("SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "test-service-key-not-a-real-secret")


def test_prepare_contract_accepts_supported_bulk_types() -> None:
    request = PrepareBatchRequest(
        actor_user_id=UUID("00000000-0000-0000-0000-000000000001"),
        files=[
            BulkFileDescriptor(**descriptor("offer.eml", "a" * 64)),
            BulkFileDescriptor(**descriptor("quote.pdf", "b" * 64)),
            BulkFileDescriptor(**descriptor("prices.xls", "c" * 64)),
            BulkFileDescriptor(**descriptor("prices.xlsx", "d" * 64)),
        ],
    )
    assert len(request.files) == 4


def test_prepare_contract_rejects_zip_and_duplicate_content() -> None:
    with pytest.raises(ValidationError, match="Unsupported file type"):
        PrepareBatchRequest(
            actor_user_id=UUID("00000000-0000-0000-0000-000000000001"),
            files=[BulkFileDescriptor(**descriptor("archive.zip"))],
        )

    with pytest.raises(ValidationError, match="same file content"):
        PrepareBatchRequest(
            actor_user_id=UUID("00000000-0000-0000-0000-000000000001"),
            files=[
                BulkFileDescriptor(**descriptor("a.pdf", "e" * 64)),
                BulkFileDescriptor(**descriptor("b.pdf", "e" * 64)),
            ],
        )


def test_prepare_endpoint_enforces_internal_token(monkeypatch) -> None:
    monkeypatch.setenv("WORKER_INTERNAL_TOKEN", "bulk-secret")
    response = client.post(
        "/v1/import-batches/prepare",
        json={
            "actor_user_id": "00000000-0000-0000-0000-000000000001",
            "files": [descriptor()],
        },
    )
    assert response.status_code == 401
    monkeypatch.delenv("WORKER_INTERNAL_TOKEN")


def test_prepare_endpoint_returns_persistent_batch_contract(monkeypatch) -> None:
    configure_service(monkeypatch)
    batch_id = UUID("00000000-0000-0000-0000-000000000010")
    item_id = UUID("00000000-0000-0000-0000-000000000011")

    async def fake_prepare(self, *, actor_user_id, files):
        assert actor_user_id == UUID("00000000-0000-0000-0000-000000000001")
        assert files[0].filename == "offer.eml"
        return {
            "batch_id": batch_id,
            "status": "queued",
            "total_items": 1,
            "items": [
                {
                    "item_id": item_id,
                    "filename": "offer.eml",
                    "status": "queued",
                    "storage_path": "organizations/org/imports/batch/item/offer.eml",
                    "upload_token": "signed-token",
                    "deduplicated": False,
                }
            ],
        }

    monkeypatch.setattr(bulk_import.BulkImportService, "prepare_batch", fake_prepare)
    response = client.post(
        "/v1/import-batches/prepare",
        json={
            "actor_user_id": "00000000-0000-0000-0000-000000000001",
            "files": [descriptor()],
        },
    )
    assert response.status_code == 201
    assert response.json()["batch_id"] == str(batch_id)
    assert response.json()["items"][0]["upload_token"] == "signed-token"


def test_start_and_retry_forward_selective_item_ids(monkeypatch) -> None:
    configure_service(monkeypatch)
    batch_id = UUID("00000000-0000-0000-0000-000000000010")
    actor_id = UUID("00000000-0000-0000-0000-000000000001")
    item_id = UUID("00000000-0000-0000-0000-000000000011")

    async def fake_start(self, *, background_tasks, batch_id, actor_user_id, item_ids):
        assert actor_user_id == actor_id
        assert item_ids == [item_id]
        return {"batch_id": batch_id, "accepted_items": 1, "skipped_items": 0}

    async def fake_retry(self, *, background_tasks, batch_id, actor_user_id, item_ids):
        assert actor_user_id == actor_id
        assert item_ids == [item_id]
        return {
            "batch_id": batch_id,
            "accepted_items": 1,
            "reconciled_items": 0,
            "skipped_items": 0,
        }

    monkeypatch.setattr(bulk_import.BulkImportService, "start_batch", fake_start)
    monkeypatch.setattr(bulk_import.BulkImportService, "retry_batch", fake_retry)

    start = client.post(
        f"/v1/import-batches/{batch_id}/start",
        json={"actor_user_id": str(actor_id), "item_ids": [str(item_id)]},
    )
    assert start.status_code == 202
    assert start.json()["accepted_items"] == 1

    retry = client.post(
        f"/v1/import-batches/{batch_id}/retry",
        json={"actor_user_id": str(actor_id), "item_ids": [str(item_id)]},
    )
    assert retry.status_code == 202
    assert retry.json()["reconciled_items"] == 0
