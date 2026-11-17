"""AUTO1.A.5.4 — prioritize genuine HTML technical sheets, not PDFs or claims."""
from __future__ import annotations

import asyncio
import hashlib

import httpx
import pytest

from app import net_pro_producers_auto1 as worker
from app.net_pro_producers_auto1a4 import (
    discover_detail_links, extract_exact_row_candidates,
)
from app.net_pro_producers_auto1a5 import diagnose_detail_html
from app.net_pro_producers_auto1a53 import fingerprint_technical_rows
from app.net_pro_producers_auto1a54 import (
    classify_html_layout, link_priority_bonus, technical_sheet_hint,
)

SHA = "a" * 64
ROOT = "https://www.example.it/"
PRODUCT = "https://www.example.it/prodotti/tubi"
DETAIL = "https://www.example.it/schede/tabelle-dimensionali"


def test_first_level_prefers_specific_technical_sheets_over_generic_products():
    generic = "".join(
        f'<a href="/prodotti/tubi-{i}">Tubi</a>' for i in range(18)
    )
    html = generic + (
        '<a href="/schede/tabelle-dimensionali/">Tabella dimensionale EN 10219 RHS</a>'
        '<a href="/cataloghi/tubi-strutturali/">Tubolari strutturali EN 10219</a>'
        '<a href="/prodotti/elastomeri/">Technical datasheet elastomers</a>'
        '<a href="/azienda/">Tubi EN 10219 azienda</a>'
        '<a href="https://wrong.example/schede/tabelle-dimensionali/">RHS EN 10219</a>'
        '<a href="/schede/specifiche.pdf">Scheda tecnica EN 10219 PDF</a>'
    )
    preferred = worker.discover_product_links(
        html, ROOT, "example.it", a54_enabled=True
    )
    assert len(preferred) == worker.MAX_PRODUCT_PAGES_PER_COMPANY
    assert preferred[0]["url"] == "https://www.example.it/schede/tabelle-dimensionali/"
    assert preferred[0]["kind"] == "catalog"
    assert any("tubi-strutturali" in x["url"] for x in preferred)
    assert not any("wrong.example" in x["url"] or ".pdf" in x["url"] for x in preferred)
    assert all(x["kind"] in ("products", "catalog", "standards") for x in preferred)
    assert len(set(x["url"] for x in preferred)) == len(preferred)
    baseline = worker.discover_product_links(html, ROOT, "example.it")
    assert all("tabelle-dimensionali" not in x["url"] for x in baseline)


def test_second_level_accepts_explicit_dimension_tables_and_keeps_parent_sha():
    html = (
        '<a href="/schede/tabelle-dimensionali/">Tabella dimensionale EN 10219</a>'
        '<a href="/prodotti/tubi-inox/">Tubi inossidabili</a>'
        '<a href="/prodotti/tubi-drenaggio/">Tubi drenaggio compositi</a>'
        '<a href="/azienda/portfolio/">RHS EN 10219 table</a>'
        '<a href="https://evil.test/schede/rhs">RHS EN10219</a>'
        '<a href="/schede/rhs.pdf">RHS EN10219 PDF</a>'
    )
    result = discover_detail_links(
        html, PRODUCT, "www.example.it", SHA, a54_enabled=True
    )
    assert result
    assert result[0]["url"] == DETAIL + "/"
    assert result[0]["parent_sha256"] == SHA
    assert result[0]["parent_url"] == PRODUCT
    assert all(x["depth"] == 2 for x in result)
    assert all(not x["url"].endswith(".pdf") and "evil.test" not in x["url"] for x in result)
    # Corporate pages are *deprioritized*, never deleted: may include evidence.
    assert all("azienda" not in x["url"] for x in result[:1])
    baseline = discover_detail_links(html, PRODUCT, "www.example.it", SHA)
    assert all("/schede/tabelle-dimensionali/" not in x["url"] for x in baseline)


def test_generic_marketing_link_is_not_upgraded_to_technical_proof():
    assert not technical_sheet_hint("/azienda/chi-siamo prodotti")
    assert link_priority_bonus("/azienda/", "Tubi strutturali") < (
        link_priority_bonus("/schede/tabelle-dimensionali", "EN 10219 RHS")
    )
    assert link_priority_bonus("/prodotti/tubi-paladex/", "Tabelle tubi compositi") < (
        link_priority_bonus("/schede/section-tables/", "RHS EN10219")
    )
    assert extract_exact_row_candidates(
        "<p>EN 10219 S355J2H RHS 200x100x6</p>", PRODUCT, SHA
    ) == []


@pytest.mark.parametrize("html,expected", [
    ("<table><tr><td>EN 10219 S355J2H RHS 200x100x6</td></tr></table>",
     "technical_html_rows"),
    ("<table><tr><td>Performance generic company values</td></tr></table>",
     "nontechnical_html_table"),
    ('<p>Download specifications</p><a href="/catalogo.pdf">PDF</a>',
     "pdf_links_no_html_table"),
    ('<script type="application/json">{"technical":"EN10219"}</script>'
     '<div id="app">Products</div>', "no_html_table_or_pdf_link"),
])
def test_page_layout_is_observational_not_evidence(html, expected):
    diagnosis = diagnose_detail_html(html, [])
    fingerprint = fingerprint_technical_rows(html)
    assert classify_html_layout(diagnosis, fingerprint) == expected
    assert all("source_url" not in key and "published" not in key for key in diagnosis)
    assert classify_html_layout(diagnosis, fingerprint) in {
        "technical_html_rows", "nontechnical_html_table",
        "pdf_links_no_html_table", "no_html_table_or_pdf_link",
    }


def test_reject_malformed_layout_counts():
    diagnostic = diagnose_detail_html("<p>Nothing technical</p>", [])
    fingerprint = fingerprint_technical_rows("<p>Nothing technical</p>")
    with pytest.raises(ValueError):
        classify_html_layout(diagnostic, {**fingerprint, "technical_rows": 3})
    with pytest.raises(ValueError):
        classify_html_layout({**diagnostic, "table_rows": True}, fingerprint)


def test_first_level_table_is_identified_but_not_promoted_to_exact_candidate(monkeypatch):
    monkeypatch.setenv("NETPRODUCERS_A54_ENABLED", "true")
    monkeypatch.setattr(worker, "public_dns_only", lambda host: host == "www.example.it")
    html = (
        '<table><tr><td>EN 10219 S355J2H RHS 200x100x6</td></tr></table>'
        '<a href="/schede/tabelle-dimensionali/">Tabella dimensionale EN 10219</a>'
    ).encode()
    sha = hashlib.sha256(html).hexdigest()

    def reply(req):
        if req.url.path == "/robots.txt":
            return httpx.Response(404)
        assert req.url.path == "/prodotti/tubi"
        return httpx.Response(200, headers={"Content-Type": "text/html"}, content=html)

    async def execute():
        async with httpx.AsyncClient(transport=httpx.MockTransport(reply)) as client:
            return await worker.fetch_official_page(client, {
                "page_id": "prod1", "source_url": PRODUCT,
                "canonical_domain": "example.it", "needs_detail_discovery": True,
            })
    result = asyncio.run(execute())
    assert result["status"] == "processed"
    assert result["sha256"] == sha
    assert result["a54_layout"] == "technical_html_rows"
    assert result["technical_candidates"] == []
    assert result["diagnostic"] is None
    assert result["technical_fingerprint"] is None
    assert result["detail_links"][0]["parent_sha256"] == sha
    assert result["detail_links"][0]["url"] == DETAIL + "/"


def test_off_feature_keeps_prior_discovery_and_no_layout(monkeypatch):
    monkeypatch.delenv("NETPRODUCERS_A54_ENABLED", raising=False)
    html = (
        '<a href="/prodotti/tubi/">Prodotti tubi</a>'
        '<a href="/schede/tabelle-dimensionali/">Tabella dimensionale EN 10219</a>'
    )
    links = worker.discover_product_links(html, ROOT, "example.it", a54_enabled=False)
    assert [x["url"] for x in links] == ["https://www.example.it/prodotti/tubi/"]
    assert not any(x["kind"] not in ("products", "catalog", "standards") for x in links)


def test_worker_reports_only_aggregate_page_quality(monkeypatch):
    monkeypatch.setenv("NETPRODUCERS_A4_ENABLED", "true")
    monkeypatch.setenv("NETPRODUCERS_A5_ENABLED", "false")
    monkeypatch.setenv("NETPRODUCERS_A53_ENABLED", "false")
    monkeypatch.setenv("NETPRODUCERS_A54_ENABLED", "true")

    replies = {
        "netproducers1_auto1_seed": {"contract": "netproducers1-auto1-seed-v1", "added": 0},
        "netproducers1_auto1_claim": {
            "contract": "netproducers1-auto1-claim-v1", "count": 0, "items": []},
        "netproducers1_auto1a3_claim_pages": {
            "contract": "netproducers-auto1a3-claim-v1", "count": 1,
            "items": [{"page_id": "p1", "source_url": PRODUCT, "canonical_domain": "example.it"}]},
        "netproducers1_auto1a3_complete_page": {
            "contract": "netproducers-auto1a3-complete-v1", "candidate_count": 0},
        "netproducers1_auto1a4_discover": {
            "contract": "netproducers-auto1a4-discover-v1", "recorded": 1},
        "netproducers1_auto1a4_claim_pages": {
            "contract": "netproducers-auto1a4-claim-v1", "count": 1,
            "items": [{"page_id": "d1", "parent_page_id": "p1",
                       "parent_sha256": SHA, "source_url": DETAIL,
                       "canonical_domain": "example.it"}]},
        "netproducers1_auto1a4_complete_page": {
            "contract": "netproducers-auto1a4-complete-v1", "candidate_count": 0},
        "netproducers1_auto1b_verify": {
            "contract": "netproducers-auto1b-verify-v1", "checked": 0},
        "netproducers1_auto1a3_verify": {
            "contract": "netproducers-auto1a3-verify-v1", "checked": 0},
    }

    class RPC:
        def __init__(self, data):
            self.data = data
        def execute(self):
            return self
    class DB:
        def __init__(self):
            self.calls = []
        def rpc(self, name, args):
            self.calls.append((name, args))
            return RPC(replies[name])

    async def fake_fetch(_client, lease):
        if lease["page_id"] == "p1":
            return {"status": "processed", "sha256": SHA,
                    "detail_links": [{"url": DETAIL, "parent_url": PRODUCT,
                                      "parent_sha256": SHA, "depth": 2}],
                    "a54_layout": "technical_html_rows"}
        return {"status": "processed", "sha256": "b"*64, "technical_candidates": [],
                "a54_layout": "pdf_links_no_html_table"}

    monkeypatch.setattr(worker, "fetch_official_page", fake_fetch)
    db = DB()
    response = asyncio.run(worker.run(db, limit=5, dry_run=False))
    assert response["a54_product_page_quality"] == {"technical_html_rows": 1}
    assert response["a54_detail_page_quality"] == {"pdf_links_no_html_table": 1}
    assert response["private_technical_candidates"] == 0
    assert response["published_claims"] == 0
    assert not any("netproducers1_auto1a53" in name for name, _ in db.calls)
    assert not any("netproducers1_auto1a5" in name for name, _ in db.calls)
