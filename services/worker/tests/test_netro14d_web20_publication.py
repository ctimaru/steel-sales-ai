"""NET-RO1.4.D: 20 website-sourced claimable profile wave, no side effects in tests."""
from collections import Counter
from pathlib import Path
import json
import re

ROOT=Path(__file__).resolve().parents[3]
MANIFEST=ROOT/"services/worker/data/netro14d_web20_curated_20261105.json"
MIGRATION=ROOT/"supabase/migrations/20261105170500_net_ro14d_web20_claimable_publication.sql"
WAVE_C="NET-RO1.4.D-WEB20"


def test_second_publication_wave_has_exactly_20_new_proposed_industrial_entities():
    doc=json.loads(MANIFEST.read_text(encoding="utf-8"))
    entries=doc["candidates"]
    assert doc["public_candidates"]==20
    assert len(entries)==len({e["domain"] for e in entries})==20
    assert Counter(e["role_expected"] for e in entries)=={
      "producer":1,"trader_distributor":15,"processor_service_provider":4
    }
    assert doc["publication"].startswith("not_published")
    assert doc["verification"]=="web_sourced_unverified"
    assert doc["no_automatic_ownership_proof"] is True
    assert all(len(e["description_it"])>=55 and len(e["description_it"])<=350 for e in entries)
    assert all(e["source_basis"]=="first_party_business_page_in_private_network_web_research_seeds" for e in entries)


def test_migration_exact_allowlist_four_times_and_preview_commit_split():
    sql=MIGRATION.read_text(encoding="utf-8")
    entries=json.loads(MANIFEST.read_text(encoding="utf-8"))["candidates"]
    matches=re.findall(r"\('([a-z0-9.-]+)', '([^']+)'\)",sql)
    assert len(matches)==80
    assert {domain for domain,_ in matches}=={e["domain"] for e in entries}
    for e in entries:
        assert (e["domain"], e["description_it"]) in matches
    assert "v_expected constant integer := 20" in sql
    assert "p_commit boolean DEFAULT false" in sql
    assert "IF NOT coalesce(p_commit,false)" in sql
    assert "preview_only" in sql and "requires_explicit_commit" in sql
    assert "private.network_ro14d_publish_wave20" in sql
    assert "private.network_ro14c_publication_links" in sql
    assert sql.count(WAVE_C)>=5
    assert "CREATE TABLE" not in sql


def test_never_publish_without_real_promotion_and_dup_optout_identity_guards():
    sql=MIGRATION.read_text(encoding="utf-8")
    for x in [
        "s.source_kind='first_party_web'",
        "s.review_lane='web_profile_review_pending'",
        "s.claim_status='unclaimed'",
        "s.verification_status='web_sourced_unverified'",
        "s.publication_status='not_published'",
        "network_netfast3_suppressed_domains",
        "v_previous<>0 OR v_existing<>0",
        "pg_advisory_xact_lock",
        "LOCK TABLE public.network_companies IN SHARE ROW EXCLUSIVE MODE",
        "REVOKE ALL ON FUNCTION",
        "FROM PUBLIC, anon, authenticated",
        "GRANT EXECUTE ON FUNCTION private.network_ro14d_publish_wave20(boolean)",
        "RETURN pg_catalog.jsonb_build_object(",
        "'published','unclaimed','unverified'",
        "'public_web',v_seed.source_url,'platform_curated'",
        "'web_source_evidence_only',true",
        "'independent_company_verified',false",
        "network_company_role_assignments",
        "network_company_products",
        "'tubes_pipes'",
        "WHEN 'producer' THEN 'produces'",
        "WHEN 'trader_distributor' THEN 'distributes'",
        "ELSE 'processes'",
    ]:
        assert x in sql, x
    assert "INSERT INTO public.network_company_claims" not in sql
    assert "INSERT INTO public.network_company_certifications" not in sql
    assert "UPDATE private.network_web_research_seeds" not in sql
    assert "ONRC" not in sql


def test_new_publisher_does_not_accidentally_reuse_pilot9_ledger_default():
    sql=MIGRATION.read_text(encoding="utf-8")
    assert "publication_wave" in sql
    assert "v_seed.source_url,'NET-RO1.4.D-WEB20'" in sql
    assert "network_ro14c_publish_pilot" not in sql
    assert "REVOKE ALL ON FUNCTION private.network_ro14d_publish_wave20(boolean)" in sql
    assert "GRANT EXECUTE ON FUNCTION private.network_ro14d_publish_wave20(boolean)" in sql
