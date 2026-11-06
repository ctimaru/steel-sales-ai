"""NET-RO1.4.E: single source-backed Romanian bulk wave, no production writes."""
import json
import re
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
MIGRATION = ROOT / "supabase/migrations/20261106161500_net_ro14e_bulk_source_profiles.sql"
WEB20 = ROOT / "services/worker/data/netro14d_web20_curated_20261105.json"


def load():
    sql = MIGRATION.read_text(encoding="utf-8")
    matched = re.search(r"v_cohort constant jsonb := '(\[[^;]*\])'::jsonb;", sql)
    assert matched is not None, "pinned manifest must be present in SQL"
    cohort = json.loads(matched.group(1))
    return sql, cohort


def test_one_wave_covers_122_distinct_romanian_web_candidates_with_fixed_roles():
    sql, cohort = load()
    assert len(cohort) == 122
    assert len({item["domain"] for item in cohort}) == 122
    assert Counter(item["role"] for item in cohort) == {
        "producer": 8, "trader_distributor": 63,
        "processor_service_provider": 51,
    }
    assert all(re.fullmatch(r"[a-z0-9.-]{4,120}", item["domain"]) for item in cohort)
    previous = json.loads(WEB20.read_text(encoding="utf-8"))["candidates"]
    assert {row["domain"] for row in previous}.issubset({row["domain"] for row in cohort})
    for row in previous:
        assert next(item["role"] for item in cohort if item["domain"] == row["domain"]) == row["role_expected"]
    assert "NET-RO1.4.E-BULK122" in sql


def test_bulk_release_is_definition_only_service_gated_and_preview_first():
    sql, _ = load()
    for clause in (
        "p_commit boolean DEFAULT false",
        "IF NOT coalesce(p_commit,false) THEN",
        "'preview_only'",
        "'requires_explicit_commit',true",
        "v_eligible<>v_expected",
        "pg_advisory_xact_lock",
        "LOCK TABLE public.network_companies IN SHARE ROW EXCLUSIVE MODE",
        "network_netfast3_suppressed_domains",
        "s.source_kind='first_party_web'",
        "s.review_lane='web_profile_review_pending'",
        "s.claim_status='unclaimed'",
        "s.verification_status='web_sourced_unverified'",
        "s.publication_status='not_published'",
        "regexp_replace(lower(c.legal_name)",
        "network_ro14c_publication_links",
        "GRANT EXECUTE ON FUNCTION private.network_ro14e_publish_bulk122(boolean)",
        "FROM PUBLIC, anon, authenticated",
        "source_evidence_only",
        "'company_certified',false",
        "'role_confirmed_by_company',false",
        "'published','unclaimed','unverified'",
        "network_company_role_assignments",
        "network_company_products",
        "source_summary ~*",
    ):
        assert clause in sql, clause
    assert "INSERT INTO public.network_company_claims" not in sql
    assert "INSERT INTO public.network_company_certifications" not in sql
    assert "UPDATE private.network_web_research_seeds" not in sql
    assert "UPDATE public.network_companies" not in sql
    assert "CREATE TABLE" not in sql


def test_bulk_wave_replaces_two_track_manual_web20_publication():
    sql, cohort = load()
    assert "Supersedes execution of the older WEB20" in sql
    assert "v_expected constant integer := 122" in sql
    assert "'already_published'" in sql
    assert "'expected_total_public_ro',131" in sql
    assert "'held_private_candidates',125" in sql
    assert "v_previous<>0" in sql
    assert "v_published<>v_expected" in sql
    assert sql.count("INSERT INTO public.network_companies") == 1
    assert len(cohort) > 20
