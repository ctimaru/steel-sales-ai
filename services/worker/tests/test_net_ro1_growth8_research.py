"""NET-RO1.GROWTH8: new buyer/processor sourcing and full held-85 reconciliation."""
import json
import re
from collections import Counter
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[3]
DATA = ROOT / "services/worker/data"
MIGRATIONS = ROOT / "supabase/migrations"
NEW = DATA / "netro1_growth8_new25_20261108.json"
HELD = DATA / "netro1_growth8_reconcile85_20261108.json"
INTAKE = MIGRATIONS / "20261108123000_net_ro1_growth8_new25_web_research.sql"
MAIRON = MIGRATIONS / "20261108123100_net_ro1_growth8_mairon_manufacturer_clearance.sql"


def load():
    leads = json.loads(NEW.read_text(encoding="utf8"))["candidates"]
    held = json.loads(HELD.read_text(encoding="utf8"))
    return leads, held, INTAKE.read_text(encoding="utf8"), MAIRON.read_text(encoding="utf8")


def test_first_party_25_are_distinct_and_industrial_roles_are_explicit():
    leads, _, _, _ = load()
    assert len(leads) == 25
    assert len({c["canonical_domain"] for c in leads}) == 25
    assert len({c["research_id"] for c in leads}) == 25
    assert Counter(c["proposed_role"] for c in leads) == {
        "end_user": 16, "processor_service_provider": 7, "producer": 2
    }
    assert all(c["country_code"] == "RO" for c in leads)
    assert all(c["source_kind"] == "first_party_web" for c in leads)
    assert all(c["publication_status"] == "not_published"
               and c["verification_status"] == "web_sourced_unverified"
               and c["claim_status"] == "unclaimed" for c in leads)
    for c in leads:
        assert c["source_url"].startswith("https://")
        assert urlparse(c["source_url"]).hostname.removeprefix("www.") == c["canonical_domain"]
        assert len(c["source_summary"]) >= 35
        assert c["research_id"].startswith("NET-RO1-G8-")
    assert "end_user" in {c["proposed_role"] for c in leads}


def test_producers_with_shared_group_or_non_tube_evidence_remain_held():
    leads, _, _, _ = load()
    holds = {c["canonical_domain"]: c["review_lane"] for c in leads
             if c["review_lane"] != "web_profile_review_pending"}
    assert holds["interpipe.biz"] == "multinational_group_local_facility_review"
    assert holds["variant-profile.com"] == "non_tubular_profile_product_review"
    assert holds["greenbrier-europe.com"] == "multinational_group_local_facility_review"
    assert holds["jpx.ro"] == "brand_legal_identity_review"
    assert holds["dacia.ro"] == "group_brand_legal_identity_review"
    assert "web_profile_review_pending" in {c["review_lane"] for c in leads}


def test_all_85_prior_exceptions_are_accounted_for_not_auto_published():
    _, held, _, _ = load()
    rows = held["records"]
    assert len(rows) == held["held_research_records"] == 85
    assert held["public_ro_baseline"] == 171
    assert len({r["domain"] for r in rows}) == 85
    assert sum(held["counts_by_disposition"].values()) == 85
    assert held["counts_by_disposition"] == {
        "identity_or_alias": 31, "industrial_product_fit": 15,
        "retail_b2b_fit": 29, "source_stale": 6,
        "source_cleared_awaiting_migration": 1,
        "other_review": 1, "cross_border_group": 2,
    }
    assert all(not r["publication_approved"] and r["next_action"] for r in rows)
    collisions = [r for r in rows if r["review_group"] == "cross_border_group"]
    assert {r["domain"] for r in collisions} == {"tenaris.com", "vanleeuwen.com"}
    assert all(r["cross_border_canonical"]["country"] != "RO" for r in collisions)
    mairon = next(r for r in rows if r["domain"] == "mairon-tubes.ro")
    assert mairon["review_group"] == "source_cleared_awaiting_migration"


def test_research_migration_adds_private_rows_only_with_fail_closed_checks():
    leads, _, sql, _ = load()
    assert "DO $growth8$" in sql
    assert "v_expected constant integer := 25" in sql
    assert sql.count("INSERT INTO private.network_web_research_seeds(") == 1
    assert "INSERT INTO public." not in sql
    assert "ON CONFLICT DO NOTHING" not in sql
    assert "v_eligible<>v_expected" in sql and "v_inserted<>v_expected" in sql
    assert "network_netfast3_suppressed_domains" in sql
    assert "public.network_companies" in sql
    assert "network_company_roles" in sql
    assert "count(DISTINCT" in sql
    assert "company_claim" not in sql
    assert "company_certification" not in sql
    assert all(c["canonical_domain"] in sql for c in leads)


def test_mairon_is_narrow_source_enrichment_not_unverified_mill_certification():
    _, _, _, sql = load()
    assert "UPDATE private.network_web_research_seeds" in sql
    assert "canonical_domain='mairon-tubes.ro'" in sql
    assert "research_id='NET-RO1-026'" in sql
    assert "review_lane='group_facility_review'" in sql
    assert "SET review_lane='web_profile_review_pending'" in sql
    assert "CatalogMaironeng2024.pdf" in sql
    assert "v_count<>1" in sql
    assert "public.network_netfast3_suppressed_domains" in sql
    assert "INSERT INTO public." not in sql
    assert "network_company_certifications" not in sql
