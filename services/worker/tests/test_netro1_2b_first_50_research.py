"""NET-RO1.2b — first 50 Romanian industrial research websites, offline guard.

These assertions test manifest structure and prevent accidental conversion of
research seeds into production import payloads. They do not verify licences,
legal identity, source truth or actual Supabase uniqueness. Import is gated
separately and is NEVER executed by these tests.
"""
from collections import Counter
import json
from pathlib import Path
from urllib.parse import urlsplit

DATA = Path(__file__).resolve().parents[1] / "data"
PATHS = [
    DATA / "netro1_romania_first_party_research_20261105.json",
    DATA / "netro1_2a_romania_research_wave_20261105.json",
    DATA / "netro1_2b_romania_research_wave_20261105.json",
]
ROLES = {"producer", "trader_distributor", "processor_service_provider"}
ASSERTION_TYPES = {
    "product", "process", "capability", "standard", "material",
    "role", "facility", "market",
}


def manifests():
    return [json.loads(path.read_text(encoding="utf-8")) for path in PATHS]


def first_party(url: str, domain: str) -> bool:
    parsed = urlsplit(url)
    host = (parsed.hostname or "").lower().removeprefix("www.")
    return parsed.scheme == "https" and (
        host == domain or host.endswith("." + domain)
    )


def test_50_unique_research_domains_and_role_totals():
    a, b, c = manifests()
    assert [len(w["records"]) for w in (a, b, c)] == [10, 15, 25]
    all_records = a["records"] + b["records"] + c["records"]
    assert len(all_records) == 50
    assert len({item["domain"] for item in all_records}) == 50
    assert len({item["name"].casefold() for item in all_records}) == 50
    assert sum(len(item["claims"]) for item in all_records) == 100
    assert Counter(item["role"] for item in all_records) == {
        "producer": 9,
        "trader_distributor": 30,
        "processor_service_provider": 11,
    }
    assert c["phase"] == "NET-RO1.2b"
    assert c["candidate_counts"] == {
        "producer": 3,
        "trader_distributor": 16,
        "processor_service_provider": 6,
    }


def test_research_only_never_is_import_manifest():
    for wave in manifests():
        assert wave["country"] == "RO"
        assert wave["mode"] == "research_only"
        assert wave["production_write_authorized"] is False
        assert not ({"batch", "kind", "import", "apply"} & wave.keys())
        for record in wave["records"]:
            assert record["country"] == "RO"
            assert record["role"] in ROLES
            assert record["intake_lane"] == "research_candidate"
            assert record["legal_identity_status"] == "pending_independent_review"
            assert record["rights_status"] == "pending_independent_review"
            assert record.get("imported") is not True
            assert not ({"email", "phone", "contact_person", "rfq", "price", "private_notes", "private_memory"} & record.keys())


def test_all_claims_have_same_company_domain_first_party_url():
    for wave in manifests():
        for record in wave["records"]:
            domain = record["domain"]
            assert domain and "." in domain
            assert first_party(record["identity_url"], domain)
            assert first_party(record["source_url"], domain)
            assert len(record["claims"]) >= 1
            for claim in record["claims"]:
                assert claim["type"] in ASSERTION_TYPES
                assert claim["value"].strip()
                assert claim["status"] in {
                    "candidate_first_party",
                    "observed_public_first_party_page",
                }
                assert first_party(claim["url"], domain)


def test_multinational_group_and_commercial_relevance_holds_are_preserved():
    a, b, c = manifests()
    assert {item["domain"] for item in a["first_party_screening"]["collisions"]} == {
        "tenaris.com", "vanleeuwen.com"
    }
    assert a["first_party_screening"]["import_eligibility"] == "none"
    assert b["source_review"]["reuse_rights_clear"] is False
    assert b["source_review"]["legal_verification_complete"] is False
    assert c["source_review"]["reuse_rights_clear"] is False
    assert c["source_review"]["legal_verification_complete"] is False
    assert c["source_review"]["opt_out_review_complete"] is False
    assert c["source_review"]["no_automatic_publication"] is True
    new = {r["domain"]: r for r in c["records"]}
    assert "multinational" in new["isoplus.group"]["group_or_facility_note"].lower()
    assert "metal-online.ro" in new["h-metal.ro"]["group_or_facility_note"]
    assert "mairon" in new["mairon-tubes.ro"]["group_or_facility_note"].lower()
