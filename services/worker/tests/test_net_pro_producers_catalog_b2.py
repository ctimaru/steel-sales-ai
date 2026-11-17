"""NET-PRO-PRODUCERS1 B2: private catalogue grants and no-publication bridge."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
import hashlib
from pathlib import Path

import pytest

from app.net_pro_producers_catalog_b1 import CatalogueRejected
from app.net_pro_producers_catalog_b2 import stage_authorised_document

ROOT = Path(__file__).resolve().parents[3]
SQL = (ROOT / "supabase/migrations" /
       "20261117175000_net_pro_producers1_b2_catalog_grants.sql").read_text()

COMPANY = "00000000-0000-4000-8000-000000000001"
CATALOG = "00000000-0000-4000-8000-000000000002"
NOW = datetime(2026, 11, 17, 16, 0, tzinfo=timezone.utc)
SOURCE = "https://www.tubificio.example/catalogo.csv"


def fixture_csv(n=3):
    return ("standard,grade,shape,dimensions_mm\n" + "\n".join(
        f"EN 10219,S355J2H,RHS,{200 + k}x100x6" for k in range(n)
    ) + "\n").encode("utf-8")


def fixture_manifest(data, fmt="csv"):
    return {
        "company_id": COMPANY,
        "catalog_id": CATALOG,
        "source_url": SOURCE,
        "edition": "2026.1",
        "format": fmt,
        "sha256": hashlib.sha256(data).hexdigest(),
    }


def make_grant(manifest):
    return {
        "company_id": COMPANY, "catalog_id": CATALOG,
        "source_url": SOURCE, "sha256": manifest["sha256"],
        "status": "approved",
        "rights": ["extract", "store_derived", "use_in_producer_search"],
        "verified_at": (NOW - timedelta(days=1)).isoformat(),
        "expires_at": (NOW + timedelta(days=30)).isoformat(),
        "revoked_at": None,
    }


class FakeServiceDb:
    """Only fake the trusted RPC transport; SQL contract is asserted separately."""
    def __init__(self, grant):
        self.grant = grant
        self.calls = []
        self.staged = set()
        self.closed = False

    def rpc(self, name, args):
        assert name == "netproducers1_b2_catalog"
        op, payload = args["p_operation"], args["p_payload"]
        assert op in ("get", "stage")
        self.calls.append((op, payload))
        if op == "get":
            if self.closed:
                raise ValueError("Revoked")
            data = {"contract": "netproducers-b2-v1", "grant": self.grant}
        else:
            if self.closed:
                raise ValueError("Revoked after grant read")
            assert payload["sha256"] == self.grant["sha256"]
            assert payload["company_id"] == self.grant["company_id"]
            assert payload["catalog_id"] == self.grant["catalog_id"]
            assert len(payload["candidates"]) <= 50
            added = replayed = 0
            for row in payload["candidates"]:
                assert row["document_sha256"] == self.grant["sha256"]
                assert row["evidence_status"] == "pending_verification"
                assert row["source_url"] == SOURCE
                assert row["company_id"] == COMPANY
                assert row["catalog_id"] == CATALOG
                key = (row["catalog_id"], row["source_locator"])
                if key in self.staged:
                    replayed += 1
                else:
                    added += 1
                    self.staged.add(key)
            data = {
                "contract": "netproducers-b2-v1", "status": "staged",
                "added": added, "replayed": replayed, "published_claims": 0,
            }

        class Response:
            def execute(self):
                self.data = data
                return self

        return Response()


def test_b2_bridge_stages_bounded_candidates_and_is_idempotent():
    raw = fixture_csv(105)
    manifest = fixture_manifest(raw)
    db = FakeServiceDb(make_grant(manifest))
    first = stage_authorised_document(db, manifest, raw, now=NOW)
    assert (first["candidate_rows"], first["staged"], first["replayed"]) == (105, 105, 0)
    assert len([call for call in db.calls if call[0] == "stage"]) == 3
    assert len(db.staged) == 105
    second = stage_authorised_document(db, manifest, raw, now=NOW)
    assert (second["staged"], second["replayed"]) == (0, 105)
    assert first["published_claims"] == second["published_claims"] == 0


@pytest.mark.parametrize("tamper", ["company","sha","rights","expiry","revocation"])
def test_b2_fails_closed_on_fake_or_revoked_grant(tamper):
    raw = fixture_csv()
    manifest = fixture_manifest(raw)
    grant = make_grant(manifest)
    if tamper == "company":
        grant["company_id"] = "00000000-0000-4000-8000-000000000003"
    elif tamper == "sha":
        grant["sha256"] = "0" * 64
    elif tamper == "rights":
        grant["rights"] = ["link_only"]
    elif tamper == "expiry":
        grant["expires_at"] = (NOW - timedelta(days=1)).isoformat()
    else:
        grant["revoked_at"] = NOW.isoformat()
    db = FakeServiceDb(grant)
    with pytest.raises((CatalogueRejected, ValueError)):
        stage_authorised_document(db, manifest, raw, now=NOW)
    assert all(call[0] != "stage" for call in db.calls)


def test_b2_revocation_between_read_and_write_stops_stage():
    raw = fixture_csv()
    manifest = fixture_manifest(raw)
    db = FakeServiceDb(make_grant(manifest))
    orig_rpc = db.rpc

    def revoke_between_calls(name, args):
        if args["p_operation"] == "stage":
            db.closed = True
        return orig_rpc(name, args)

    db.rpc = revoke_between_calls
    with pytest.raises(ValueError, match="Revoked"):
        stage_authorised_document(db, manifest, raw, now=NOW)
    assert not db.staged


def test_b2_authorized_pdf_never_calls_staging():
    pdf = b"%PDF-1.7\n%%EOF\n"
    manifest = fixture_manifest(pdf, "pdf")
    db = FakeServiceDb(make_grant(manifest))
    result = stage_authorised_document(db, manifest, pdf, now=NOW)
    assert result["status"] == "licensed_pdf_not_parsed"
    assert result["staged"] == result["db_writes"] == result["published_claims"] == 0
    assert [op for op, _ in db.calls] == ["get"]


def test_b2_bridge_not_authorized_by_manifest_flag():
    raw = fixture_csv()
    manifest = fixture_manifest(raw)
    manifest["owner_approved"] = True
    db = FakeServiceDb(None)
    with pytest.raises(CatalogueRejected):
        stage_authorised_document(db, manifest, raw, now=NOW)
    assert len(db.calls) == 1


def test_b2_sql_tables_are_private_rls_and_no_browser_access():
    for table in ("network_producer_catalog_grants",
                  "network_producer_catalog_candidate_rows",
                  "network_producer_catalog_events"):
        assert f"create table private.{table}" in SQL
        assert f"alter table private.{table} enable row level security;" in SQL
        assert (f"revoke all on private.{table} from "
                "public,anon,authenticated,service_role;") in SQL
    assert "grant select on private.network_producer_catalog_grants to service_role" not in SQL
    assert "grant select on private.network_producer_catalog_candidate_rows to service_role" not in SQL
    assert "grant select on private.network_producer_catalog_events to service_role" not in SQL
    assert "grant execute on function public.netproducers1_b2_catalog(text,jsonb) to service_role" in SQL
    assert "revoke all on function public.netproducers1_b2_catalog(text,jsonb)" in SQL
    assert "from public,anon,authenticated;" in SQL
    assert SQL.count("security definer set search_path=''") == 2
    assert "create trigger netproducers1_b2_events_immutable" in SQL
    assert "before update or delete" in SQL
    assert "no migration of link_only records" in SQL
    assert "grant all on private.network_producer_catalog" not in SQL.lower()


def test_b2_sql_requires_provenance_and_refuses_cross_source_and_upgrade():
    assert "foreign key (catalog_id,company_id,document_sha256)" in SQL
    assert "unique (catalog_id,source_locator)" in SQL
    assert "network_producer_catalog_grants_one_active_source" in SQL
    assert "split_part(v_grant.source_url,'/',3)" in SQL
    assert "where status='approved'" in SQL
    for required in (
        "verification_reference", "verification_method",
        "producer_signed_license", "verified_company_authorization",
        "revoked_at", "expires_at", "p_payload->'rights'",
        "service_role", "source_locator", "document_sha256",
        "Cross-source or unverified candidate rejected",
        "Conflicting or stale catalog row cannot be overwritten",
        "status='revoked',revoked_at=v_now",
        "evidence_status='stale'",
        "'pending_verification'", "'published_claims',0",
    ):
        assert required in SQL
    assert "v_item->>'source_url' is distinct from v_grant.source_url" in SQL
    assert "p_payload->>'sha256' is distinct from v_grant.document_sha256" in SQL
    assert "on conflict (catalog_id) do nothing" in SQL
    assert "on conflict (catalog_id,source_locator) do nothing" in SQL


def test_b2_no_automatic_prod_or_legacy_link_escalation():
    assert "insert into private.network_producer_catalog_links" not in SQL.lower()
    assert "update private.network_producer_catalog_links" not in SQL.lower()
    assert "network_producer_technical_claims" not in SQL.lower()
    assert "create policy" not in SQL.lower()  # no browser access path
    assert "copy " not in SQL.lower()
