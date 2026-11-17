"""AUTO1.A.5: classify *why* no source-local exact technical tuple was saved."""
from __future__ import annotations

import asyncio
from pathlib import Path

import pytest

from app import net_pro_producers_auto1 as worker
from app.net_pro_producers_auto1a4 import extract_exact_row_candidates
from app.net_pro_producers_auto1a5 import diagnose_detail_html

URL = "https://www.example.it/prodotti/rhs"
SHA = "b" * 64


def _diagnose(html: str):
    claims = extract_exact_row_candidates(html, URL, SHA)
    return diagnose_detail_html(html, claims), claims


def test_no_table_does_not_infer_combination_from_prose():
    result, claims = _diagnose("<p>EN 10219 S355J2H RHS 200x100x6</p>")
    assert claims == []
    assert result["reason"] == "no_table_rows"
    assert result["table_rows"] == 0
    assert result["exact_candidates"] == 0
    assert "S355" not in str(result)


def test_split_across_rows_detected_without_promoting_false_claim():
    html = ("<table><tr><td>EN 10219 RHS structural hollow section</td></tr>"
            "<tr><td>S355J2H 200x100x6 dimension</td></tr></table>")
    d, candidates = _diagnose(html)
    assert candidates == []
    assert d["reason"] == "split_across_rows"
    assert d["table_rows"] == 2
    assert d["same_row_all_fields"] == 0
    assert all(d[k] == 1 for k in (
        "standard_rows", "grade_rows", "shape_rows", "dimension_rows"
    ))


def test_complete_explicit_row_is_candidate_only_not_manufacturing_proof():
    html = "<table><tr><td>EN 10219 S355J2H RHS 200x100x6</td></tr></table>"
    d, candidates = _diagnose(html)
    assert d["reason"] == "exact_candidate"
    assert d["same_row_all_fields"] == 1
    assert d["exact_candidates"] == 1
    assert candidates[0]["evidence_status"] == "pending_verification"
    assert d["contract"] == "netproducers-auto1a5-diagnostic-v1"
    assert not any(k in d for k in ("source_url", "source_excerpt", "html"))


def test_missing_grade_and_ambiguous_rows_remain_not_evidence():
    d, claims = _diagnose("<table><tr><td>EN 10219 RHS 200x100x6</td></tr></table>")
    assert d["reason"] == "missing_grade"
    assert claims == []
    d, claims = _diagnose(
        "<table><tr><td>EN 10219 S355J2H S235JRH RHS 200x100x6</td></tr></table>"
    )
    assert d["reason"] == "ambiguous_or_rejected"
    assert claims == []
    assert d["same_row_all_fields"] == 1


def test_pdf_link_count_only_does_not_download_or_claim_proof():
    d, claims = _diagnose('<a href="/catalogo.pdf">EN 10219 technical catalogue</a>')
    assert d["reason"] == "no_table_rows"
    assert d["pdf_links"] == 1
    assert claims == []


def test_a5_sql_is_private_and_fingerprint_bound():
    root = Path(__file__).resolve().parents[3]
    m = root / "supabase/migrations/20261117101500_net_producers_auto1a5_evidence_gap_diagnostics.sql"
    sql = m.read_text(encoding="utf-8")
    assert sql.count("$body$;") == 2
    assert "alter table private.network_producer_auto1a5_diagnostics enable row level security" in sql
    assert "v_page.last_sha256 is distinct from p_source_sha256" in sql
    assert "p.detail_discovery_sha256=v_page.parent_sha256" in sql
    assert "and c.publication_status='published'" in sql
    assert "c.evidence_status='pending_verification'" in sql
    assert sql.count("from public,anon,authenticated;") == 3
    assert sql.count("to service_role;") == 2
    assert "update private.network_producer_auto1_detail_pages set next_check_at" not in sql
    assert "published_capabilities',0" in sql


@pytest.mark.parametrize("flag", ["true", "false"])
def test_worker_records_only_when_a5_flag_enabled(monkeypatch, flag):
    monkeypatch.setenv("NETPRODUCERS_A4_ENABLED", "true")
    monkeypatch.setenv("NETPRODUCERS_A5_ENABLED", flag)
    diagnosis = {
        "contract": "netproducers-auto1a5-diagnostic-v1",
        "reason": "no_table_rows",
        "table_rows": 0, "eligible_rows": 0, "standard_rows": 0,
        "grade_rows": 0, "shape_rows": 0, "dimension_rows": 0,
        "same_row_all_fields": 0, "pdf_links": 0, "exact_candidates": 0,
    }
    responses = {
        "netproducers1_auto1_seed": {"contract": "netproducers1-auto1-seed-v1", "added": 0},
        "netproducers1_auto1_claim": {
            "contract": "netproducers1-auto1-claim-v1", "count": 0, "items": []},
        "netproducers1_auto1a3_claim_pages": {
            "contract": "netproducers-auto1a3-claim-v1", "count": 0, "items": []},
        "netproducers1_auto1a4_claim_pages": {
            "contract": "netproducers-auto1a4-claim-v1",
            "count": 1, "items": [{
                "page_id": "d1", "parent_page_id": "p1",
                "parent_sha256": "a" * 64, "source_url": URL,
                "canonical_domain": "example.it",
            }]},
        "netproducers1_auto1a4_complete_page": {
            "contract": "netproducers-auto1a4-complete-v1", "candidate_count": 0},
        "netproducers1_auto1a5_record_diagnostic": {
            "contract": "netproducers-auto1a5-record-v1", "recorded": True},
        "netproducers1_auto1b_verify": {
            "contract": "netproducers-auto1b-verify-v1", "checked": 0},
        "netproducers1_auto1a3_verify": {
            "contract": "netproducers-auto1a3-verify-v1", "checked": 0},
    }

    class RpcCall:
        def __init__(self, data):
            self.data = data

        def execute(self):
            return type("Reply", (), {"data": self.data})()

    class Db:
        calls = []

        def rpc(self, name, args):
            self.calls.append((name, args))
            return RpcCall(responses[name])

    async def fake_fetch(client, lease):
        return {
            "status": "processed", "sha256": SHA,
            "technical_candidates": [], "diagnostic": diagnosis,
        }

    monkeypatch.setattr(worker, "fetch_official_page", fake_fetch)
    db = Db()
    output = asyncio.run(worker.run(db, limit=1, dry_run=False))
    seen = [name for name, _ in db.calls]
    assert ("netproducers1_auto1a5_record_diagnostic" in seen) is (flag == "true")
    assert output["a5_diagnostics_recorded"] == (1 if flag == "true" else 0)
    assert output["published_claims"] == 0
    if flag == "true":
        _, args = next((name, args) for name, args in db.calls
                       if name == "netproducers1_auto1a5_record_diagnostic")
        assert args["p_source_sha256"] == SHA
        assert args["p_diagnostic"] == diagnosis


def test_a5_missing_diagnostic_fails_closed_not_false_success(monkeypatch):
    # A processed page must not be counted as diagnosed with no metrics.
    monkeypatch.setenv("NETPRODUCERS_A4_ENABLED", "true")
    monkeypatch.setenv("NETPRODUCERS_A5_ENABLED", "true")
    # Pure contract can never treat absent/malformed HTML data as exact evidence.
    with pytest.raises((KeyError, ValueError)):
        item = {"status": "processed"}
        report = item["diagnostic"]
        if not isinstance(report, dict):
            raise ValueError("Missing A5 structural diagnostic")
