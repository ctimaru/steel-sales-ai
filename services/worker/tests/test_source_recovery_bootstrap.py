import asyncio
import base64
import hashlib
import io
import zipfile
from uuid import UUID

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app import source_recovery_bootstrap as bootstrap


def _archive_bytes(path: str, content: bytes) -> bytes:
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as archive:
        archive.writestr(path, content)
    return buffer.getvalue()


def test_pa23010_bootstrap_recovers_exact_unique_manifest(monkeypatch):
    source_path = "Inbox/unique.eml"
    archive_payload = _archive_bytes(source_path, b"Subject: Test\n\nEUR 10/mt")
    actor = UUID("f45fab6e-3da8-41aa-8711-fc1b337a7dde")
    organization = UUID("f042e541-6ade-53ba-46fb-0b040160de89")
    calls = {"cleanup": 0, "recover": 0}

    class FakeRepo:
        async def prepare_offer_source_recovery_bootstrap(self, **kwargs):
            assert kwargs["organization_id"] == organization
            assert kwargs["actor_id"] == actor
            assert kwargs["expected_unique_count"] == 1
            assert kwargs["expected_ambiguous_count"] == 2
            return {
                "status": "ready",
                "items": [
                    {
                        "reingest_id": 41,
                        "expected_source_filename": source_path,
                        "reingest_status": "requested",
                    }
                ],
            }

        async def get_offer_source_recovery_transfer(self, *, transfer_id):
            return {
                "status": "ready",
                "payload_base64": base64.b64encode(archive_payload).decode("ascii"),
            }

        async def cleanup_offer_source_recovery_transfer(self, *, transfer_id):
            calls["cleanup"] += 1
            return {"status": "cleaned"}

    async def fake_recover(**kwargs):
        assert kwargs["reingest_id"] == 41
        assert kwargs["owner_id"] == actor
        assert kwargs["expected_source_path"] == source_path
        calls["recover"] += 1
        return {"status": "consumed", "successor_run_id": 99}

    monkeypatch.setattr(bootstrap, "WorkerRepository", FakeRepo)
    monkeypatch.setattr(bootstrap, "execute_offer_source_reingest_bytes", fake_recover)
    monkeypatch.setenv("OFFER_SOURCE_RECOVERY_BOOTSTRAP_TRANSFER_ID", "pa23010-prod-001")
    monkeypatch.setenv("OFFER_SOURCE_RECOVERY_BOOTSTRAP_ORGANIZATION_ID", str(organization))
    monkeypatch.setenv("OFFER_SOURCE_RECOVERY_BOOTSTRAP_ACTOR_ID", str(actor))
    monkeypatch.setenv("OFFER_SOURCE_RECOVERY_BOOTSTRAP_EXPECTED_UNIQUE", "1")
    monkeypatch.setenv("OFFER_SOURCE_RECOVERY_BOOTSTRAP_EXPECTED_AMBIGUOUS", "2")
    monkeypatch.setenv(
        "OFFER_SOURCE_RECOVERY_BOOTSTRAP_ARCHIVE_SHA256",
        hashlib.sha256(archive_payload).hexdigest(),
    )

    asyncio.run(bootstrap.execute_offer_source_recovery_bootstrap())

    assert calls == {"cleanup": 1, "recover": 1}


def test_pa23010_checksum_mismatch_fails_before_recovery(monkeypatch):
    archive_payload = _archive_bytes("Inbox/unique.eml", b"payload")
    calls = {"cleanup": 0, "recover": 0}

    class FakeRepo:
        async def prepare_offer_source_recovery_bootstrap(self, **kwargs):
            return {
                "status": "ready",
                "items": [
                    {
                        "reingest_id": 42,
                        "expected_source_filename": "Inbox/unique.eml",
                        "reingest_status": "requested",
                    }
                ],
            }

        async def get_offer_source_recovery_transfer(self, *, transfer_id):
            return {
                "status": "ready",
                "payload_base64": base64.b64encode(archive_payload).decode("ascii"),
            }

        async def cleanup_offer_source_recovery_transfer(self, *, transfer_id):
            calls["cleanup"] += 1
            return {"status": "cleaned"}

    async def fake_recover(**kwargs):
        calls["recover"] += 1
        return {"status": "consumed"}

    monkeypatch.setattr(bootstrap, "WorkerRepository", FakeRepo)
    monkeypatch.setattr(bootstrap, "execute_offer_source_reingest_bytes", fake_recover)
    monkeypatch.setenv("OFFER_SOURCE_RECOVERY_BOOTSTRAP_TRANSFER_ID", "pa23010-prod-001")
    monkeypatch.setenv(
        "OFFER_SOURCE_RECOVERY_BOOTSTRAP_ORGANIZATION_ID",
        "f042e541-6ade-53ba-46fb-0b040160de89",
    )
    monkeypatch.setenv(
        "OFFER_SOURCE_RECOVERY_BOOTSTRAP_ACTOR_ID",
        "f45fab6e-3da8-41aa-8711-fc1b337a7dde",
    )
    monkeypatch.setenv("OFFER_SOURCE_RECOVERY_BOOTSTRAP_EXPECTED_UNIQUE", "1")
    monkeypatch.setenv("OFFER_SOURCE_RECOVERY_BOOTSTRAP_EXPECTED_AMBIGUOUS", "2")
    monkeypatch.setenv("OFFER_SOURCE_RECOVERY_BOOTSTRAP_ARCHIVE_SHA256", "0" * 64)

    with pytest.raises(ValueError, match="checksum mismatch"):
        asyncio.run(bootstrap.execute_offer_source_recovery_bootstrap())

    assert calls == {"cleanup": 0, "recover": 0}


def test_pa23010_upload_bridge_rejects_wrong_token_before_persistence(monkeypatch):
    app = FastAPI()
    bootstrap.install_offer_source_recovery_bootstrap(app)
    monkeypatch.setenv("PA23010_UPLOAD_TOKEN", "correct-token")
    client = TestClient(app)

    response = client.post(
        "/v1/remediation/pa23010-upload",
        data={"token": "wrong-token"},
        files={"upload": ("recovery.zip", b"not-used", "application/zip")},
    )

    assert response.status_code == 403


def test_pa23010_upload_bridge_rejects_checksum_mismatch_before_persistence(monkeypatch):
    app = FastAPI()
    bootstrap.install_offer_source_recovery_bootstrap(app)
    monkeypatch.setenv("PA23010_UPLOAD_TOKEN", "correct-token")
    monkeypatch.setenv("OFFER_SOURCE_RECOVERY_BOOTSTRAP_ARCHIVE_SHA256", "0" * 64)
    archive_payload = _archive_bytes("Inbox/unique.eml", b"payload")
    client = TestClient(app)

    response = client.post(
        "/v1/remediation/pa23010-upload",
        data={"token": "correct-token"},
        files={"upload": ("recovery.zip", archive_payload, "application/zip")},
    )

    assert response.status_code == 422
    assert response.json()["detail"] == "Recovery archive checksum mismatch."
