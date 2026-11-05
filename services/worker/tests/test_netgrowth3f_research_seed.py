"""NET-GROWTH3.F.1: offline-only industrial evidence research contract.

This is NOT a production/import manifest. Do not run service-role writes.
"""
import json
from pathlib import Path
from urllib.parse import urlsplit

DATA = Path(__file__).resolve().parents[1] / "data" / "netgrowth3f_first_party_research_20261105.json"


def _host(url):
    parts = urlsplit(url)
    assert parts.scheme == "https" and not parts.username and not parts.password
    return (parts.hostname or "").removeprefix("www.").lower()


def test_f1_is_only_research_not_a_50_100_import_batch():
    payload = json.loads(DATA.read_text(encoding="utf-8"))
    assert payload["phase"] == "NET-GROWTH3.F.1"
    assert payload["mode"] == "research_only"
    assert payload["production_write_authorized"] is False
    assert "batch" not in payload and "kind" not in payload
    assert len(payload["records"]) == 10
    assert sum(x["role"] == "producer" for x in payload["records"]) == 5
    assert sum(x["role"] == "processor_service_provider" for x in payload["records"]) == 5


def test_unique_first_party_capabilities_pending_review():
    payload = json.loads(DATA.read_text(encoding="utf-8"))
    records = payload["records"]
    assert len({r["domain"] for r in records}) == len(records)
    assert len({r["name"].lower() for r in records}) == len(records)
    for record in records:
        assert record["country"] == "IT"
        assert record["intake_lane"] == "net_new_research"
        assert record["evidence_status"] == "candidate_first_party"
        assert record["legal_identity_status"] == "pending_independent_review"
        assert record["rights_status"] == "pending_independent_review"
        assert _host(record["identity_url"]) == record["domain"]
        assert _host(record["source_url"]) == record["domain"]
        assert record["claims"]
        for claim in record["claims"]:
            assert claim["type"] in {"product", "process", "standard", "material", "dimension"}
            assert claim["status"] == "candidate_first_party"
            assert len(claim["value"]) > 2
            assert _host(claim["url"]) == record["domain"]
        assert not any(k in record for k in ("email", "phone", "personal_contact", "verified_buyer", "verified_supplier"))

    existing_domains = {r["domain"] for r in payload["existing_enrichment"]}
    hold_domains = {r["domain"] for r in payload["review_holds"]}
    assert not ({r["domain"] for r in records} & (existing_domains | hold_domains))
    assert not existing_domains & hold_domains
    assert len(hold_domains) == 3
    assert all(r["action"] != "new_candidate" for r in payload["existing_enrichment"])
