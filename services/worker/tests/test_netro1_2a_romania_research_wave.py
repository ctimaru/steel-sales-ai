"""NET-RO1.2a Romania research wave — offline invariants only.

These tests do not verify legal identity, source rights or production uniqueness.
No live connections and no production import can be triggered from this file.
"""
from collections import Counter
import json
from pathlib import Path
from urllib.parse import urlsplit

DATA = Path(__file__).resolve().parents[1] / "data"
FILES = [
    DATA / "netro1_romania_first_party_research_20261105.json",
    DATA / "netro1_2a_romania_research_wave_20261105.json",
]
ROLES = {"producer", "trader_distributor", "processor_service_provider"}


def load():
    return [json.loads(path.read_text(encoding="utf-8")) for path in FILES]


def first_party(url, domain):
    u = urlsplit(url)
    hostname = (u.hostname or "").lower().removeprefix("www.")
    return u.scheme == "https" and (
        hostname == domain or hostname.endswith("." + domain)
    )


def test_two_research_only_waves_have_25_distinct_domains_and_zero_import_authority():
    first, second = load()
    assert first["phase"] == "NET-RO1.1"
    assert second["phase"] == "NET-RO1.2a"
    all_records = first["records"] + second["records"]
    assert len(first["records"]) == 10
    assert len(second["records"]) == 15
    assert len(all_records) == 25
    assert len({r["domain"] for r in all_records}) == 25
    assert sum(len(r["claims"]) for r in all_records) == 50
    assert Counter(r["role"] for r in all_records) == {
        "producer": 6, "trader_distributor": 14,
        "processor_service_provider": 5,
    }
    for wave in (first, second):
        assert wave["mode"] == "research_only"
        assert wave["production_write_authorized"] is False
        assert wave["country"] == "RO"
        assert "batch" not in wave and "kind" not in wave and "import" not in wave


def test_source_and_claim_domains_no_unsourced_capabilities():
    for wave in load():
        for record in wave["records"]:
            assert record["country"] == "RO"
            assert record["role"] in ROLES
            assert record["intake_lane"] == "research_candidate"
            assert first_party(record["identity_url"], record["domain"])
            assert first_party(record["source_url"], record["domain"])
            assert record["legal_identity_status"] == "pending_independent_review"
            assert record["rights_status"] == "pending_independent_review"
            assert record.get("imported") is not True
            assert "registration_id" not in record and "vat_id" not in record
            assert not ({"email", "phone", "contact_person", "rfq", "price", "private_notes"} & record.keys())
            for claim in record["claims"]:
                assert claim["type"] in {
                    "product", "process", "facility", "material", "market",
                    "role", "standard",
                }
                assert claim["value"] and first_party(claim["url"], record["domain"])
                assert claim["status"] in {
                    "candidate_first_party", "observed_public_first_party_page",
                }


def test_shared_multinational_group_domains_remain_holds():
    a, b = load()
    screening = a["first_party_screening"]
    assert screening["import_eligibility"] == "none"
    collision_domains = {c["domain"] for c in screening["collisions"]}
    assert collision_domains == {"tenaris.com", "vanleeuwen.com"}
    assert "zero collisions" in b["source_review"]["screening"]
    assert b["source_review"]["reuse_rights_clear"] is False
    assert b["source_review"]["legal_verification_complete"] is False


def test_ambiguous_processor_technical_relevance_requires_hold():
    a, b = load()
    wave = {r["domain"]: r for r in b["records"]}
    for domain in ("laserprocessing.ro", "comelf.ro"):
        assert "hold" in wave[domain]["group_or_facility_note"].lower()
        assert all(
            "tube" not in c["value"].lower() for c in wave[domain]["claims"]
        )
    # Availability/price/steel grade cannot be inferred from a company type.
    assert all("supplier_qualified" not in r for x in (a, b) for r in x["records"])
