"""NET-RO1.GROWTH9.C: reconcile all 72 and protect 15 first-party Romanian profiles."""
import json
import re
from collections import Counter
from pathlib import Path

ROOT=Path(__file__).resolve().parents[3]
DATA=ROOT/"services/worker/data"
MIG=ROOT/"supabase/migrations"

def load():
    source=json.loads((DATA/"net_ro1_growth9c_fabricators15_firstparty_20261108.json").read_text(encoding="utf-8"))
    review=json.loads((DATA/"net_ro1_growth9c_reconcile72_20261108.json").read_text(encoding="utf-8"))
    stage=(MIG/"20261108150000_net_ro1_growth9c_fab15_private_research.sql").read_text(encoding="utf-8")
    publisher=(MIG/"20261108151000_net_ro1_growth9c_fab15_publisher.sql").read_text(encoding="utf-8")
    return source,review,stage,publisher

def test_72_held_leads_reconciled_with_exactly_15_source_clearances():
    source,review,_,_=load()
    assert review["total_held_snapshot"]==72==len(review["records"])
    assert review["source_cleared_for_atomic_publication"]==15
    assert review["still_in_review"]==57
    assert len({r["source_row"] for r in review["records"]})==72
    assert len(source["companies"])==15
    assert all(not r["publication_approved"] for r in review["records"])
    approved={r["source_row"] for r in review["records"] if r["decision"]=="source_cleared_web_profile_review_pending"}
    assert approved=={c["census_row"] for c in source["companies"]}
    assert len([r for r in review["records"] if r["decision"]!="source_cleared_web_profile_review_pending"])==57
    assert review["counts_by_decision"]["needs_primary_company_website_and_activity_match"]==52
    assert {r["normalized_company_name"] for r in review["records"] if "group_domain" in r["decision"]} == {
        "ZAUNER ROMANIA SRL","EMSIL TECHTRANS SRL"
    }
    holds={r["normalized_company_name"]:r["decision"] for r in review["records"]}
    assert holds["MIRAS INTERNATIONAL SRL"]=="group_legal_split_and_geography_review"
    assert holds["DEXION STORAGE SOLUTIONS SRL"]=="multinational_domain_legal_identity_review"
    assert holds["EUROZONE METAL SRL"]=="trader_not_core_fabricator_review"

def test_manufacturers_processors_and_end_users_are_unclaimed_source_records():
    source,_,_,_=load()
    rows=source["companies"]
    assert Counter(x["proposed_role"] for x in rows)=={
        "processor_service_provider":10,"end_user":4,"producer":1
    }
    assert len({x["canonical_domain"] for x in rows})==15
    assert len({x["research_id"] for x in rows})==15
    assert len({x["census_row"] for x in rows})==15
    for x in rows:
        assert x["source_kind"]=="first_party_web"
        assert x["source_url"].startswith("https://")
        assert x["canonical_domain"]==x["source_url"].split("/")[2].removeprefix("www.")
        assert x["review_lane"]=="web_profile_review_pending"
        assert x["publication_status"]=="not_published"
        assert x["claim_status"]=="unclaimed"
        assert x["verification_status"]=="web_sourced_unverified"
        assert x["city"] and x["province"] and x["nuts"] and x["region"]
        assert x["batch_key"]=="NET-RO1-G9C-FAB15"
        assert x["research_id"].startswith("NET-RO1-G9C-")
        if x["public_company_contact_email"]:
            assert x["public_company_contact_email"].split("@")[1]==x["canonical_domain"]
    assert next(x for x in rows if x["proposed_role"]=="producer")["canonical_domain"]=="peikko.ro"

def test_private_stage_is_atomic_and_checks_duplicate_names_domains_sources_and_nuts():
    source,_,sql,_=load()
    assert "v_count<>15" in sql and "v_inserted<>15" in sql
    assert "INSERT INTO private.network_web_research_seeds" in sql
    assert "INSERT INTO public.network_companies" not in sql
    assert "INSERT INTO public.network_contacts" not in sql
    for term in ("network_company_roles","network_eu_nuts2024_regions",
                 "network_netfast3_suppressed_domains","public.network_companies",
                 "pg_advisory_xact_lock","SHARE ROW EXCLUSIVE",
                 "count(DISTINCT x.canonical_domain)","count(DISTINCT x.research_id)"):
        assert term in sql
    m=re.search(r"v_manifest constant jsonb := '([\s\S]*?)'::jsonb;",sql)
    assert m
    embedded=json.loads(m.group(1).replace("''","'"))
    assert len(embedded)==len(source["companies"])==15

def test_definition_only_publisher_service_role_idempotency_and_source_limits():
    _,_,_,sql=load()
    for term in (
      "private.netro_growth9c_publish_fab15",
      "p_commit boolean DEFAULT false",
      "v_expected constant integer := 15",
      "v_existing<>196",
      "v_research<>304",
      "v_eligible<>v_expected",
      "v_prev<>0",
      "v_published<>v_expected",
      "network_netfast3_suppressed_domains",
      "network_ro14c_publication_links",
      "m.domain=c.website_domain AND m.research_id=l.research_id",
      "pg_advisory_xact_lock",
      "'expected_total_public_ro',211",
      "'already_public_ro_expected',196",
      "'eligible',15",
      "'would_publish',15",
      "REVOKE ALL ON FUNCTION private.netro_growth9c_publish_fab15(boolean)",
      "TO service_role",
      "netro_growth9c_fabricator_web",
      "eu_nuts2024_code",
      "'published','unclaimed','unverified'",
      "'tube_purchases_verified',false",
      "'certified',false",
      "'owner_verified',false",
    ):
        assert term in sql,term
    assert sql.count("INSERT INTO public.network_companies")==1
    assert sql.count("INSERT INTO public.network_facilities")==1
    assert sql.count("INSERT INTO public.network_company_role_assignments")==1
    assert "SELECT private.netro_growth9c_publish_fab15(true)" not in sql
    assert "INSERT INTO public.network_contacts" not in sql
    assert "INSERT INTO public.network_company_claims" not in sql
    assert "INSERT INTO public.network_company_certifications" not in sql
    assert "INSERT INTO public.network_company_products" not in sql
