"""B3.B — licensed PDF extraction is isolated, private and never a claim."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
import hashlib
import io
from pathlib import Path

import pytest
from pypdf import PdfWriter
from pypdf.generic import (
    DecodedStreamObject, DictionaryObject, NameObject,
)

from app.net_pro_producers_catalog_b1 import CatalogueRejected
from app.net_pro_producers_catalog_b3b_pdf import (
    _candidate_rows, _read_pdf_lines, stage_authorised_pdf,
)

ROOT = Path(__file__).resolve().parents[3]
SQL = (ROOT / "supabase/migrations" /
       "20261118123000_net_pro_producers1_b3b_pdf_candidates.sql").read_text()
COMPANY = "00000000-0000-4000-8000-000000000001"
CATALOG = "00000000-0000-4000-8000-000000000002"
SOURCE = "https://tubificio.example/catalogue.pdf"
NOW = datetime(2026, 11, 18, 12, 0, tzinfo=timezone.utc)
TECH = "EN 10219 | S355J2H | RHS | 200x100x6"


def pdf_bytes(lines: list[str] | None = None, *, encrypted=False) -> bytes:
    """Create a real simple PDF with pypdf; no reportlab test dependency."""
    writer = PdfWriter()
    page = writer.add_blank_page(width=595, height=842)
    if lines:
        font = DictionaryObject({
            NameObject("/Type"): NameObject("/Font"),
            NameObject("/Subtype"): NameObject("/Type1"),
            NameObject("/BaseFont"): NameObject("/Helvetica"),
        })
        font_ref = writer._add_object(font)
        page[NameObject("/Resources")] = DictionaryObject({
            NameObject("/Font"): DictionaryObject({
                NameObject("/F1"): font_ref,
            }),
        })
        commands = ["BT /F1 10 Tf 50 750 Td"]
        for i, line in enumerate(lines):
            # Every fixture character is ASCII and parenthesis-free.
            assert line.isascii() and "(" not in line and ")" not in line
            if i:
                commands.append("0 -22 Td")
            commands.append(f"({line}) Tj")
        commands.append("ET")
        stream = DecodedStreamObject()
        stream.set_data(" ".join(commands).encode("ascii"))
        page[NameObject("/Contents")] = writer._add_object(stream)
    if encrypted:
        writer.encrypt("company-password")
    out = io.BytesIO()
    writer.write(out)
    return out.getvalue()


def manifest(content: bytes):
    return {
        "company_id": COMPANY, "catalog_id": CATALOG,
        "source_url": SOURCE, "edition": "2026.1",
        "format": "pdf", "sha256": hashlib.sha256(content).hexdigest(),
    }


class FakeDB:
    def __init__(self, meta):
        self.meta = meta
        self.grant = {
            "company_id": COMPANY, "catalog_id": CATALOG,
            "source_url": SOURCE, "sha256": meta["sha256"],
            "format": "pdf", "status": "approved",
            "rights": ["extract", "store_derived", "use_in_producer_search"],
            "verified_at": (NOW-timedelta(hours=1)).isoformat(),
            "expires_at": (NOW+timedelta(days=30)).isoformat(),
            "revoked_at": None,
        }
        self.stored = {}
        self.calls = []
        self.revoke_before_stage = False

    def rpc(self, name, args):
        operation, payload = args["p_operation"], args["p_payload"]
        self.calls.append((name, operation))
        if name == "netproducers1_b2_catalog":
            assert operation == "get"
            assert payload["company_id"] == COMPANY
            assert payload["catalog_id"] == CATALOG
            result = {"contract": "netproducers-b2-v1", "grant": self.grant}
        elif name == "netproducers1_b3b_pdf_catalog":
            assert operation == "stage"
            if self.revoke_before_stage or self.grant["status"] != "approved":
                raise PermissionError("grant revoked")
            assert payload["sha256"] == self.meta["sha256"]
            assert len(payload["candidates"]) <= 50
            added = replayed = 0
            for row in payload["candidates"]:
                assert row["catalog_id"] == CATALOG
                assert row["company_id"] == COMPANY
                assert row["source_url"] == SOURCE
                assert row["edition"] == self.meta["edition"]
                assert row["evidence_status"] == "pending_verification"
                assert row["interpretation"] == "pdf_extracted_exact_line_candidate"
                assert row["document_sha256"] == self.meta["sha256"]
                assert row["source_locator"] == (
                    f"pdf_page:{row['source_page']}:line:{row['source_line']}"
                )
                assert len(row["source_line_sha256"]) == 64
                previous = self.stored.get(row["source_locator"])
                if previous is not None:
                    assert previous == row
                    replayed += 1
                else:
                    self.stored[row["source_locator"]] = row
                    added += 1
            result = {
                "contract": "netproducers-b3b-v1",
                "status": "staged", "added": added,
                "replayed": replayed, "published_claims": 0,
            }
        else:
            raise AssertionError(name)

        class Response:
            def execute(self):
                self.data = result
                return self
        return Response()


def test_actual_pdf_subprocess_extracts_page_line_and_exact_dimensions():
    raw = pdf_bytes([TECH, "EN 10219 | S355J2H | RHS | 100-200x100x6"])
    pages = _read_pdf_lines(raw)
    assert len(pages) == 1 and pages[0]["page"] == 1
    assert any(TECH in row for row in pages[0]["lines"])
    candidates, ignored = _candidate_rows(pages, manifest(raw), manifest(raw)["sha256"])
    assert len(candidates) == 1
    item = candidates[0]
    assert item["standard"] == "EN10219"
    assert item["grade"] == "S355J2H"
    assert item["shape"] == "RHS"
    assert item["dimensions_mm"] == [200, 100, 6]
    assert item["source_locator"].startswith("pdf_page:1:line:")
    assert ignored >= 1


def test_pdf_intake_private_staging_idempotent_with_real_pdf():
    raw = pdf_bytes([TECH])
    meta = manifest(raw)
    db = FakeDB(meta)
    first = stage_authorised_pdf(db, meta, raw, now=NOW)
    assert first["status"] == "pending_private_pdf_candidates"
    assert first["candidate_rows"] == first["staged"] == 1
    assert first["source_verified"] == first["manufacturer_confirmed"] == 0
    assert first["published_claims"] == 0
    assert len(db.stored) == 1
    second = stage_authorised_pdf(db, meta, raw, now=NOW)
    assert second["staged"] == 0 and second["replayed"] == 1
    assert len(db.stored) == 1


def test_no_join_of_separate_pdf_lines_or_ranges():
    raw = pdf_bytes(["EN 10219 | S355J2H | RHS | ",
                     "200x100x6", "EN 10219 | S355J2H | RHS | 100-200x100x6"])
    meta = manifest(raw)
    result = stage_authorised_pdf(FakeDB(meta), meta, raw, now=NOW)
    assert result["status"] == "no_exact_pdf_lines"
    assert result["candidate_rows"] == result["published_claims"] == 0


def test_scanned_like_blank_pdf_reports_no_exact_lines():
    raw = pdf_bytes()
    result = stage_authorised_pdf(FakeDB(manifest(raw)), manifest(raw), raw, now=NOW)
    assert result["status"] == "no_exact_pdf_lines"
    assert result["candidate_rows"] == 0


@pytest.mark.parametrize("bad", ["encrypted", "malformed", "sha", "rights", "expired", "wrong_format"])
def test_pdf_fails_closed(bad):
    raw = pdf_bytes([TECH], encrypted=bad == "encrypted")
    meta = manifest(raw)
    db = FakeDB(meta)
    if bad == "malformed":
        raw = b"%PDF-1.7\nbad non-PDF stream"
        meta = manifest(raw)
        db = FakeDB(meta)
    if bad == "sha":
        meta["sha256"] = "a" * 64
    if bad == "rights":
        db.grant["rights"] = ["link_only"]
    if bad == "expired":
        db.grant["expires_at"] = (NOW-timedelta(days=1)).isoformat()
    if bad == "wrong_format":
        meta["format"] = "csv"
    with pytest.raises(CatalogueRejected):
        stage_authorised_pdf(db, meta, raw, now=NOW)
    assert not db.stored


def test_pdf_grant_revoked_before_stage_fails_closed():
    raw = pdf_bytes([TECH])
    meta = manifest(raw)
    db = FakeDB(meta)
    db.revoke_before_stage = True
    with pytest.raises(PermissionError, match="revoked"):
        stage_authorised_pdf(db, meta, raw, now=NOW)
    assert not db.stored


def test_pdf_rows_only_from_same_page_and_exact_delimited_line():
    meta = manifest(b"%PDF-1.7")
    pages = [
        {"page": 1, "lines": [
            "EN 10219", "S355J2H", "RHS", "200x100x6",
            "EN 10219 | S355J2H | RHS | 200x100x6 extra",
            "EN 10219 | S355J2H | RHS | 200x100x6",
        ]},
        {"page": 2, "lines": ["EN 10210;S355J2H;SHS;100x100x5"]},
    ]
    candidates, _ = _candidate_rows(pages, meta, meta["sha256"])
    assert len(candidates) == 2
    assert candidates[0]["source_locator"] == "pdf_page:1:line:6"
    assert candidates[1]["source_locator"] == "pdf_page:2:line:1"


def test_malformed_pdf_bounds_and_oversized_inputs_rejected():
    with pytest.raises(CatalogueRejected):
        _read_pdf_lines(b"not-pdf")
    with pytest.raises(CatalogueRejected):
        _read_pdf_lines(b"%PDF-1.7" + b"X" * (8 * 1024 * 1024))
    with pytest.raises(CatalogueRejected):
        _candidate_rows(
            [{"page": 1, "lines": [TECH] * 151}],
            manifest(b"%PDF-1.7"), "a" * 64,
        )


def test_pdf_sql_denies_public_and_requires_current_rights():
    for table in ("network_producer_catalog_pdf_candidates",
                  "network_producer_catalog_pdf_events"):
        assert f"create table private.{table}" in SQL
        assert f"alter table private.{table} enable row level security" in SQL
    for required in (
        "from public,anon,authenticated,service_role;",
        "grant execute on function public.netproducers1_b3b_pdf_catalog(text,jsonb)",
        "to service_role;",
        "revoke all on function public.netproducers1_b3b_pdf_catalog(text,jsonb)",
        "v_grant.document_format<>'pdf'",
        "v_grant.status<>'approved'",
        "v_grant.expires_at<=v_now",
        "after update of status on private.network_producer_catalog_grants",
        "evidence_status='stale', updated_at=now()",
        "v_present.source_line_sha256 is distinct from v_line_sha",
        "v_item->>'edition' is distinct from v_grant.edition",
        "v_item->>'source_url' is distinct from v_grant.source_url",
        "published_claims',0",
        "'pending_verification'",
    ):
        assert required in SQL
    assert "create policy" not in SQL.lower()
    assert "insert into public." not in SQL.lower()
    assert "network_producer_technical_claims" not in SQL.lower()
    assert "network_producer_catalog_links" not in SQL.lower()
