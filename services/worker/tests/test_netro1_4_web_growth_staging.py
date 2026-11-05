"""NET-RO1.4 web-growth cohort remains safe, country-scoped and owner-claimable.

Web discovery, not registry certification, is adequate for provisional research
seeds. These tests never connect to Supabase or perform ingestion.
"""
from collections import Counter
from pathlib import Path
import json
import re

ROOT = Path(__file__).resolve().parents[3]
DATA = ROOT / "services" / "worker" / "data"
LEGACY = DATA / "netro1_first50_qualification_ledger_20261105.json"
WAVE = DATA / "netro1_4_web_growth_first17_20261105.json"
MIGRATION = ROOT / "supabase" / "migrations" / "20261105133000_net_ro1_web_seed_research.sql"


def test_67_web_prospects_have_unique_domains_and_correct_industrial_roles():
    first = json.loads(LEGACY.read_text(encoding="utf-8"))
    wave = json.loads(WAVE.read_text(encoding="utf-8"))
    original = first["records"]
    newest = wave["records"]
    assert len(original) == 50
    assert len(newest) == 17
    domains = [r["domain"] for r in original + newest]
    assert len(domains) == len(set(domains)) == 67
    roles = Counter(r["proposed_role"] for r in newest)
    assert roles == {
        "producer": 1,
        "trader_distributor": 13,
        "processor_service_provider": 3,
    }
    assert wave["total_research_domains"] == 67
    assert wave["exact_six_catalog_matches"] == 0
    assert all(r["country"] == "RO" for r in newest)


def test_web_prospects_are_minimal_claimable_and_never_implied_verified():
    wave = json.loads(WAVE.read_text(encoding="utf-8"))
    for r in wave["records"]:
        assert r["source_url"].startswith("https://")
        assert r["claim_status"] == "unclaimed"
        assert r["verification_status"] == "website_sourced_unverified"
        assert r["publication_status"] == "not_published"
        assert r["production_write_authorized"] is False
        assert r["source_kind"] == "company_first_party"
        assert r["source_rights"] == "link_and_independently_paraphrased_facts_only"
        assert r["no_personal_contacts"] is True
        assert r["opt_out_status"] == "unknown"
        assert len(r["summary_it"]) >= 25


def test_critical_role_and_alias_distinctions():
    rows = {r["domain"]: r for r in json.loads(WAVE.read_text(encoding="utf-8"))["records"]}
    assert rows["tubomet.ro"]["proposed_role"] == "producer"
    assert rows["productie-plase.ro"]["proposed_role"] == "trader_distributor"
    assert "do_not_misclassify_as_tube_producer" == rows["productie-plase.ro"]["review_note"]
    assert rows["limshome.ro"]["review_note"].startswith("alias_domain_")
    assert "teava-rectangulara.ro" not in rows
    assert rows["smp-srl.ro"]["proposed_role"] == "processor_service_provider"
    assert rows["nordcut.eu"]["industrial_fit"] == "tube_processing"


def test_staging_migration_private_rls_idempotent_and_no_live_profiles():
    sql = MIGRATION.read_text(encoding="utf-8")
    assert "CREATE TABLE IF NOT EXISTS private.network_web_research_seeds" in sql
    assert "ENABLE ROW LEVEL SECURITY" in sql
    assert "REVOKE ALL" in sql
    assert "anon,authenticated" in sql
    assert "TO service_role" in sql
    assert "ON CONFLICT (country_code,canonical_domain) DO NOTHING" in sql
    assert "network_web_research_seeds_never_published" in sql
    assert "CHECK (publication_status <> 'published')" in sql
    assert "INSERT INTO private.network_web_research_seeds" in sql
    assert "INSERT INTO public.network_companies" not in sql
    assert "UPDATE public.network_companies" not in sql
    assert "CUI" not in sql
    assert "GDPR" not in sql
    sql_domains = re.findall(r"\('RO', '([a-z0-9.-]+)',", sql)
    first = json.loads(LEGACY.read_text(encoding="utf-8"))
    newest = json.loads(WAVE.read_text(encoding="utf-8"))
    expected = {r["domain"] for r in first["records"] + newest["records"]}
    assert len(sql_domains) == len(set(sql_domains)) == 67
    assert set(sql_domains) == expected
