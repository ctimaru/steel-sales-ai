"""B3.A producer CSV documentary verification: source and rights first."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
import hashlib
from pathlib import Path

import pytest

from app.net_pro_producers_catalog_b1 import CatalogueRejected
from app.net_pro_producers_catalog_b3 import verify_authorised_csv

ROOT = Path(__file__).resolve().parents[3]
SQL = (ROOT / "supabase/migrations" /
       "20261118110000_net_pro_producers1_b3_source_verifications.sql").read_text()
COMPANY = "00000000-0000-4000-8000-000000000001"
CATALOG = "00000000-0000-4000-8000-000000000002"
NOW = datetime(2026, 11, 18, 9, 0, tzinfo=timezone.utc)
SOURCE = "https://tubi.example/producer-2026.csv"


def document(content: bytes, media="csv"):
    return {
        "company_id": COMPANY, "catalog_id": CATALOG,
        "source_url": SOURCE, "format": media, "edition": "2026",
        "sha256": hashlib.sha256(content).hexdigest(),
    }


CSV = (
    "standard,grade,shape,dimensions_mm\n"
    "EN 10219,S355J2H,RHS,200x100x6\n"
    "EN 10219,S355J2H,SHS,100x100x5\n"
    "EN 10210,S355J2H,CHS,Ø608x12\n"
).encode()


class FakeB3ServiceDb:
    def __init__(self, manifest):
        self.manifest = manifest
        self.grant = {
            "company_id": COMPANY, "catalog_id": CATALOG,
            "source_url": SOURCE, "sha256": manifest["sha256"],
            "status": "approved",
            "rights": ["extract", "store_derived", "use_in_producer_search"],
            "verified_at": (NOW-timedelta(hours=1)).isoformat(),
            "expires_at": (NOW+timedelta(days=7)).isoformat(),
            "revoked_at": None,
        }
        self.staged = {}
        self.verified = set()
        self.calls = []
        self.revoked_after_stage = False

    def rpc(self, name, args):
        op = args["p_operation"]
        data = args["p_payload"]
        self.calls.append((name, op))
        if name == "netproducers1_b2_catalog":
            if op == "get":
                payload = {
                    "contract": "netproducers-b2-v1",
                    "grant": self.grant,
                }
            elif op == "stage":
                if self.grant["status"] != "approved":
                    raise PermissionError("revoked")
                added = replayed = 0
                for c in data["candidates"]:
                    assert c["company_id"] == COMPANY and c["catalog_id"] == CATALOG
                    assert c["document_sha256"] == self.manifest["sha256"]
                    assert c["evidence_status"] == "pending_verification"
                    key = c["source_locator"]
                    if key in self.staged:
                        assert self.staged[key] == c
                        replayed += 1
                    else:
                        self.staged[key] = c
                        added += 1
                payload = {
                    "contract": "netproducers-b2-v1", "status": "staged",
                    "added": added, "replayed": replayed, "published_claims": 0,
                }
                if self.revoked_after_stage:
                    self.grant["status"] = "revoked"
                    self.grant["revoked_at"] = NOW.isoformat()
            else:
                raise AssertionError(op)
        elif name == "netproducers1_b3_catalog_verify":
            assert op == "verify"
            if self.grant["status"] != "approved":
                raise PermissionError("revoked")
            assert data["company_id"] == COMPANY and data["catalog_id"] == CATALOG
            assert data["sha256"] == self.manifest["sha256"]
            assert 1 <= len(data["rows"]) <= 50
            new = replayed = 0
            for c in data["rows"]:
                assert self.staged[c["source_locator"]] == c
                key = c["source_locator"]
                if key in self.verified:
                    replayed += 1
                else:
                    new += 1
                    self.verified.add(key)
            payload = {
                "contract": "netproducers-b3-v1", "status": "source_verified",
                "verified": new, "replayed": replayed, "published_claims": 0,
                "manufacturer_confirmed": 0,
            }
        else:
            raise AssertionError(name)

        class Response:
            def execute(self):
                self.data = payload
                return self
        return Response()


def test_b3_authorised_exact_rows_are_verified_and_replay_safe():
    manifest = document(CSV)
    db = FakeB3ServiceDb(manifest)
    first = verify_authorised_csv(db, manifest, CSV, now=NOW)
    assert first["source_verified"] == 3
    assert first["replayed"] == first["manufacturer_confirmed"] == first["published_claims"] == 0
    assert len(db.staged) == len(db.verified) == 3
    second = verify_authorised_csv(db, manifest, CSV, now=NOW)
    assert second["source_verified"] == 0
    assert second["replayed"] == 3
    assert first["status"] == "source_rows_verified"


def test_b3_never_combines_attributes_across_source_rows_or_ranges():
    content = (
        "standard,grade,shape,dimensions_mm\n"
        "EN 10219,S355J2H,RHS,\n"
        ",,RHS,200x100x6\n"
        "EN 10219,S355J2H,RHS,100-200x100x6\n"
        "EN 10219,S355J2H,RHS,200x100x6\n"
    ).encode()
    manifest = document(content)
    db = FakeB3ServiceDb(manifest)
    result = verify_authorised_csv(db, manifest, content, now=NOW)
    assert result["rejected_rows"] == 3
    assert result["candidate_rows"] == result["source_verified"] == 1
    assert list(db.staged) == ["csv_row:5"]


@pytest.mark.parametrize("kind", ["pdf", "bad_sha", "expired", "link_only"])
def test_b3_has_no_pdf_fallback_and_no_rights_escalation(kind):
    content = CSV if kind != "pdf" else b"%PDF-1.7\n%%EOF\n"
    manifest = document(content, "pdf" if kind == "pdf" else "csv")
    db = FakeB3ServiceDb(manifest)
    if kind == "bad_sha":
        manifest["sha256"] = "0" * 64
    if kind == "expired":
        db.grant["expires_at"] = (NOW-timedelta(days=1)).isoformat()
    if kind == "link_only":
        db.grant["rights"] = ["link_only"]
    with pytest.raises(CatalogueRejected):
        verify_authorised_csv(db, manifest, content, now=NOW)
    assert len(db.verified) == 0


def test_b3_no_exact_rows_reports_zero_evidence_without_stage_or_verify():
    content = (
        "standard,grade,shape,dimensions_mm\n"
        "EN 10219,S355J2H,RHS,100-200x100x6\n"
    ).encode()
    manifest = document(content)
    db = FakeB3ServiceDb(manifest)
    result = verify_authorised_csv(db, manifest, content, now=NOW)
    assert result["status"] == "no_exact_source_rows"
    assert result["source_verified"] == result["published_claims"] == 0
    assert db.staged == {}
    assert all(op == "get" for _, op in db.calls)


def test_b3_revocation_between_staging_and_verification_fails_closed():
    manifest = document(CSV)
    db = FakeB3ServiceDb(manifest)
    db.revoked_after_stage = True
    with pytest.raises(PermissionError, match="revoked"):
        verify_authorised_csv(db, manifest, CSV, now=NOW)
    assert db.verified == set()


def test_b3_database_is_private_and_revocation_atomic():
    for table in (
        "network_producer_catalog_verifications",
        "network_producer_catalog_verification_events",
    ):
        assert f"create table private.{table}" in SQL
        assert f"alter table private.{table} enable row level security" in SQL
    assert "from public,anon,authenticated,service_role;" in SQL
    assert "grant execute on function public.netproducers1_b3_catalog_verify(text,jsonb) to service_role;" in SQL
    assert "revoke all on function public.netproducers1_b3_catalog_verify(text,jsonb)" in SQL
    assert "after update of status on private.network_producer_catalog_grants" in SQL
    assert "evidence_status='stale', stale_at=now()" in SQL
    assert "v_grant.expires_at<=v_now" in SQL
    assert "v_grant.status<>'approved'" in SQL
    assert "c.evidence_status='pending_verification'" in SQL
    assert "c.source_locator=v_item->>'source_locator'" in SQL
    assert "v_row.dimensions_mm is distinct from v_item->'dimensions_mm'" in SQL
    assert "create policy" not in SQL.lower()
    assert "insert into private.network_producer_technical_claims" not in SQL.lower()
    assert "insert into public." not in SQL.lower()
    assert "pdf" in SQL.lower()  # documented as excluded
