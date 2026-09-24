import hashlib
import json
import zipfile
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
            "expected_source_filenames": ["Inbox/2.1 BRONIFER 13131/original.eml"],
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


def test_pa2303_rejects_eml_from_another_thread_history(monkeypatch):
    repo = FakeRepo()
    monkeypatch.setattr(source_reingest, "WorkerRepository", lambda: repo)

    client = TestClient(app)
    response = client.post(
        "/v1/remediation/offer-source-reingest/15",
        data={"owner_id": "f45fab6e-3da8-41aa-8711-fc1b337a7dde"},
        files={"upload": ("other-thread.eml", BytesIO(b"Subject: wrong"), "message/rfc822")},
    )

    assert response.status_code == 422
    assert repo.completed == []
    assert repo.failed
    assert "source history" in repo.failed[0][1]


def test_pa2303b_manifest_rejects_duplicate_reingest_ids():
    try:
        source_reingest._parse_manifest(
            json.dumps(
                [
                    {"reingest_id": 1, "expected_source_filename": "Inbox/a.eml"},
                    {"reingest_id": 1, "expected_source_filename": "Inbox/b.eml"},
                ]
            )
        )
        assert False, "duplicate re-ingest ids must fail closed"
    except ValueError:
        pass


def test_pa2303b_bulk_archive_recovers_only_exact_manifest_paths(monkeypatch):
    class BatchRepo(FakeRepo):
        async def claim_offer_source_reingest(self, *, reingest_id, owner_id):
            expected = {
                21: "Inbox/2.1 BRONIFER 13131/a-offer.eml",
                22: "Inbox/2.1 BRONIFER 13131/b-offer.eml",
            }[reingest_id]
            return {
                "status": "claimed",
                "reingest_id": reingest_id,
                "owner_id": str(owner_id),
                "thread_id": f"00000000-0000-0000-0000-0000000000{reingest_id}",
                "source_only": True,
                "expected_source_filenames": [expected],
                "offered_source_filenames": [expected],
                "preferred_source_filename": expected,
                "source_selection_status": "unique_offered_source",
            }

        async def complete_offer_source_reingest(self, **kwargs):
            result = await super().complete_offer_source_reingest(**kwargs)
            result["successor_run_id"] = 100 + kwargs["reingest_id"]
            return result

    repo = BatchRepo()
    monkeypatch.setattr(source_reingest, "WorkerRepository", lambda: repo)

    async def fake_upload(**kwargs):
        return f"2026/09/23/{kwargs['job_id']}-{kwargs['filename']}"

    async def fake_reparse(run_id):
        return {"status": "completed", "run_id": run_id, "extraction_count": 1}

    monkeypatch.setattr(source_reingest, "upload_private_object", fake_upload)
    monkeypatch.setattr(source_reingest, "execute_offer_source_reparse", fake_reparse)

    archive_buffer = BytesIO()
    with zipfile.ZipFile(archive_buffer, "w") as archive:
        archive.writestr("Inbox/2.1 BRONIFER 13131/a-offer.eml", b"Subject: A\n\nEUR 10/mt")
        archive.writestr("Inbox/2.1 BRONIFER 13131/b-offer.eml", b"Subject: B\n\nEUR 20/mt")
        archive.writestr("Inbox/2.1 BRONIFER 13131/unrelated.eml", b"ignore")
    archive_buffer.seek(0)

    manifest = [
        {
            "reingest_id": 21,
            "expected_source_filename": "Inbox/2.1 BRONIFER 13131/a-offer.eml",
        },
        {
            "reingest_id": 22,
            "expected_source_filename": "Inbox/2.1 BRONIFER 13131/b-offer.eml",
        },
    ]

    client = TestClient(app)
    response = client.post(
        "/v1/remediation/offer-source-reingest-batch",
        data={
            "owner_id": "f45fab6e-3da8-41aa-8711-fc1b337a7dde",
            "manifest": json.dumps(manifest),
        },
        files={"upload": ("archive.zip", archive_buffer, "application/zip")},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "completed"
    assert body["recovered"] == 2
    assert body["missing"] == 0
    assert body["failed"] == 0
    assert body["automatic_ambiguous_selection"] is False
    assert len(repo.completed) == 2


def test_pa2303b_missing_archive_member_is_not_claimed(monkeypatch):
    class NoClaimRepo(FakeRepo):
        async def claim_offer_source_reingest(self, *, reingest_id, owner_id):
            raise AssertionError("missing archive members must not be claimed")

    monkeypatch.setattr(source_reingest, "WorkerRepository", lambda: NoClaimRepo())

    archive_buffer = BytesIO()
    with zipfile.ZipFile(archive_buffer, "w") as archive:
        archive.writestr("Inbox/other.eml", b"other")
    archive_buffer.seek(0)

    client = TestClient(app)
    response = client.post(
        "/v1/remediation/offer-source-reingest-batch",
        data={
            "owner_id": "f45fab6e-3da8-41aa-8711-fc1b337a7dde",
            "manifest": json.dumps(
                [
                    {
                        "reingest_id": 31,
                        "expected_source_filename": "Inbox/missing.eml",
                    }
                ]
            ),
        },
        files={"upload": ("archive.zip", archive_buffer, "application/zip")},
    )

    assert response.status_code == 200
    assert response.json()["missing"] == 1
    assert response.json()["recovered"] == 0


def test_pa2304_manual_selected_source_rejects_other_offered_file(monkeypatch):
    class SelectedRepo(FakeRepo):
        async def claim_offer_source_reingest(self, *, reingest_id, owner_id):
            return {
                "status": "claimed",
                "reingest_id": reingest_id,
                "owner_id": str(owner_id),
                "thread_id": "00000000-0000-0000-0000-000000000041",
                "source_only": True,
                "expected_source_filenames": [
                    "Inbox/offer-a.eml",
                    "Inbox/offer-b.eml",
                ],
                "offered_source_filenames": [
                    "Inbox/offer-a.eml",
                    "Inbox/offer-b.eml",
                ],
                "preferred_source_filename": "Inbox/offer-b.eml",
                "selected_source_filename": "Inbox/offer-b.eml",
                "source_selection_mode": "manual_offered_source",
                "source_selection_status": "manually_selected_offered_source",
            }

    repo = SelectedRepo()
    monkeypatch.setattr(source_reingest, "WorkerRepository", lambda: repo)

    client = TestClient(app)
    response = client.post(
        "/v1/remediation/offer-source-reingest/41",
        data={"owner_id": "f45fab6e-3da8-41aa-8711-fc1b337a7dde"},
        files={"upload": ("offer-a.eml", BytesIO(b"Subject: A"), "message/rfc822")},
    )

    assert response.status_code == 422
    assert repo.completed == []
    assert repo.failed
    assert "explicitly selected offered source" in repo.failed[0][1]


def test_pa2304_manual_selected_source_executes_exact_file(monkeypatch):
    class SelectedRepo(FakeRepo):
        async def claim_offer_source_reingest(self, *, reingest_id, owner_id):
            return {
                "status": "claimed",
                "reingest_id": reingest_id,
                "owner_id": str(owner_id),
                "thread_id": "00000000-0000-0000-0000-000000000042",
                "source_only": True,
                "expected_source_filenames": [
                    "Inbox/offer-a.eml",
                    "Inbox/offer-b.eml",
                ],
                "offered_source_filenames": [
                    "Inbox/offer-a.eml",
                    "Inbox/offer-b.eml",
                ],
                "preferred_source_filename": "Inbox/offer-b.eml",
                "selected_source_filename": "Inbox/offer-b.eml",
                "source_selection_mode": "manual_offered_source",
                "source_selection_status": "manually_selected_offered_source",
            }

    repo = SelectedRepo()
    monkeypatch.setattr(source_reingest, "WorkerRepository", lambda: repo)

    async def fake_upload(**kwargs):
        return "2026/09/23/selected-offer-b.eml"

    async def fake_reparse(run_id):
        assert run_id == 44
        return {"status": "completed", "run_id": 44, "extraction_count": 1}

    monkeypatch.setattr(source_reingest, "upload_private_object", fake_upload)
    monkeypatch.setattr(source_reingest, "execute_offer_source_reparse", fake_reparse)

    client = TestClient(app)
    response = client.post(
        "/v1/remediation/offer-source-reingest/42",
        data={"owner_id": "f45fab6e-3da8-41aa-8711-fc1b337a7dde"},
        files={"upload": ("offer-b.eml", BytesIO(b"Subject: B"), "message/rfc822")},
    )

    assert response.status_code == 200
    assert response.json()["status"] == "consumed"
    assert len(repo.completed) == 1
    assert repo.completed[0]["filename"] == "offer-b.eml"
    assert repo.failed == []


def test_pa23016_bulk_archive_accepts_exact_manual_offered_selection(monkeypatch):
    class ManualBatchRepo(FakeRepo):
        async def claim_offer_source_reingest(self, *, reingest_id, owner_id):
            expected = "Inbox/2.1 BRONIFER 13131/manual-offer.eml"
            return {
                "status": "claimed",
                "reingest_id": reingest_id,
                "owner_id": str(owner_id),
                "thread_id": "00000000-0000-0000-0000-000000000052",
                "source_only": True,
                "expected_source_filenames": [
                    expected,
                    "Inbox/2.1 BRONIFER 13131/other-offer.eml",
                ],
                "offered_source_filenames": [
                    expected,
                    "Inbox/2.1 BRONIFER 13131/other-offer.eml",
                ],
                "preferred_source_filename": expected,
                "selected_source_filename": expected,
                "source_selection_mode": "manual_offered_source",
                "source_selection_status": "manually_selected_offered_source",
            }

    repo = ManualBatchRepo()
    monkeypatch.setattr(source_reingest, "WorkerRepository", lambda: repo)

    async def fake_upload(**kwargs):
        return "2026/09/24/manual-offer.eml"

    async def fake_reparse(run_id):
        assert run_id == 44
        return {"status": "completed", "run_id": 44, "extraction_count": 1}

    monkeypatch.setattr(source_reingest, "upload_private_object", fake_upload)
    monkeypatch.setattr(source_reingest, "execute_offer_source_reparse", fake_reparse)

    archive_buffer = BytesIO()
    with zipfile.ZipFile(archive_buffer, "w") as archive:
        archive.writestr(
            "Inbox/2.1 BRONIFER 13131/manual-offer.eml",
            b"Subject: Manual selected offer\n\nDisponibile",
        )
    archive_buffer.seek(0)

    client = TestClient(app)
    response = client.post(
        "/v1/remediation/offer-source-reingest-batch",
        data={
            "owner_id": "f45fab6e-3da8-41aa-8711-fc1b337a7dde",
            "manifest": json.dumps(
                [
                    {
                        "reingest_id": 52,
                        "expected_source_filename":
                            "Inbox/2.1 BRONIFER 13131/manual-offer.eml",
                    }
                ]
            ),
        },
        files={"upload": ("archive.zip", archive_buffer, "application/zip")},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["recovered"] == 1
    assert body["failed"] == 0
    assert body["automatic_ambiguous_selection"] is False
    assert repo.completed[0]["filename"] == "manual-offer.eml"
