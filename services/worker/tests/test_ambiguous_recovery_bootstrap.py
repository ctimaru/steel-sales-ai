import asyncio
import base64
import hashlib
import io
import json
import zipfile
from uuid import UUID

import pytest

from app import ambiguous_recovery_bootstrap as bootstrap


def _archive_bytes(items: dict[str, bytes]) -> bytes:
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as archive:
        for path, content in items.items():
            archive.writestr(path, content)
    return buffer.getvalue()


def test_pa23016_bootstrap_recovers_exact_manual_manifest(monkeypatch):
    actor = UUID("f45fab6e-3da8-41aa-8711-fc1b337a7dde")
    manifest = [
        {
            "remediation_queue_id": 22,
            "reingest_id": 17,
            "expected_source_filename":
                "Inbox/2.1 BRONIFER 13131/0000018497-R_ rdo tubo.eml",
        },
        {
            "remediation_queue_id": 23,
            "reingest_id": 18,
            "expected_source_filename":
                "Inbox/2.1 BRONIFER 13131/0000126901-R_ tubo 406x6,3 a 13600.eml",
        },
    ]
    archive_payload = _archive_bytes(
        {
            str(item["expected_source_filename"]): b"Subject: selected\n\nbody"
            for item in manifest
        }
    )
    calls = {"cleanup": 0, "recover": []}

    class FakeRepo:
        async def get_offer_source_recovery_transfer(self, *, transfer_id):
            assert transfer_id == "pa23016-prod-20260924"
            return {
                "status": "ready",
                "payload_base64": base64.b64encode(archive_payload).decode("ascii"),
            }

        async def cleanup_offer_source_recovery_transfer(self, *, transfer_id):
            calls["cleanup"] += 1
            return {"status": "cleaned", "transfer_id": transfer_id}

    async def fake_recover(**kwargs):
        calls["recover"].append(kwargs)
        return {
            "status": "consumed",
            "successor_run_id": 100 + kwargs["reingest_id"],
            "reparse": {"status": "completed", "extraction_count": 1},
        }

    monkeypatch.setattr(bootstrap, "WorkerRepository", FakeRepo)
    monkeypatch.setattr(bootstrap, "execute_offer_source_reingest_bytes", fake_recover)
    monkeypatch.setenv(
        "OFFER_SOURCE_AMBIGUOUS_RECOVERY_BOOTSTRAP_TRANSFER_ID",
        "pa23016-prod-20260924",
    )
    monkeypatch.setenv(
        "OFFER_SOURCE_AMBIGUOUS_RECOVERY_BOOTSTRAP_ACTOR_ID",
        str(actor),
    )
    monkeypatch.setenv(
        "OFFER_SOURCE_AMBIGUOUS_RECOVERY_BOOTSTRAP_ARCHIVE_SHA256",
        hashlib.sha256(archive_payload).hexdigest(),
    )
    monkeypatch.setenv(
        "OFFER_SOURCE_AMBIGUOUS_RECOVERY_BOOTSTRAP_MANIFEST",
        json.dumps(manifest),
    )

    result = asyncio.run(
        bootstrap.execute_offer_source_ambiguous_recovery_bootstrap()
    )

    assert result["status"] == "completed"
    assert result["recovered"] == 2
    assert result["failed"] == 0
    assert result["automatic_source_selection"] is False
    assert result["automatic_promotion"] is False
    assert calls["cleanup"] == 1
    assert [x["reingest_id"] for x in calls["recover"]] == [17, 18]
    assert calls["recover"][0]["expected_source_path"] == manifest[0]["expected_source_filename"]
    assert calls["recover"][1]["expected_source_path"] == manifest[1]["expected_source_filename"]


def test_pa23016_checksum_mismatch_fails_before_recovery(monkeypatch):
    manifest = [
        {
            "remediation_queue_id": 22,
            "reingest_id": 17,
            "expected_source_filename": "Inbox/manual.eml",
        }
    ]
    archive_payload = _archive_bytes({"Inbox/manual.eml": b"payload"})
    calls = {"recover": 0, "cleanup": 0}

    class FakeRepo:
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
    monkeypatch.setenv(
        "OFFER_SOURCE_AMBIGUOUS_RECOVERY_BOOTSTRAP_TRANSFER_ID",
        "pa23016-prod-20260924",
    )
    monkeypatch.setenv(
        "OFFER_SOURCE_AMBIGUOUS_RECOVERY_BOOTSTRAP_ACTOR_ID",
        "f45fab6e-3da8-41aa-8711-fc1b337a7dde",
    )
    monkeypatch.setenv(
        "OFFER_SOURCE_AMBIGUOUS_RECOVERY_BOOTSTRAP_ARCHIVE_SHA256",
        "0" * 64,
    )
    monkeypatch.setenv(
        "OFFER_SOURCE_AMBIGUOUS_RECOVERY_BOOTSTRAP_MANIFEST",
        json.dumps(manifest),
    )

    with pytest.raises(ValueError, match="checksum mismatch"):
        asyncio.run(
            bootstrap.execute_offer_source_ambiguous_recovery_bootstrap()
        )

    assert calls == {"recover": 0, "cleanup": 0}


def test_pa23016_missing_member_preserves_transfer_for_retry(monkeypatch):
    manifest = [
        {
            "remediation_queue_id": 22,
            "reingest_id": 17,
            "expected_source_filename": "Inbox/missing.eml",
        }
    ]
    archive_payload = _archive_bytes({"Inbox/other.eml": b"payload"})
    calls = {"cleanup": 0}

    class FakeRepo:
        async def get_offer_source_recovery_transfer(self, *, transfer_id):
            return {
                "status": "ready",
                "payload_base64": base64.b64encode(archive_payload).decode("ascii"),
            }

        async def cleanup_offer_source_recovery_transfer(self, *, transfer_id):
            calls["cleanup"] += 1
            return {"status": "cleaned"}

    monkeypatch.setattr(bootstrap, "WorkerRepository", FakeRepo)
    monkeypatch.setenv(
        "OFFER_SOURCE_AMBIGUOUS_RECOVERY_BOOTSTRAP_TRANSFER_ID",
        "pa23016-prod-20260924",
    )
    monkeypatch.setenv(
        "OFFER_SOURCE_AMBIGUOUS_RECOVERY_BOOTSTRAP_ACTOR_ID",
        "f45fab6e-3da8-41aa-8711-fc1b337a7dde",
    )
    monkeypatch.setenv(
        "OFFER_SOURCE_AMBIGUOUS_RECOVERY_BOOTSTRAP_ARCHIVE_SHA256",
        hashlib.sha256(archive_payload).hexdigest(),
    )
    monkeypatch.setenv(
        "OFFER_SOURCE_AMBIGUOUS_RECOVERY_BOOTSTRAP_MANIFEST",
        json.dumps(manifest),
    )

    result = asyncio.run(
        bootstrap.execute_offer_source_ambiguous_recovery_bootstrap()
    )

    assert result["status"] == "partial_failure"
    assert result["failed"] == 1
    assert calls["cleanup"] == 0
