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
