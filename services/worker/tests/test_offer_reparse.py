import asyncio
import hashlib
from types import SimpleNamespace

import app.offer_reparse as offer_reparse


class FakeRepo:
    def __init__(self):
        self.failed = []
        self.completed = []

    async def claim_offer_source_reparse_run(self, run_id):
        return {
            "status": "claimed",
            "run_id": run_id,
            "source_storage_path": "2026/09/22/source.eml",
            "source_checksum": hashlib.sha256(b"Subject: Offer\n\nP265GH 406,4x6,3x12000 EUR 68,38/mt").hexdigest(),
            "requested_parser_version": "v4",
            "source_snapshot": {
                "filename": "source.eml",
                "extension": ".eml",
                "size_bytes": len(b"Subject: Offer\n\nP265GH 406,4x6,3x12000 EUR 68,38/mt"),
            },
        }

    async def complete_offer_source_reparse_run(self, *, run_id, candidates):
        self.completed.append((run_id, candidates))
        return {"status": "completed", "run_id": run_id, "candidate_count": len(candidates)}

    async def fail_offer_source_reparse_run(self, *, run_id, error):
        self.failed.append((run_id, error))
        return {"status": "failed", "run_id": run_id}


def test_pa228_reparse_verifies_source_and_persists_candidates(monkeypatch):
    repo = FakeRepo()
    payload = b"Subject: Offer\n\nP265GH 406,4x6,3x12000 EUR 68,38/mt"

    monkeypatch.setattr(offer_reparse, "WorkerRepository", lambda: repo)

    async def fake_download(*, storage_path):
        assert storage_path == "2026/09/22/source.eml"
        return payload

    monkeypatch.setattr(offer_reparse, "download_private_object", fake_download)

    result = asyncio.run(offer_reparse.execute_offer_source_reparse(7))

    assert result["status"] == "completed"
    assert result["source_checksum_verified"] is True
    assert result["parser_version"] == "v4"
    assert result["extraction_count"] >= 1
    assert repo.completed
    assert repo.failed == []


def test_pa228_checksum_mismatch_marks_run_failed(monkeypatch):
    repo = FakeRepo()

    async def bad_claim(run_id):
        claim = await FakeRepo.claim_offer_source_reparse_run(repo, run_id)
        claim["source_checksum"] = "0" * 64
        return claim

    repo.claim_offer_source_reparse_run = bad_claim
    monkeypatch.setattr(offer_reparse, "WorkerRepository", lambda: repo)

    async def fake_download(*, storage_path):
        return b"changed payload"

    monkeypatch.setattr(offer_reparse, "download_private_object", fake_download)

    try:
        asyncio.run(offer_reparse.execute_offer_source_reparse(9))
        assert False, "checksum mismatch must fail"
    except ValueError as exc:
        assert "checksum mismatch" in str(exc).lower()

    assert repo.failed
    assert repo.failed[0][0] == 9


def test_pa228_nonclaimable_run_does_not_touch_storage(monkeypatch):
    class NonClaimableRepo(FakeRepo):
        async def claim_offer_source_reparse_run(self, run_id):
            return {"status": "not_claimable", "run_id": run_id, "run_status": "completed"}

    repo = NonClaimableRepo()
    monkeypatch.setattr(offer_reparse, "WorkerRepository", lambda: repo)

    async def should_not_download(*, storage_path):
        raise AssertionError("storage must not be read for a non-claimable run")

    monkeypatch.setattr(offer_reparse, "download_private_object", should_not_download)

    result = asyncio.run(offer_reparse.execute_offer_source_reparse(11))
    assert result["status"] == "not_claimable"
    assert repo.completed == []
    assert repo.failed == []


def test_pa2301_bootstrap_run_ids_are_explicit_unique_and_bounded():
    assert offer_reparse._bootstrap_run_ids(None) == []
    assert offer_reparse._bootstrap_run_ids("") == []
    assert offer_reparse._bootstrap_run_ids("3,4,4, 5") == [3, 4, 5]

    for raw in ("0", "-1", "3,nope"):
        try:
            offer_reparse._bootstrap_run_ids(raw)
            assert False, "invalid explicit run ids must fail closed"
        except ValueError:
            pass

    try:
        offer_reparse._bootstrap_run_ids(",".join(str(i) for i in range(1, 102)))
        assert False, "bootstrap batch must remain bounded"
    except ValueError:
        pass


def test_pa2301_explicit_batch_continues_after_one_run_fails(monkeypatch):
    calls = []

    async def fake_execute(run_id):
        calls.append(run_id)
        if run_id == 4:
            raise ValueError("synthetic failure")
        return {"status": "completed", "run_id": run_id, "extraction_count": 1}

    monkeypatch.setattr(offer_reparse, "execute_offer_source_reparse", fake_execute)
    asyncio.run(offer_reparse.execute_explicit_offer_reparse_batch([3, 4, 5]))

    assert calls == [3, 4, 5]
