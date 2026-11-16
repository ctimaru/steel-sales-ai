"""NET-PRO-PRODUCERS1.AUTO1: no unsafe URL, false exact SKU or unverified publication."""
import pytest
import asyncio

from app.net_pro_producers_auto1 import (
    safe_official_url, extract_candidates, parse_lease, run,
)


@pytest.mark.parametrize("url,good", [
    ("https://example.com/products", True),
    ("https://www.example.com/products", True),
    ("https://example.com:443/products", True),
    ("https://cdn.example.com/products", False),
    ("https://www.other.com", False),
    ("http://example.com/products", False),
    ("https://user:pass@example.com", False),
    ("https://example.com:8443/internal", False),
    ("https://127.0.0.1/", False),
    ("https://localhost/", False),
])
def test_first_party_restriction(url, good):
    assert safe_official_url(url, "example.com") is good


def test_html_only_short_claims_not_exact_dimension_compatibility():
    text = """
       <html><head><script>var grade='S460MH'</script></head>
       <body><nav>EN 10210 site navigation</nav><main>
         <h1>Tubi saldati EN 10219</h1>
         <p>Disponibile il grado S355J2H in gamma.</p>
         <p>Le dimensioni sono 200x100x6 ma non è dichiarata la combinazione per questo grado.</p>
       </main></body></html>
    """
    facts = extract_candidates(text)
    values = {f["claim_value"] for f in facts}
    assert "EN 10219" in values
    assert "S355J2H" in values
    assert "EN 10210" not in values
    assert "S460MH" not in values
    assert all(f["claim_value"].lower() in f["evidence_excerpt"].lower() for f in facts)
    assert all(f["claim_kind"] in ("technical_standard", "steel_grade", "manufacturing_process")
               for f in facts)
    assert not any("confirmed" in str(f) or "200x100x6" == f["claim_value"] for f in facts)


def test_lease_contract_rejects_cross_domain():
    with pytest.raises(ValueError):
        parse_lease({"contract": "netproducers1-auto1-claim-v1", "count": 1,
                     "items": [{"source_url": "https://evil.test/",
                                "canonical_domain": "example.com"}]})
    rows = parse_lease({"contract": "netproducers1-auto1-claim-v1", "count": 1,
                        "items": [{"source_url": "https://www.example.com/",
                                   "canonical_domain": "example.com"}]})
    assert len(rows) == 1


def test_default_worker_dry_run_does_not_lease_or_publish():
    class FakeResponse:
        data = {"contract": "netproducers1-auto1-status-v1", "queued": 56}
    class RpcCall:
        def execute(self):
            return FakeResponse()
    class Db:
        calls = []
        def rpc(self, name, args):
            self.calls.append((name, args))
            return RpcCall()
    db = Db()
    result = asyncio.run(run(db, limit=10, dry_run=True))
    assert result["mode"] == "dry_run"
    assert result["status"]["queued"] == 56
    assert db.calls == [("netproducers1_auto1_status", {})]


def test_persist_auto_seeds_100_before_claim_and_keeps_publication_zero():
    class Response:
        def __init__(self, data):
            self.data = data

    class RpcCall:
        def __init__(self, data):
            self.data = data
        def execute(self):
            return Response(self.data)

    class Db:
        def __init__(self):
            self.calls = []
        def rpc(self, name, args):
            self.calls.append((name, args))
            if name == "netproducers1_auto1_seed":
                return RpcCall({"contract": "netproducers1-auto1-seed-v1", "added": 2})
            if name == "netproducers1_auto1_claim":
                return RpcCall({"contract": "netproducers1-auto1-claim-v1",
                                "count": 0, "items": []})
            if name == "netproducers1_auto1b_verify":
                return RpcCall({"contract": "netproducers-auto1b-verify-v1",
                                "checked": 0, "manufacturing_capabilities_published": 0})
            if name == "netproducers1_auto1a3_claim_pages":
                return RpcCall({"contract": "netproducers-auto1a3-claim-v1", "count": 0, "items": []})
            if name == "netproducers1_auto1a3_verify":
                return RpcCall({"contract": "netproducers-auto1a3-verify-v1",
                                "checked": 0, "manufacturing_capabilities_published": 0})
            raise AssertionError(f"Unexpected RPC {name}")
    db = Db()
    result = asyncio.run(run(db, limit=10, dry_run=False))
    assert db.calls == [
        ("netproducers1_auto1_seed", {"p_limit": 100}),
        ("netproducers1_auto1_claim", {"p_limit": 10}),
        ("netproducers1_auto1a3_claim_pages", {"p_limit": 5}),
        ("netproducers1_auto1b_verify", {"p_limit": 100}),
        ("netproducers1_auto1a3_verify", {"p_limit": 100}),
    ]
    assert result["new_sources"] == 2
    assert result["processed"] == 0
    assert result["published_claims"] == 0


def test_auto1a3_discovers_first_party_product_catalog_standards_pages_not_pdfs():
    from app.net_pro_producers_auto1 import discover_product_links
    html = """
      <nav><a href="/it/prodotti/">Prodotti</a>
        <a href="/it/catalogo-tecnico/">Catalogo tecnico</a>
        <a href="/it/norme-e-certificazioni/">Norme</a>
        <a href="/it/contatti/">Contatti</a>
        <a href="/privacy/">Privacy Policy</a>
        <a href="https://outsider.it/products">Products outside</a>
        <a href="//127.0.0.1/products">Internal</a>
        <a href="/catalogo-tubi.pdf">Scarica catalogo PDF</a>
        <a href="/it/prodotti/?utm_source=homepage">Prodotti</a>
        <a href="/download.zip">Downloads</a>
        <a href="/it/ricerca/">Cerca</a>
      </nav>
    """
    links = discover_product_links(html, "https://www.example.com/it/", "example.com")
    urls = {x["url"] for x in links}
    assert "https://www.example.com/it/prodotti/" in urls
    assert "https://www.example.com/it/catalogo-tecnico/" in urls
    assert "https://www.example.com/it/norme-e-certificazioni/" in urls
    assert all(x["kind"] in ("products", "catalog", "standards") for x in links)
    assert not any("outsider" in u or "127.0.0.1" in u for u in urls)
    assert not any(".pdf" in u or ".zip" in u for u in urls)
    assert not any("/privacy" in u or "/contatti" in u for u in urls)
    assert all("?" not in u and "#" not in u for u in urls)
    assert len(urls) == len(links)


def test_auto1a3_enforces_one_company_and_bounded_links():
    from app.net_pro_producers_auto1 import discover_product_links, MAX_PRODUCT_PAGES_PER_COMPANY
    html = "<html>" + "".join(
        f'<a href="/it/prodotti/{i}/">Tubi prodotti {i}</a>'
        for i in range(50)
    ) + "</html>"
    links = discover_product_links(html, "https://example.com", "example.com")
    assert len(links) == MAX_PRODUCT_PAGES_PER_COMPANY
    assert len({x["url"] for x in links}) == MAX_PRODUCT_PAGES_PER_COMPANY


def test_auto1a3_rejects_page_leases_from_foreign_domains():
    from app.net_pro_producers_auto1 import parse_product_page_lease
    with pytest.raises(ValueError):
        parse_product_page_lease({
            "contract": "netproducers-auto1a3-claim-v1", "count": 1,
            "items": [{"page_id": "1", "source_url": "https://other.test/catalog",
                       "canonical_domain": "example.com"}]
        })
    valid = parse_product_page_lease({
        "contract": "netproducers-auto1a3-claim-v1", "count": 1,
        "items": [{"page_id": "1", "source_url": "https://example.com/catalog",
                   "canonical_domain": "example.com"}]
    })
    assert len(valid) == 1


def test_auto1a3_workflow_discovers_then_verifies_page_mentions_without_sku(monkeypatch):
    from app import net_pro_producers_auto1 as worker

    class Response:
        def __init__(self, data):
            self.data = data
    class RpcCall:
        def __init__(self, value):
            self.value = value
        def execute(self):
            return Response(self.value)
    calls = []
    class Db:
        def rpc(self, name, args):
            calls.append((name, args))
            data = {
                "netproducers1_auto1_seed": {
                    "contract": "netproducers1-auto1-seed-v1", "added": 0
                },
                "netproducers1_auto1_claim": {
                    "contract": "netproducers1-auto1-claim-v1", "count": 1,
                    "items": [{"company_id": "c1", "source_url": "https://example.com/",
                               "canonical_domain": "example.com"}]
                },
                "netproducers1_auto1_complete": {
                    "contract": "netproducers1-auto1-complete-v1", "candidate_count": 0
                },
                "netproducers1_auto1a3_discover": {
                    "contract": "netproducers-auto1a3-discover-v1", "recorded_total": 1
                },
                "netproducers1_auto1a3_claim_pages": {
                    "contract": "netproducers-auto1a3-claim-v1", "count": 1,
                    "items": [{"page_id": "page1", "company_id": "c1",
                               "source_url": "https://example.com/prodotti/",
                               "canonical_domain": "example.com"}]
                },
                "netproducers1_auto1a3_complete_page": {
                    "contract": "netproducers-auto1a3-complete-v1", "candidate_count": 1
                },
                "netproducers1_auto1b_verify": {
                    "contract": "netproducers-auto1b-verify-v1", "checked": 0
                },
                "netproducers1_auto1a3_verify": {
                    "contract": "netproducers-auto1a3-verify-v1", "checked": 1,
                    "source_mentions_confirmed": 1,
                    "manufacturing_capabilities_published": 0
                },
            }
            return RpcCall(data[name])

    async def fake_fetch(client, lease):
        if lease.get("page_id"):
            return {"status": "processed", "sha256": "b"*64,
                    "candidates": [{"claim_kind": "technical_standard",
                                    "claim_value": "EN 10219",
                                    "evidence_excerpt": "Tubi EN 10219"}]}
        return {"status": "processed", "sha256": "a"*64, "candidates": [],
                "product_links": [{"url": "https://example.com/prodotti/",
                                   "kind": "products"}]}
    monkeypatch.setattr(worker, "fetch_official_page", fake_fetch)

    result = asyncio.run(run(Db(), limit=3, dry_run=False))
    assert result["product_pages_processed"] == 1
    assert result["page_candidate_mentions"] == 1
    assert result["published_claims"] == 0
    assert [name for name, _ in calls] == [
        "netproducers1_auto1_seed", "netproducers1_auto1_claim",
        "netproducers1_auto1_complete", "netproducers1_auto1a3_discover",
        "netproducers1_auto1a3_claim_pages",
        "netproducers1_auto1a3_complete_page",
        "netproducers1_auto1b_verify", "netproducers1_auto1a3_verify"
    ]
    assert calls[3][1]["p_pages"] == [
        {"url": "https://example.com/prodotti/", "kind": "products"}
    ]


def test_auto1a3_apex_www_duplicates_prefer_verified_homepage_host():
    from app.net_pro_producers_auto1 import discover_product_links
    html = """
      <a href="https://tomatislamiere.it/lavorazioni-metalli/">Lavorazioni tubi</a>
      <a href="https://www.tomatislamiere.it/lavorazioni-metalli/">Lavorazioni tubi</a>
    """
    found = discover_product_links(
        html, "https://www.tomatislamiere.it/", "tomatislamiere.it"
    )
    assert found == [{
        "url": "https://www.tomatislamiere.it/lavorazioni-metalli/",
        "kind": "products"
    }]
