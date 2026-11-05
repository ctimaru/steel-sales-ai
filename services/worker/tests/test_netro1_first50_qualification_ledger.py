"""NET-RO1.2b independent qualification queue — offline safety assertions.

A domain or normalized-name lookup is NOT legal-entity dedup or licence review.
This ledger is a review queue and cannot be used as an import manifest.
"""
from collections import Counter
import json
from pathlib import Path

DATA = Path(__file__).resolve().parents[1] / "data"
WAVES = [
    DATA / "netro1_romania_first_party_research_20261105.json",
    DATA / "netro1_2a_romania_research_wave_20261105.json",
    DATA / "netro1_2b_romania_research_wave_20261105.json",
]
LEDGER = DATA / "netro1_first50_qualification_ledger_20261105.json"


def read():
    waves = [json.loads(p.read_text(encoding="utf-8")) for p in WAVES]
    ledger = json.loads(LEDGER.read_text(encoding="utf-8"))
    return waves, ledger


def test_ledger_matches_all_50_unique_candidate_domains():
    waves, ledger = read()
    expected = {
        r["domain"]: (w["phase"], r["name"], r["role"], r["source_url"], len(r["claims"]))
        for w in waves for r in w["records"]
    }
    assert len(expected) == 50
    assert len(ledger["records"]) == 50
    actual = {
        r["domain"]: (r["wave"], r["name"], r["proposed_role"], r["source_url"], r["claim_count"])
        for r in ledger["records"]
    }
    assert expected == actual
    assert ledger["totals"]["candidate_websites"] == 50
    assert ledger["totals"]["unique_domains"] == 50
    assert ledger["totals"]["claim_urls"] == 100
    assert ledger["country"] == "RO"


def test_source_legal_and_import_permissions_remain_blocked():
    _, ledger = read()
    assert ledger["mode"] == "research_only"
    assert ledger["production_write_authorized"] is False
    assert ledger["import_authorization"] == "DENIED_PENDING_REVIEW"
    assert ledger["totals"]["confirmed_new_legal_entities"] == 0
    assert ledger["totals"]["qualification_completed"] == 0
    assert ledger["totals"]["imported_by_NET_RO1"] == 0
    assert not ({"batch", "kind", "apply", "import"} & ledger.keys())
    for candidate in ledger["records"]:
        assert candidate["legal_identity_status"] == "pending_independent_review"
        assert candidate["source_rights_status"] == "pending_independent_review"
        assert candidate["opt_out_status"] == "pending_independent_review"
        assert candidate["technical_semantics_status"] == "pending_independent_review"
        assert candidate["company_facility_separation_status"] == "pending_independent_review"
        assert candidate["import_ready"] is False
        assert candidate["publication_approved"] is False


def test_explicit_holds_and_research_lanes():
    _, ledger = read()
    categories = Counter(r["qualification_lane"] for r in ledger["records"])
    assert categories == {
        "pending_legal_and_source_rights_review": 41,
        "shared_domain_collision_hold": 2,
        "group_facility_review": 5,
        "industrial_relevance_hold": 2,
    }
    assert categories == ledger["totals"]["lanes"]
    assert ledger["catalog_results"]["matched_group_domains"] == [
        "tenaris.com", "vanleeuwen.com"
    ]
    candidates = {r["domain"]: r for r in ledger["records"]}
    assert candidates["tenaris.com"]["exact_catalog_screen"] == "shared_domain_collision_it"
    assert candidates["vanleeuwen.com"]["exact_catalog_screen"] == "shared_domain_collision_it"
    assert candidates["comelf.ro"]["qualification_lane"] == "industrial_relevance_hold"
    assert candidates["laserprocessing.ro"]["qualification_lane"] == "industrial_relevance_hold"
    assert not any(r["import_ready"] for r in ledger["records"])
