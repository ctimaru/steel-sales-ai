"""NET-RO1.GROWTH9: eight true source-backed fabricators, regional pins & privacy."""
import json
from collections import Counter
from pathlib import Path

ROOT=Path(__file__).resolve().parents[3]
MANIFEST=ROOT/"services/worker/data/net_ro1_growth9_fabricators8_20261108.json"
STAGE=ROOT/"supabase/migrations/20261108133000_net_ro1_growth9_fab8_private_research.sql"
PUBLISH=ROOT/"supabase/migrations/20261108134000_net_ro1_growth9_fab8_publisher.sql"

def test_eight_exact_first_party_sources_and_role_splits():
    companies=json.loads(MANIFEST.read_text(encoding="utf8"))["companies"]
    assert len(companies)==8
    assert len({x["canonical_domain"] for x in companies})==8
    assert len({x["research_id"] for x in companies})==8
    assert Counter(x["proposed_role"] for x in companies)=={
        "producer":2,"processor_service_provider":4,"end_user":2}
    assert Counter(x["nuts"] for x in companies)=={
        "RO11":4,"RO21":2,"RO31":1,"RO41":1}
    for row in companies:
        assert row["source_kind"]=="first_party_web"
        assert row["review_lane"]=="web_profile_review_pending"
        assert row["publication_status"]=="not_published"
        assert row["claim_status"]=="unclaimed"
        assert row["verification_status"]=="web_sourced_unverified"
        assert row["source_url"].startswith("https://")
        host=row["source_url"].split("/")[2].removeprefix("www.")
        assert host==row["canonical_domain"]
        assert row["city"] and row["province"] and row["region"]


def test_stage_private_and_publisher_definition_only():
    stage=STAGE.read_text(encoding="utf8")
    publisher=PUBLISH.read_text(encoding="utf8")
    assert stage.count("INSERT INTO private.network_web_research_seeds")==1
    assert "INSERT INTO public.network_companies" not in stage
    assert "INSERT INTO public.network_contacts" not in stage
    assert "v_count<>8" in stage and "v_inserted<>8" in stage
    assert "network_netfast3_suppressed_domains" in stage
    assert "p_commit boolean DEFAULT false" in publisher
    assert "v_existing<>188" in publisher
    assert "v_research<>289" in publisher
    assert "v_eligible<>v_expected" in publisher
    assert "v_published<>v_expected" in publisher
    assert "'already_published'" in publisher
    assert "network_ro14c_publication_links" in publisher
    assert "network_netfast3_suppressed_domains" in publisher
    assert publisher.count("INSERT INTO public.network_companies")==1
    assert publisher.count("INSERT INTO public.network_facilities")==1
    assert publisher.count("INSERT INTO public.network_company_role_assignments")==1
    assert "eu_nuts2024_code" in publisher
    assert "NOT EXISTS(SELECT 1 FROM public.network_companies" in publisher
    assert "NOT EXISTS(SELECT 1 FROM private.network_web_research_seeds other" in publisher
    assert "REVOKE ALL ON FUNCTION private.netro_growth9_publish_fab8(boolean)" in publisher
    assert "TO service_role" in publisher
    assert "SELECT private.netro_growth9_publish_fab8(true)" not in publisher
    assert "INSERT INTO public.network_company_products" not in publisher
    assert "INSERT INTO public.network_company_claims" not in publisher
    assert "INSERT INTO public.network_contacts" not in publisher


def test_source_only_contacts_are_reviewed_by_existing_governance():
    publisher=PUBLISH.read_text(encoding="utf8")
    assert "Contact publication requires NET-CONTACT1" in publisher
    assert "role_confirmed_by_company',false" in publisher
    assert "tube_purchases_verified',false" in publisher
    assert "'published','unclaimed','unverified'" in publisher
