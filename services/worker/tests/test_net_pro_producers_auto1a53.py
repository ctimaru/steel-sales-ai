"""AUTO1.A.5.3: exact-source-bound row fingerprints are private diagnostics ONLY."""
from __future__ import annotations

import asyncio
from pathlib import Path

import pytest

from app import net_pro_producers_auto1 as worker
from app.net_pro_producers_auto1a4 import (
    discover_detail_links, extract_exact_row_candidates,
)
from app.net_pro_producers_auto1a53 import fingerprint_technical_rows

SHA = "a" * 64
URL = "https://www.example.it/prodotti/rhs"
ROOT = Path(__file__).resolve().parents[3]


def test_markup_and_navigation_changes_do_not_change_detected_rows():
    source = (
        '<nav><span>Prices Monday</span></nav>'
        '<table class="a"><tr><td>EN 10219 S355J2H RHS 200x100x6</td></tr></table>'
        '<script>session=1</script>'
    )
    updated = (
        '<nav><span>Prices Tuesday</span></nav>'
        '<table id="other"><tr class="z"><td>'
        ' EN  10219  S355J2H RHS 200×100×6 </td></tr></table>'
        '<script>session=55</script>'
    )
    old, new = fingerprint_technical_rows(source), fingerprint_technical_rows(updated)
    assert old["contract"] == "netproducers-auto1a53-row-fingerprint-v1"
    assert old["technical_rows"] == new["technical_rows"] == 1
    assert old["technical_sha256"] == new["technical_sha256"]
    assert len(old["technical_sha256"]) == 64
    assert not any(k in old for k in ("html", "source_url", "claim", "grade"))


def test_change_of_dimension_grade_or_negation_changes_signature():
    basis = "<table><tr><td>EN 10219 S355J2H RHS 200x100x6</td></tr></table>"
    original = fingerprint_technical_rows(basis)
    for different in ("300x100x6", "200x100x8", "S235JRH", "not available"):
        updated = basis.replace("200x100x6", different) if "x" in different else (
            basis.replace("S355J2H", different) if different.startswith("S235") else
            basis.replace("EN 10219", "EN 10219 not available")
        )
        changed = fingerprint_technical_rows(updated)
        assert changed["technical_sha256"] != original["technical_sha256"]


def test_no_eligible_technical_rows_are_not_comparable():
    empty = fingerprint_technical_rows("<table><tr><td>Some standard corporate copy</td></tr></table>")
    absent = fingerprint_technical_rows("<p>EN 10219 S355J2H RHS 200x100x6</p>")
    assert empty == absent == {
        "contract": "netproducers-auto1a53-row-fingerprint-v1",
        "technical_rows": 0, "technical_sha256": None,
    }
    assert extract_exact_row_candidates(
        "<p>EN 10219 S355J2H RHS 200x100x6</p>", URL, SHA
    ) == []


def test_row_order_and_cell_boundaries_are_preserved():
    first = ("<table><tr><td>EN 10219 S355J2H RHS 200x100x6</td></tr>"
             "<tr><td>EN 10219 S355J2H RHS 300x100x6</td></tr></table>")
    reordered = ("<table><tr><td>EN 10219 S355J2H RHS 300x100x6</td></tr>"
                 "<tr><td>EN 10219 S355J2H RHS 200x100x6</td></tr></table>")
    assert fingerprint_technical_rows(first)["technical_sha256"] != (
        fingerprint_technical_rows(reordered)["technical_sha256"]
    )


def test_depth_two_link_ranking_prefers_dimensional_html_tables():
    links = [f'<a href="/prodotti/tubi-{i}">Tubi</a>' for i in range(8)]
    links += [
        '<a href="/prodotti/tubi-rhs-en-10219/">EN 10219 RHS</a>',
        '<a href="/prodotti/tubi-tabella-dimensionale/">Tabella dimensionale tubi</a>',
        '<a href="/prodotti/elastomero/">Technical dimensions elastomer</a>',
        '<a href="https://malicious.example/technical/dimensions">Tabella dimensionale RHS</a>',
        '<a href="/prodotti/tabelle.pdf">Tabelle dimensionali</a>',
    ]
    selected = discover_detail_links("".join(links), URL, "www.example.it", SHA)
    assert selected[0]["url"] == "https://www.example.it/prodotti/tubi-tabella-dimensionale/"
    assert len(selected) <= 6
    assert all("malicious" not in row["url"] and ".pdf" not in row["url"] for row in selected)
    assert all(row["parent_sha256"] == SHA for row in selected)


def test_migration_private_source_identity_and_no_public_claims():
    sql = (ROOT / "supabase/migrations"
           / "20261117115000_net_producers_auto1a53_technical_row_fingerprints.sql").read_text()
    assert sql.count("$body$;") == 2
    assert "enable row level security" in sql
    assert "v_page.last_sha256 is distinct from p_source_sha256" in sql
    assert "source_sha256=p_source_sha256" in sql
    assert "p.last_sha256=v_page.parent_sha256" in sql
    assert "p.detail_discovery_sha256=v_page.parent_sha256" in sql
    assert "q.source_url=c.website_url" in sql
    assert "c.publication_status='published'" in sql
    assert "r.canonical_key='producer'" in sql
    assert "p_technical_rows > (v_diagnostic.metrics->>'eligible_rows')::int" in sql
    assert "Conflicting fingerprint for exact source SHA" in sql
    assert "no_comparable_rows" in sql
    assert sql.count("from public,anon,authenticated;") == 2
    assert sql.count("to service_role;") == 2
    assert "update private.network_producer_auto1_detail_pages" not in sql.lower()
    assert "published_capabilities',0" in sql


@pytest.mark.parametrize("flag,expected", [("true", 1), ("false", 0)])
def test_worker_fingerprints_only_with_a53_flag_and_valid_a5(monkeypatch, flag, expected):
    monkeypatch.setenv("NETPRODUCERS_A4_ENABLED", "true")
    monkeypatch.setenv("NETPRODUCERS_A5_ENABLED", "true")
    monkeypatch.setenv("NETPRODUCERS_A53_ENABLED", flag)
    diag = {
        "contract": "netproducers-auto1a5-diagnostic-v1", "reason": "no_table_rows",
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
            "contract": "netproducers-auto1a4-claim-v1", "count": 1, "items": [{
                "page_id": "d1", "parent_page_id": "p1",
                "parent_sha256": SHA, "source_url": URL,
                "canonical_domain": "example.it",
            }]},
        "netproducers1_auto1a4_complete_page": {
            "contract": "netproducers-auto1a4-complete-v1", "candidate_count": 0},
        "netproducers1_auto1a5_record_diagnostic": {
            "contract": "netproducers-auto1a5-record-v1", "recorded": True},
        "netproducers1_auto1a53_record_fingerprint": {
            "contract": "netproducers-auto1a53-record-v1", "recorded": True,
            "comparison": "no_comparable_rows", "published_capabilities": 0},
        "netproducers1_auto1b_verify": {
            "contract": "netproducers-auto1b-verify-v1", "checked": 0},
        "netproducers1_auto1a3_verify": {
            "contract": "netproducers-auto1a3-verify-v1", "checked": 0},
    }

    class Reply:
        def __init__(self, data):
            self.data = data
        def execute(self):
            return self

    class Db:
        def __init__(self):
            self.calls = []
        def rpc(self, name, args):
            self.calls.append((name, args))
            return Reply(responses[name])

    async def fake_fetch(_client, _lease):
        return {"status": "processed", "sha256": SHA,
                "diagnostic": diag, "technical_candidates": [],
                "technical_fingerprint": fingerprint_technical_rows("<p>No table</p>")}

    monkeypatch.setattr(worker, "fetch_official_page", fake_fetch)
    db = Db()
    result = asyncio.run(worker.run(db, limit=1, dry_run=False))
    calls = [name for name, _ in db.calls]
    assert ("netproducers1_auto1a53_record_fingerprint" in calls) == (expected == 1)
    assert result["a53_fingerprints_recorded"] == expected
    assert result["published_claims"] == 0
    assert result["a53_comparisons"] == (
        {"no_comparable_rows": 1} if expected else {}
    )
    if expected:
        a5_index = calls.index("netproducers1_auto1a5_record_diagnostic")
        a53_index = calls.index("netproducers1_auto1a53_record_fingerprint")
        assert a5_index < a53_index
        _, args = db.calls[a53_index]
        assert args["p_technical_rows"] == 0
        assert args["p_technical_sha256"] is None
        assert args["p_source_sha256"] == SHA


def test_a53_flag_cannot_override_disabled_a5(monkeypatch):
    monkeypatch.setenv("NETPRODUCERS_A53_ENABLED", "true")
    monkeypatch.setenv("NETPRODUCERS_A5_ENABLED", "false")
    monkeypatch.setenv("NETPRODUCERS_A4_ENABLED", "true")
    # Check the flag dependency from the actual worker code. Do not create
    # a fake service-only A5.3 RPC when A5 is absent.
    source = (ROOT / "services/worker/app/net_pro_producers_auto1.py").read_text()
    assert 'a53_enabled = a5_enabled and os.getenv("NETPRODUCERS_A53_ENABLED"' in source
