"""NET-RO1.1: offline invariants for Romania first-party research candidates.

Never assume these are net-new production companies. This is deliberately
NOT a production import test or a service-role RPC test.
"""
from collections import Counter
import json
from pathlib import Path
from urllib.parse import urlsplit

SEED = (
    Path(__file__).resolve().parents[1]
    / "data"
    / "netro1_romania_first_party_research_20261105.json"
)


def read_seed():
    return json.loads(SEED.read_text(encoding="utf-8"))


def is_company_first_party(url, company_domain):
    parsed = urlsplit(url)
    host = (parsed.hostname or "").removeprefix("www.").lower()
    domain = company_domain.lower()
    return parsed.scheme == "https" and (host == domain or host.endswith("." + domain))


def test_romania_batch_is_read_only_and_not_an_import_payload():
    data = read_seed()
    assert data["phase"] == "NET-RO1.1"
    assert data["country"] == "RO"
    assert data["mode"] == "research_only"
    assert data["production_write_authorized"] is False
    assert "batch" not in data and "kind" not in data
    assert "import" not in data and "source_status" not in data
    assert data["reference_baseline"]["canonical_published"] == 278
    assert data["reference_baseline"]["provisional_explorable"] == 408


def test_ten_distinct_first_party_candidate_domains_by_role():
    records = read_seed()["records"]
    assert len(records) == 10
    assert len({r["domain"] for r in records}) == 10
    assert Counter(r["role"] for r in records) == {
        "producer": 4,
        "trader_distributor": 4,
        "processor_service_provider": 2,
    }
    assert all(r["country"] == "RO" for r in records)
    assert all(r["intake_lane"] == "research_candidate" for r in records)


def test_claims_are_sourced_on_a_first_party_domain():
    for record in read_seed()["records"]:
        domain = record["domain"]
        assert is_company_first_party(record["identity_url"], domain)
        assert is_company_first_party(record["source_url"], domain)
        assert record["evidence_status"] == "candidate_first_party"
        assert len(record["claims"]) >= 2
        for claim in record["claims"]:
            assert claim["type"] in {"product", "process", "facility", "material", "market", "role", "standard"}
            assert claim["value"] and claim["status"] == "candidate_first_party"
            assert is_company_first_party(claim["url"], domain)


def test_all_candidates_require_legal_and_rights_review():
    data = read_seed()
    for record in data["records"]:
        assert record["legal_identity_status"] == "pending_independent_review"
        assert record["rights_status"] == "pending_independent_review"
        # No phone, personal contact, outreach or private CRM data in research seed.
        assert not ({"email", "phone", "contact_person", "rfq", "price", "private_notes"} & record.keys())
    assert sum(len(r["claims"]) for r in data["records"]) == 20
