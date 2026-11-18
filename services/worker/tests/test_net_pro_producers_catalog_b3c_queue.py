"""NET-PRO-PRODUCERS B3.C1: private queue guarantees no inferred production."""
from __future__ import annotations

import asyncio
import hashlib
from pathlib import Path
from uuid import uuid4

import pytest

from app import net_pro_producers_catalog_b3c_queue as c1

ROOT = Path(__file__).resolve().parents[3]
SQL = (ROOT / "supabase/migrations" /
       "20261118130000_net_pro_producers1_b3c_trusted_intake_queue.sql").read_text()
COMPANY = str(uuid4())
CATALOG = str(uuid4())
JOB = str(uuid4())
LEASE = str(uuid4())
CONTENT = (b"standard,grade,shape,dimensions_mm\n"
           b"EN 10219,S355J2H,RHS,200x100x6\n")
SHA = hashlib.sha256(CONTENT).hexdigest()
PATH = f"{COMPANY}/{CATALOG}/{SHA}.csv"


def lease(format_="csv"):
    return {
        "job_id": JOB, "lease_token": LEASE,
        "catalog_id": CATALOG, "company_id": COMPANY,
        "sha256": SHA, "format": format_,
        "source_url": "https://firstparty.example/cat.csv",
        "edition": "2026",
        "object_bucket": c1.BUCKET,
        "object_path": f"{COMPANY}/{CATALOG}/{SHA}.{format_}",
    }


class FakeDB:
    def __init__(self, items):
        self.items = items
        self.operations = []
        self.error_codes = []

    def rpc(self, name, args):
        op = args["p_operation"]
        data = args["p_payload"]
        self.operations.append((name, op))
        if name != c1.QUEUE_NAME:
            raise AssertionError(name)
        if op == "claim":
            assert 1 <= data["limit"] <= 3
            payload = {
                "contract": c1.QUEUE_CONTRACT,
                "status": "claimed",
                "count": len(self.items),
                "items": self.items,
                "published_claims": 0,
            }
        elif op == "complete":
            assert data["lease_token"] == LEASE
            assert data["catalog_id"] == CATALOG
            assert data["company_id"] == COMPANY
            assert data["candidate_rows"] >= 0
            payload = {
                "contract": c1.QUEUE_CONTRACT,
                "status": "completed", "published_claims": 0,
            }
        elif op == "fail":
            assert data["lease_token"] == LEASE
            self.error_codes.append(data["error_code"])
            payload = {
                "contract": c1.QUEUE_CONTRACT,
                "status": "failure_recorded", "published_claims": 0,
            }
        else:
            raise AssertionError(op)

        class Reply:
            def execute(self):
                self.data = payload
                return self
        return Reply()


def test_empty_queue_is_a_real_zero_canary():
    db = FakeDB([])
    result = asyncio.run(c1.drain_authorised_catalogues(db, limit=2))
    assert result["jobs_claimed"] == result["jobs_completed"] == 0
    assert result["published_claims"] == result["manufacturer_confirmed"] == 0
    assert db.operations == [(c1.QUEUE_NAME, "claim")]


def test_queue_consumes_only_verified_bytes_and_reports_private_candidates(monkeypatch):
    db = FakeDB([lease()])

    async def fake_download(item):
        assert item["object_path"] == PATH
        assert item["object_bucket"] == "producer-authorized-catalogs"
        return CONTENT

    def fake_verified_csv(client, manifest, content):
        assert client is db
        assert manifest["sha256"] == SHA
        assert manifest["company_id"] == COMPANY
        assert content == CONTENT
        return {
            "candidate_rows": 1, "source_verified": 1,
            "manufacturer_confirmed": 0, "published_claims": 0,
        }

    monkeypatch.setattr(c1, "_download_private_catalogue", fake_download)
    monkeypatch.setattr(c1, "verify_authorised_csv", fake_verified_csv)
    result = asyncio.run(c1.drain_authorised_catalogues(db, limit=2))
    assert result["jobs_claimed"] == result["jobs_completed"] == 1
    assert result["source_verified_csv_rows"] == 1
    assert result["pdf_source_verified_rows"] == 0
    assert db.operations == [
        (c1.QUEUE_NAME, "claim"), (c1.QUEUE_NAME, "complete"),
    ]


def test_ambiguous_pdf_remains_pending_not_manufacturer_confirmed(monkeypatch):
    db = FakeDB([lease("pdf")])
    async def fake_download(item):
        return b"%PDF-1.4"  # file parsing is separately covered by B3.B tests
    def fake_pdf(client, manifest, content):
        assert manifest["format"] == "pdf"
        return {
            "candidate_rows": 3, "source_verified": 0,
            "manufacturer_confirmed": 0, "published_claims": 0,
        }
    monkeypatch.setattr(c1, "_download_private_catalogue", fake_download)
    monkeypatch.setattr(c1, "stage_authorised_pdf", fake_pdf)
    result = asyncio.run(c1.drain_authorised_catalogues(db, limit=1))
    assert result["private_candidate_rows"] == 3
    assert result["source_verified_csv_rows"] == 0
    assert result["pdf_source_verified_rows"] == 0
    assert result["published_claims"] == 0


def test_rejected_pdf_is_retried_without_publishing(monkeypatch):
    db = FakeDB([lease("pdf")])
    async def fail_download(_):
        raise c1.IntakeFailure("size_or_digest")
    monkeypatch.setattr(c1, "_download_private_catalogue", fail_download)
    result = asyncio.run(c1.drain_authorised_catalogues(db))
    assert result["jobs_failed"] == 1 and result["jobs_completed"] == 0
    assert db.error_codes == ["size_or_digest"]
    assert result["published_claims"] == 0


@pytest.mark.parametrize("key,bad", [
    ("object_bucket", "commercial-uploads"),
    ("object_path", "../company/another.pdf"),
    ("format", "exe"),
    ("sha256", "0000"),
    ("lease_token", "not-a-uuid"),
])
def test_forged_queue_lease_fails_closed(key, bad):
    job = lease()
    job[key] = bad
    with pytest.raises(c1.IntakeFailure, match="rpc_rejected"):
        c1._checked_lease(job)


def test_bounded_size_constraints_and_untrusted_urls_not_fetchable():
    with pytest.raises(ValueError):
        asyncio.run(c1.drain_authorised_catalogues(FakeDB([]), limit=30))
    lease_item = lease()
    assert "https://firstparty.example" in lease_item["source_url"]
    # The downloader only constructs a Supabase Storage URL from exact
    # company/catalog/document SHA; never dereferences the source_url.
    import inspect
    source = inspect.getsource(c1._download_private_catalogue)
    assert 'lease["object_path"]' in source
    assert 'lease["source_url"]' not in source
    assert "follow_redirects=False" in source
    assert "trust_env=False" in source
    assert "hashlib.sha256(content).hexdigest()" in source


def test_b3c_schema_private_and_revocation_atomic():
    for name in ("network_producer_catalog_ingest_jobs",
                 "network_producer_catalog_ingest_events"):
        assert f"create table private.{name}" in SQL
        assert f"alter table private.{name} enable row level security" in SQL
    checks = (
        "producer-authorized-catalogs",
        "public,anon,authenticated,service_role",
        "grant execute on function public.netproducers1_b3c_catalog_queue",
        "to service_role",
        "after update of status on private.network_producer_catalog_grants",
        "lease_token=null,lease_until=null",
        "for update of j skip locked",
        "g.status='approved'",
        "g.expires_at>v_now",
        "v_grant.document_sha256",
        "storage.objects",
        "v_path is distinct from v_expected",
        "published_claims',0",
    )
    assert all(c in SQL for c in checks)
    assert "create policy" not in SQL.lower()
    assert "insert into public.network_producer_technical_claims" not in SQL
    assert "link_only" in SQL


def test_pdf_data_cannot_be_mislabeled_as_verified(monkeypatch):
    db=FakeDB([lease("pdf")])
    async def fetch(_):
        return b"%PDF-test"
    def bad_parser(*args,**kwargs):
        return {"candidate_rows":2,"source_verified":2,
                "manufacturer_confirmed":1,"published_claims":0}
    monkeypatch.setattr(c1,"_download_private_catalogue",fetch)
    monkeypatch.setattr(c1,"stage_authorised_pdf",bad_parser)
    report=asyncio.run(c1.drain_authorised_catalogues(db))
    assert report["jobs_failed"]==1
    assert db.error_codes==["rpc_rejected"]
