"""B1/A5.6 regression: rights boundary, same-row candidates, HTML SHA diagnostics."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
import hashlib
import json

import pytest

from app.net_pro_producers_catalog_b1 import (
    CatalogueRejected, inspect_authorised_catalogue,
)
from app.net_pro_producers_a56_change import diagnose_first_level_change
from app.net_pro_producers_auto1a53 import fingerprint_technical_rows

COMPANY = "00000000-0000-4000-8000-000000000001"
CATALOG = "00000000-0000-4000-8000-000000000002"
NOW = datetime(2026, 11, 17, 16, 0, tzinfo=timezone.utc)
CSV = (
    "standard,grade,shape,dimensions_mm\n"
    "EN 10219,S355J2H,RHS,200x100x6\n"
    "EN 10219,S355J2H,SHS,100x100x5\n"
    "EN 10210,S355J2H,CHS,Ø608x12\n"
).encode("utf-8")


def make_document(data=CSV, kind="csv"):
    return {
        "company_id": COMPANY, "catalog_id": CATALOG,
        "source_url": "https://tubificio.example/catalogo-2026",
        "edition": "2026", "format": kind,
        "sha256": hashlib.sha256(data).hexdigest(),
    }


def approved_grant(doc):
    return {
        "company_id": COMPANY, "catalog_id": CATALOG,
        "source_url": doc["source_url"], "sha256": doc["sha256"],
        "status": "approved",
        "rights": ["extract", "store_derived", "use_in_producer_search"],
        "verified_at": (NOW - timedelta(days=1)).isoformat(),
        "expires_at": (NOW + timedelta(days=30)).isoformat(),
        "revoked_at": None,
    }


def inspect(data=CSV, *, kind="csv", grant=None, manifest=None):
    doc = manifest or make_document(data, kind)
    grant = approved_grant(doc) if grant is None else grant
    return inspect_authorised_catalogue(
        doc, data, grant_lookup=lambda company, catalog: grant,
        now=NOW,
    )


def test_valid_authorized_csv_retains_row_provenance_but_no_public_claims():
    result = inspect()
    assert result["status"] == "csv_parsed"
    assert result["mode"] == "no_write_private_intake"
    assert result["db_writes"] == result["published_claims"] == 0
    assert len(result["candidates"]) == 3
    c1, c2, c3 = result["candidates"]
    assert (c1["standard"], c1["grade"], c1["shape"]) == ("EN10219", "S355J2H", "RHS")
    assert c1["dimensions_mm"] == [200.0, 100.0, 6.0]
    assert c1["source_locator"] == "csv_row:2"
    assert c2["source_locator"] == "csv_row:3"
    assert c3["dimensions_mm"] == [608.0, 12.0]
    assert all(c["evidence_status"] == "pending_verification" for c in result["candidates"])
    assert all(c["document_sha256"] == result["document_sha256"] for c in result["candidates"])
    assert "verified" not in result["status"]


@pytest.mark.parametrize("change", [
    {"status": "pending"},
    {"rights": ["extract"]},
    {"revoked_at": NOW.isoformat()},
    {"expires_at": (NOW - timedelta(seconds=1)).isoformat()},
    {"verified_at": (NOW + timedelta(seconds=1)).isoformat()},
    {"sha256": "0" * 64},
    {"company_id": "00000000-0000-4000-8000-000000000003"},
    {"source_url": "https://other.example/catalog"},
])
def test_grant_fail_closed(change):
    grant = approved_grant(make_document())
    grant.update(change)
    with pytest.raises(CatalogueRejected):
        inspect(grant=grant)


def test_grant_must_be_resolved_server_side_and_manifest_claims_do_not_count():
    doc = make_document()
    doc["rights_granted"] = True
    with pytest.raises(CatalogueRejected):
        inspect_authorised_catalogue(doc, CSV, grant_lookup=lambda *_: None, now=NOW)
    with pytest.raises(CatalogueRejected):
        inspect_authorised_catalogue(doc, CSV, grant_lookup=None, now=NOW)


def test_csv_source_bound_and_no_cross_row_tuple_inference():
    content = (
        "standard,grade,shape,dimensions_mm\n"
        "EN 10219,S355J2H,RHS,\n"
        ",,RHS,200x100x6\n"
        "EN 10219,S355J2H,SHS,200x100x6\n"
        "EN 10219,S355J2H,RHS,200x100x6\n"
        "EN 10219,S355J2H,RHS,200x100x6\n"
    ).encode()
    result = inspect(content)
    assert len(result["candidates"]) == 1
    assert result["candidates"][0]["source_locator"] == "csv_row:5"
    assert result["rejected_rows"] == 4
    assert result["published_claims"] == 0


def test_pdf_registers_only_with_verified_rights_never_generates_tuples():
    pdf = b"%PDF-1.7\n1 0 obj <<>> endobj\n"
    result = inspect(pdf, kind="pdf")
    assert result["status"] == "licensed_pdf_registered_not_extracted"
    assert result["candidates"] == []
    assert result["db_writes"] == 0
    with pytest.raises(CatalogueRejected):
        inspect(b"PDF-not-real", kind="pdf")


def test_payload_and_hash_limits():
    doc = make_document()
    doc["sha256"] = "f" * 64
    with pytest.raises(CatalogueRejected, match="hash mismatch"):
        inspect(manifest=doc)
    with pytest.raises(CatalogueRejected):
        inspect(b"x" * (2 * 1024 * 1024 + 1))


ROW = ("<table><tr><td>EN 10219</td><td>S355J2H</td>"
       "<td>RHS</td><td>200x100x6</td></tr></table>")


def old_record(html):
    raw = html.encode()
    return {
        "source_sha256": hashlib.sha256(raw).hexdigest(),
        "fingerprint_source_sha256": hashlib.sha256(raw).hexdigest(),
        "fingerprint": fingerprint_technical_rows(html),
    }


def test_a56_distinguishes_changing_shell_from_changing_observed_row():
    original = "<div>cookie=A</div>" + ROW
    previous = old_record(original)
    assert diagnose_first_level_change(previous, original.encode())["classification"] == "unchanged_full_bytes"
    shell = diagnose_first_level_change(previous, ("<div>cookie=B</div>" + ROW).encode())
    assert shell["classification"] == "same_observed_rows"
    assert shell["body_changed"] is True
    changed = diagnose_first_level_change(
        previous, ("<div>cookie=B</div>" + ROW.replace("200x100x6", "200x100x8")).encode()
    )
    assert changed["classification"] == "changed_observed_rows"
    assert all(x["db_writes"] == x["published_claims"] == 0 for x in (shell, changed))


def test_a56_no_rows_and_wrong_source_hash_fail_closed():
    old = old_record("<p>No table</p>")
    result = diagnose_first_level_change(old, b"<p>another page</p>")
    assert result["classification"] == "no_comparable_rows"
    bound = old_record(ROW)
    bound["fingerprint_source_sha256"] = "f" * 64
    with pytest.raises(ValueError, match="bound"):
        diagnose_first_level_change(bound, ROW.encode() + b"<p>new</p>")
    with pytest.raises(ValueError):
        diagnose_first_level_change(old_record(ROW), b"x" * (512_000 + 1))


def test_diagnostic_never_leaks_raw_html_or_computed_hash():
    source = old_record(ROW)
    output = diagnose_first_level_change(source, (ROW + "<p>banner</p>").encode())
    text = json.dumps(output)
    assert "S355J2H" not in text
    assert "200x100x6" not in text
    assert source["source_sha256"] not in text
    assert "source_url" not in text
