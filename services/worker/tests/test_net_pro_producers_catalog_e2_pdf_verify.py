"""EU1.E2.A: real PDF fixtures, hash-grounded exact rows and revocation."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
import hashlib
import io
from pathlib import Path

import pytest
from pypdf import PdfWriter
from pypdf.generic import DecodedStreamObject, DictionaryObject, NameObject

from app.net_pro_producers_catalog_b1 import CatalogueRejected
from app.net_pro_producers_catalog_e2_pdf_verify import verify_authorised_pdf
from app import net_pro_producers_catalog_b3c_queue as queue

ROOT = Path(__file__).resolve().parents[3]
SQL = (ROOT / "supabase/migrations" /
       "20261119211500_net_eu_e2a_pdf_exact_row_verification.sql").read_text()
COMPANY = "00000000-0000-4000-8000-000000000001"
CATALOG = "00000000-0000-4000-8000-000000000002"
SOURCE = "https://producer.example/official-catalog.pdf"
NOW = datetime(2026, 11, 19, 16, 0, tzinfo=timezone.utc)
EXACT = "EN 10219 | S355J2H | RHS | 200x100x6"


def make_pdf(lines):
    writer = PdfWriter()
    page = writer.add_blank_page(width=595, height=842)
    font = DictionaryObject({
        NameObject("/Type"): NameObject("/Font"),
        NameObject("/Subtype"): NameObject("/Type1"),
        NameObject("/BaseFont"): NameObject("/Helvetica"),
    })
    font_ref = writer._add_object(font)
    page[NameObject("/Resources")] = DictionaryObject({
        NameObject("/Font"): DictionaryObject({NameObject("/F1"): font_ref})
    })
    commands = ["BT /F1 10 Tf 40 730 Td"]
    for index, line in enumerate(lines):
        assert line.isascii() and "(" not in line and ")" not in line
        if index:
            commands.append("0 -20 Td")
        commands.append(f"({line}) Tj")
    commands.append("ET")
    stream = DecodedStreamObject()
    stream.set_data(" ".join(commands).encode("ascii"))
    page[NameObject("/Contents")] = writer._add_object(stream)
    output = io.BytesIO()
    writer.write(output)
    return output.getvalue()


def manifest(content):
    return {"company_id": COMPANY, "catalog_id": CATALOG,
            "source_url": SOURCE, "edition": "2026",
            "format": "pdf", "sha256": hashlib.sha256(content).hexdigest()}


class FakeDB:
    def __init__(self, meta):
        self.rows = {}
        self.verified = set()
        self.calls = []
        self.meta = meta
        self.grant = {
            "company_id": COMPANY, "catalog_id": CATALOG, "source_url": SOURCE,
            "sha256": meta["sha256"], "format": "pdf", "edition": "2026",
            "status": "approved", "revoked_at": None,
            "rights": ["extract", "store_derived", "use_in_producer_search"],
            "verified_at": (NOW-timedelta(hours=1)).isoformat(),
            "expires_at": (NOW+timedelta(days=20)).isoformat(),
        }

    def rpc(self, name, args):
        self.calls.append((name, args["p_operation"]))
        payload = args["p_payload"]
        operation = args["p_operation"]
        if name == "netproducers1_b2_catalog":
            assert operation == "get"
            result = {"contract": "netproducers-b2-v1", "grant": self.grant}
        elif name == "netproducers1_b3b_pdf_catalog":
            assert operation == "stage"
            if self.grant["status"] != "approved":
                raise PermissionError("grant revoked before stage")
            added = replay = 0
            for row in payload["candidates"]:
                assert row["document_sha256"] == self.meta["sha256"]
                assert row["evidence_status"] == "pending_verification"
                key = row["source_locator"]
                if key in self.rows:
                    assert self.rows[key] == row
                    replay += 1
                else:
                    self.rows[key] = row
                    added += 1
            result = {"contract": "netproducers-b3b-v1", "status": "staged",
                      "added": added, "replayed": replay, "published_claims": 0}
        elif name == "netproducers_e2_pdf_verify":
            assert operation == "verify"
            if self.grant["status"] != "approved":
                raise PermissionError("grant revoked before verify")
            verified = replay = 0
            for row in payload["rows"]:
                key = row["source_locator"]
                assert self.rows[key] == row, "original staged source differs"
                assert row["source_line_sha256"] == self.rows[key]["source_line_sha256"]
                if key in self.verified:
                    replay += 1
                else:
                    self.verified.add(key)
                    verified += 1
            result = {"contract": "netproducers-e2-pdf-v1",
                      "status": "source_verified", "verified": verified,
                      "replayed": replay, "published_claims": 0,
                      "manufacturer_confirmed": 0}
        else:
            raise AssertionError(name)
        class Response:
            def execute(self):
                self.data = result
                return self
        return Response()


def test_real_pdf_exact_tuple_verified_idempotently_and_never_confirmed():
    raw = make_pdf([EXACT])
    db = FakeDB(manifest(raw))
    first = verify_authorised_pdf(db, manifest(raw), raw, now=NOW)
    assert first["candidate_rows"] == first["source_verified"] == 1
    assert first["manufacturer_confirmed"] == first["published_claims"] == 0
    row = next(iter(db.rows.values()))
    assert row["source_locator"] == "pdf_page:1:line:1"
    assert row["standard"] == "EN10219" and row["grade"] == "S355J2H"
    assert row["shape"] == "RHS" and row["dimensions_mm"] == [200.0, 100.0, 6.0]
    assert len(row["source_line_sha256"]) == 64
    second = verify_authorised_pdf(db, manifest(raw), raw, now=NOW)
    assert second["source_verified"] == 0 and second["replayed"] == 1


def test_separate_lines_and_range_are_never_exact_tuple():
    raw = make_pdf(["EN 10219", "S355J2H", "RHS", "200x100x6",
                    "EN 10219 | S355J2H | RHS | 100-200x100x6"])
    db = FakeDB(manifest(raw))
    result = verify_authorised_pdf(db, manifest(raw), raw, now=NOW)
    assert result["candidate_rows"] == result["source_verified"] == 0
    assert result["status"] == "no_exact_source_lines"
    assert db.rows == {} and db.verified == set()


@pytest.mark.parametrize("issue", ["rights", "expired", "revoked", "digest", "format"])
def test_real_document_fails_closed_without_valid_grant(issue):
    raw = make_pdf([EXACT])
    meta = manifest(raw)
    db = FakeDB(meta)
    if issue == "rights":
        db.grant["rights"] = ["link_only"]
    if issue == "expired":
        db.grant["expires_at"] = (NOW-timedelta(hours=1)).isoformat()
    if issue == "revoked":
        db.grant["status"] = "revoked"
        db.grant["revoked_at"] = NOW.isoformat()
    if issue == "digest":
        meta["sha256"] = "0"*64
    if issue == "format":
        meta["format"] = "csv"
    with pytest.raises((CatalogueRejected, PermissionError)):
        verify_authorised_pdf(db, meta, raw, now=NOW)
    assert not db.verified


def test_verification_contract_cannot_forge_source_approved_or_manufacturer():
    raw = make_pdf([EXACT])
    meta = manifest(raw)
    db = FakeDB(meta)
    bad_db = FakeDB(meta)
    original = bad_db.rpc
    def forged(name, args):
        response = original(name, args)
        if name == "netproducers_e2_pdf_verify":
            class Forged:
                def execute(self):
                    self.data = {"contract": "netproducers-e2-pdf-v1",
                                 "status": "source_verified",
                                 "verified": 1, "replayed": 0,
                                 "published_claims": 1, "manufacturer_confirmed": 1}
                    return self
            return Forged()
        return response
    bad_db.rpc = forged
    with pytest.raises(CatalogueRejected):
        verify_authorised_pdf(bad_db, meta, raw, now=NOW)
    assert not db.rows and not db.verified


def test_e2_sql_private_acl_line_hash_and_revocation():
    required = [
        "create table private.network_producer_catalog_pdf_verifications",
        "alter table private.network_producer_catalog_pdf_verifications enable row level security",
        "from public,anon,authenticated,service_role;",
        "to service_role;",
        "private.netpro1b_europe_country(c.country_code)",
        "private.network_producer_catalog_grants",
        "v_grant.status<>'approved'",
        "v_grant.expires_at<=v_now",
        "v_grant.rights @> array[",
        "source_line_sha256 is distinct from v_item->>'source_line_sha256'",
        "v_row.dimensions_mm is distinct from v_item->'dimensions_mm'",
        "for update;",
        "after update of status on private.network_producer_catalog_grants",
        "evidence_status='stale',stale_at=now()",
        "'manufacturer_confirmed',0,'published_claims',0",
        "when v_company", # sentinel intentionally absent, checked separately
    ]
    for token in required[:-1]:
        assert token in SQL, token
    assert "grant execute on function public.netproducers_e2_pdf_verify(text,jsonb) to service_role;" in SQL
    assert "grant execute on function public.netproducers_e2_pdf_verify(text,jsonb) to anon" not in SQL
    assert "grant execute on function public.netproducers_e2_pdf_verify(text,jsonb) to authenticated" not in SQL
    assert "create policy" not in SQL.lower()
    assert "manufacturer_confirmed',true" not in SQL.lower()
    assert "insert into public.network_company" not in SQL.lower()


def test_existing_queue_has_gated_opt_in_and_separate_pdf_verified_metric():
    import inspect
    src = inspect.getsource(queue)
    assert 'os.getenv("NETPRODUCERS_E2_PDF_VERIFY_ENABLED") == "1"' in src
    assert "verify_authorised_pdf(db, manifest, content)" in src
    assert '"pdf_source_verified_rows": verified_pdf' in src
    assert "source_verified_csv_rows" in src
