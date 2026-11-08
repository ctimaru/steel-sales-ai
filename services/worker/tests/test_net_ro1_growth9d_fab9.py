"""NET-RO1.GROWTH9.D: web-sourced Romanian fabrication expansion and safe publication."""
import json
import re
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
DATA = ROOT / "services/worker/data"
MIG = ROOT / "supabase/migrations"


def load():
    manifest = json.loads((DATA / "net_ro1_growth9d_fabricators9_20261108.json").read_text(encoding="utf8"))
    review = json.loads((DATA / "net_ro1_growth9d_reconcile57_20261108.json").read_text(encoding="utf8"))
    staging = (MIG / "20261108160000_net_ro1_growth9d_fab9_private_research.sql").read_text(encoding="utf8")
    publishing = (MIG / "20261108161000_net_ro1_growth9d_fab9_publisher.sql").read_text(encoding="utf8")
    return manifest, review, staging, publishing


def test_all_57_prior_held_research_leads_reconciled():
    manifest, review, _, _ = load()
    assert len(review["records"]) == review["initial_held"] == 57
    assert review["source_cleared"] == 9
    assert review["still_held"] == 48
    assert len({r["source_row"] for r in review["records"]}) == 57
    assert sum(review["counts_by_disposition"].values()) == 57
    assert all(r["publication_approved"] is False for r in review["records"])
    ready = {r["source_row"] for r in review["records"] if r["decision"] == "source_cleared_web_profile_review_pending"}
    assert len(ready) == 9
    assert ready == {x["census_row"] for x in manifest["companies"]}
    assert all(r["next_action"] for r in review["records"])
    holds = {r["normalized_company_name"]:r["decision"] for r in review["records"]}
    assert holds["ZAUNER ROMANIA SRL"] == "group_domain_legal_identity_review"
    assert holds["EMSIL TECHTRANS SRL"] == "group_domain_legal_identity_review"
    assert holds["MIRAS INTERNATIONAL SRL"] == "group_legal_split_and_geography_review"
    assert holds["DEXION STORAGE SOLUTIONS SRL"] == "multinational_domain_legal_identity_review"
    assert holds["EUROZONE METAL SRL"] == "trader_not_core_fabricator_review"
    assert holds["MOSKAT"] == "group_legal_entity_mapping_review"


def test_company_website_and_unverified_role_sources():
    m, _, _, _ = load()
    rows = m["companies"]
    assert len(rows) == 9
    assert len({r["canonical_domain"] for r in rows}) == 9
    assert len({r["research_id"] for r in rows}) == 9
    assert Counter(r["proposed_role"] for r in rows) == {
        "processor_service_provider":8,"producer":1
    }
    assert next(r for r in rows if r["proposed_role"] == "producer")["canonical_domain"] == "ozelsteelprofil.ro"
    for r in rows:
        assert r["country_code"] == "RO"
        assert r["source_kind"] == "first_party_web"
        assert r["source_url"].startswith("https://")
        assert r["source_url"].split("/")[2].removeprefix("www.") == r["canonical_domain"]
        assert r["review_lane"] == "web_profile_review_pending"
        assert r["publication_status"] == "not_published"
        assert r["claim_status"] == "unclaimed"
        assert r["verification_status"] == "web_sourced_unverified"
        assert r["region"] and r["province"] and r["city"] and r["nuts"]
        assert r["batch_key"] == "NET-RO1-G9D-FAB9"
        if r["public_company_contact_email"]:
            assert r["public_company_contact_email"].split("@")[1] == r["canonical_domain"]
    assert "NON" in next(r for r in rows if r["canonical_domain"] == "ozelsteelprofil.ro")["source_summary"]


def test_staging_migration_private_only_fails_on_duplicates():
    m, _, sql, _ = load()
    assert sql.count("INSERT INTO private.network_web_research_seeds") == 1
    assert "INSERT INTO public.network_companies" not in sql
    assert "INSERT INTO public.network_contacts" not in sql
    assert "v_count<>9" in sql and "v_inserted<>9" in sql
    assert "network_netfast3_suppressed_domains" in sql
    assert "network_eu_nuts2024_regions" in sql
    assert "pg_advisory_xact_lock" in sql
    assert "SHARE ROW EXCLUSIVE MODE" in sql
    assert "NOT EXISTS (SELECT 1 FROM public.network_companies" in sql
    pattern = re.search(r"v_manifest constant jsonb := '([\s\S]*?)'::jsonb;",sql)
    assert pattern
    embedded=json.loads(pattern.group(1).replace("''","'"))
    assert len(embedded) == len(m["companies"]) == 9


def test_publisher_requires_service_preview_and_one_atomic_release():
    _, _, _, sql = load()
    for term in (
        "private.netro_growth9d_publish_fab9",
        "p_commit boolean DEFAULT false",
        "v_expected constant integer := 9",
        "v_existing<>211",
        "v_research<>313",
        "v_eligible<>v_expected",
        "v_prev<>0",
        "v_published<>v_expected",
        "network_netfast3_suppressed_domains",
        "network_ro14c_publication_links",
        "m.domain=c.website_domain AND m.research_id=l.research_id",
        "pg_advisory_xact_lock",
        "SHARE ROW EXCLUSIVE MODE",
        "'expected_total_public_ro',220",
        "'already_public_ro_expected',211",
        "'eligible',9",
        "'would_publish',9",
        "REVOKE ALL ON FUNCTION private.netro_growth9d_publish_fab9(boolean)",
        "TO service_role",
        "netro_growth9d_fabricator_web",
        "eu_nuts2024_code",
        "'published','unclaimed','unverified'",
        "'tube_purchases_verified',false",
        "'owner_verified',false",
    ):
        assert term in sql, term
    assert sql.count("INSERT INTO public.network_companies") == 1
    assert sql.count("INSERT INTO public.network_facilities") == 1
    assert sql.count("INSERT INTO public.network_company_role_assignments") == 1
    for unsafe in (
        "SELECT private.netro_growth9d_publish_fab9(true)",
        "INSERT INTO public.network_contacts",
        "INSERT INTO public.network_company_claims",
        "INSERT INTO public.network_company_certifications",
        "INSERT INTO public.network_company_products",
    ):
        assert unsafe not in sql, unsafe
