"""AUTO1.A.4 strict source-local candidate parsing regression tests."""
from app.net_pro_producers_auto1a4 import discover_detail_links, extract_exact_row_candidates

SHA = "a" * 64
ROOT = "https://www.example.it/prodotti/tubi"
SPEC = "https://www.example.it/prodotti/tubi/rhs"


def test_detail_links_official_bounded_and_parent_fingerprint():
    html = ('<a href="/prodotti/tubi/rhs">Technical specifications</a>'
            '<a href="https://evil.test/prodotti/tubi">Technical specifications</a>'
            '<a href="/catalogo.pdf">Datasheet</a>'
            '<a href="/prodotti/tubi/rhs?utm_source=x">Technical specifications</a>'
            '<a href="/privacy">Technical specifications</a>')
    rows = discover_detail_links(html, ROOT, "www.example.it", SHA)
    assert rows == [{"url": SPEC, "parent_url": ROOT, "parent_sha256": SHA, "depth": 2}]
    assert discover_detail_links(html, ROOT, "www.example.it", "invalid") == []
    assert discover_detail_links(html, ROOT, "other.example.it", SHA) == []


def test_exact_rhs_row_candidate_needs_all_fields():
    html = '<table><tr><td>EN 10219</td><td>S355J2H</td><td>RHS</td><td>200×100×6</td></tr></table>'
    rows = extract_exact_row_candidates(html, SPEC, SHA)
    assert len(rows) == 1
    assert rows[0]["dimensions_mm"] == [200.0, 100.0, 6.0]
    assert rows[0]["evidence_status"] == "pending_verification"
    assert rows[0]["locator"] == "table_row:1"


def test_cross_row_cooccurrence_never_becomes_spec():
    html = ('<table><tr><td>EN 10219</td><td>RHS</td></tr>'
            '<tr><td>S355J2H</td><td>200×100×6</td></tr></table>')
    assert extract_exact_row_candidates(html, SPEC, SHA) == []


def test_range_only_does_not_certify_specific_dimension():
    html = '<p>EN 10219 S355J2H RHS 100-300 mm, 4-12 mm</p>'
    assert extract_exact_row_candidates(html, SPEC, SHA) == []


def test_multiple_grades_and_negations_rejected():
    html = ('<table><tr><td>EN 10219 S355J2H S235JRH RHS 200x100x6</td></tr>'
            '<tr><td>EN 10219 S355J2H RHS 200x100x6 not available</td></tr></table>')
    assert extract_exact_row_candidates(html, SPEC, SHA) == []


def test_shs_geometry_and_fingerprint():
    html = ('<table><tr><td>EN 10219 S355J2H SHS 100x100x5</td></tr>'
            '<tr><td>EN 10219 S355J2H SHS 200x100x6</td></tr></table>')
    result = extract_exact_row_candidates(html, SPEC, SHA)
    assert len(result) == 1
    assert result[0]["shape"] == "SHS"
    assert extract_exact_row_candidates(html, SPEC, "bad") == []


def test_depth_two_lease_is_bounded_and_rejects_external_site():
    from app.net_pro_producers_auto1 import parse_detail_page_lease
    import pytest
    with pytest.raises(ValueError):
        parse_detail_page_lease({"contract": "netproducers-auto1a4-claim-v1", "count": 1, "items": [
            {"page_id": "d1", "parent_page_id": "p1", "parent_sha256": SHA,
             "source_url": "https://evil.test/prodotti/rhs", "canonical_domain": "example.it"}
        ]})
    with pytest.raises(ValueError):
        parse_detail_page_lease({"contract": "netproducers-auto1a4-claim-v1", "count": 1, "items": [
            {"page_id": "d1", "parent_page_id": "p1", "parent_sha256": "bad",
             "source_url": SPEC, "canonical_domain": "example.it"}
        ]})


def test_depth_two_worker_persists_candidates_only_when_enabled(monkeypatch):
    import asyncio
    from app import net_pro_producers_auto1 as worker
    monkeypatch.setenv("NETPRODUCERS_A4_ENABLED", "true")
    calls = []

    class Response:
        def __init__(self, data):
            self.data = data

    class RpcCall:
        def __init__(self, data):
            self.data = data
        def execute(self):
            return Response(self.data)

    responses = {
        "netproducers1_auto1_seed": {"contract": "netproducers1-auto1-seed-v1", "added": 0},
        "netproducers1_auto1_claim": {"contract": "netproducers1-auto1-claim-v1", "count": 0, "items": []},
        "netproducers1_auto1a3_claim_pages": {"contract": "netproducers-auto1a3-claim-v1", "count": 1,
            "items": [{"page_id": "p1", "company_id": "c1",
                       "source_url": ROOT, "canonical_domain": "example.it",
                       "needs_detail_discovery": True}]},
        "netproducers1_auto1a3_complete_page": {
            "contract": "netproducers-auto1a3-complete-v1", "candidate_count": 0},
        "netproducers1_auto1a4_discover": {
            "contract": "netproducers-auto1a4-discover-v1", "recorded": 1},
        "netproducers1_auto1a4_claim_pages": {"contract": "netproducers-auto1a4-claim-v1", "count": 1,
            "items": [{"page_id": "d1", "parent_page_id": "p1", "parent_sha256": SHA,
                       "company_id": "c1", "source_url": SPEC, "canonical_domain": "example.it"}]},
        "netproducers1_auto1a4_complete_page": {
            "contract": "netproducers-auto1a4-complete-v1", "candidate_count": 1},
        "netproducers1_auto1b_verify": {"contract": "netproducers-auto1b-verify-v1", "checked": 0},
        "netproducers1_auto1a3_verify": {"contract": "netproducers-auto1a3-verify-v1", "checked": 0}
    }
    class Db:
        def rpc(self, name, args):
            calls.append((name, args))
            assert name in responses, name
            return RpcCall(responses[name])

    async def fake_fetch(client, lease):
        if lease["page_id"] == "p1":
            return {"status": "processed", "sha256": SHA, "candidates": [],
                    "detail_links": [{"url": SPEC, "parent_url": ROOT,
                                      "parent_sha256": SHA, "depth": 2}]}
        return {"status": "processed", "sha256": "b" * 64,
                "technical_candidates": [{
                    "standard": "EN10219", "grade": "S355J2H", "shape": "RHS",
                    "dimensions_mm": [200, 100, 6], "source_url": SPEC,
                    "source_sha256": "b" * 64, "locator": "table_row:1",
                    "source_row_excerpt": "EN 10219 | S355J2H | RHS | 200x100x6",
                    "evidence_status": "pending_verification",
                    "interpretation": "same_row_explicit_candidate"
                }]}
    monkeypatch.setattr(worker, "fetch_official_page", fake_fetch)
    result = asyncio.run(worker.run(Db(), limit=3, dry_run=False))
    names = [name for name, _ in calls]
    assert names == [
        "netproducers1_auto1_seed", "netproducers1_auto1_claim",
        "netproducers1_auto1a3_claim_pages", "netproducers1_auto1a3_complete_page",
        "netproducers1_auto1a4_discover", "netproducers1_auto1a4_claim_pages",
        "netproducers1_auto1a4_complete_page", "netproducers1_auto1b_verify",
        "netproducers1_auto1a3_verify",
    ]
    assert calls[4][1]["p_parent_sha256"] == SHA
    assert calls[6][1]["p_candidates"][0]["evidence_status"] == "pending_verification"
    assert result["detail_pages_processed"] == 1
    assert result["private_technical_candidates"] == 1
    assert result["published_claims"] == 0


def test_depth_two_apex_and_www_links_normalize_to_approved_host():
    html = ('<a href="https://example.it/prodotti/tubi/rhs">Technical data</a>'
            '<a href="https://www.example.it/prodotti/tubi/rhs">Technical data</a>')
    items = discover_detail_links(html, ROOT, "www.example.it", SHA)
    assert len(items) == 1
    assert items[0]["url"] == SPEC


def test_source_excerpt_is_short_and_unchanged_row_only():
    html = "<table><tr><td>EN 10219 S355J2H RHS 200x100x6</td></tr></table>"
    row = extract_exact_row_candidates(html, SPEC, SHA)[0]
    assert row["source_row_excerpt"] == "EN 10219 S355J2H RHS 200x100x6"
    assert len(row["source_row_excerpt"]) <= 240


def test_first_level_same_sha_is_reparsed_for_missing_detail_discovery(monkeypatch):
    import asyncio
    import hashlib
    import httpx
    from app import net_pro_producers_auto1 as worker
    html = b'<html><a href="/prodotti/tubi/rhs">Technical data sheet</a></html>'
    fingerprint = hashlib.sha256(html).hexdigest()

    def handler(request):
        if request.url.path == "/robots.txt":
            return httpx.Response(404)
        assert request.url.path == "/prodotti/tubi"
        assert "if-none-match" not in request.headers
        assert "if-modified-since" not in request.headers
        return httpx.Response(200, headers={"Content-Type": "text/html"}, content=html)

    monkeypatch.setattr(worker, "public_dns_only", lambda host: host == "www.example.it")

    async def execute(needs_discovery):
        lease = {"page_id": "p1", "source_url": ROOT,
                 "canonical_domain": "example.it", "last_sha256": fingerprint,
                 "needs_detail_discovery": needs_discovery}
        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
            return await worker.fetch_official_page(client, lease)

    pending = asyncio.run(execute(True))
    assert pending["status"] == "processed"
    assert pending["detail_links"][0]["url"] == SPEC
    assert pending["detail_links"][0]["parent_sha256"] == fingerprint
    already_scanned = asyncio.run(execute(False))
    assert already_scanned["status"] == "unchanged"
