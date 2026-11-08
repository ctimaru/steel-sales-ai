"""NET-RO1.GROWTH7: single protected web-first Romania promotion of 40 held leads."""
import json
import re
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
MIGRATION = ROOT / "supabase/migrations/20261108110000_net_ro1_growth7_bulk40.sql"


def load():
    sql = MIGRATION.read_text(encoding="utf-8")
    found = re.search(r"v_cohort constant jsonb := '(\[[^;]*\])'::jsonb;", sql)
    assert found, "Publisher requires a pinned domain/role/review-lane manifest"
    return sql, json.loads(found.group(1))


def test_40_pinned_domains_roles_and_original_review_lanes():
    sql, manifest = load()
    assert len(manifest) == 40
    assert len({item["domain"] for item in manifest}) == 40
    assert Counter(row["role"] for row in manifest) == {
        "producer": 2,
        "processor_service_provider": 26,
        "trader_distributor": 12,
    }
    assert all(set(row) == {"domain", "role", "lane"} for row in manifest)
    assert all(re.fullmatch(r"[a-z0-9.-]{4,120}", row["domain"]) for row in manifest)
    assert all(re.fullmatch(r"[a-z0-9_-]{4,100}", row["lane"]) for row in manifest)
    assert {"estmetalcab.ro", "girometal.ro", "romnef.com", "steelprofile.ro"} <= {
        row["domain"] for row in manifest
    }
    assert "NET-RO1.GROWTH7-BULK40" in sql
    assert sql.count("review_lane=m.lane") == 2
    assert sql.count("lane text") == 4


def test_preview_and_atomic_publication_remain_service_only():
    sql, _ = load()
    for clause in (
        "p_commit boolean DEFAULT false",
        "IF NOT coalesce(p_commit,false) THEN",
        "'preview_only'",
        "'requires_explicit_commit',true",
        "v_expected constant integer := 40",
        "v_existing_public<>131",
        "'expected_total_public_ro',171",
        "'held_private_candidates',85",
        "v_eligible<>v_expected",
        "v_published<>v_expected",
        "pg_advisory_xact_lock",
        "LOCK TABLE public.network_companies IN SHARE ROW EXCLUSIVE MODE",
        "network_netfast3_suppressed_domains",
        "s.source_kind='first_party_web'",
        "s.claim_status='unclaimed'",
        "s.verification_status='web_sourced_unverified'",
        "s.publication_status='not_published'",
        "s.review_lane=m.lane",
        "other.id<>s.id",
        "network_ro14c_publication_links",
        "GRANT EXECUTE ON FUNCTION private.network_ro1g_publish_bulk40(boolean)",
        "FROM PUBLIC, anon, authenticated",
        "'company_certified',false",
        "'role_confirmed_by_company',false",
        "'source_review_lane',v_seed.review_lane",
        "'published','unclaimed','unverified'",
    ):
        assert clause in sql, clause
    assert "INSERT INTO public.network_company_claims" not in sql
    assert "INSERT INTO public.network_company_certifications" not in sql
    assert "UPDATE private.network_web_research_seeds" not in sql
    assert "UPDATE public.network_companies" not in sql
    assert "CREATE TABLE" not in sql
    assert sql.count("INSERT INTO public.network_companies") == 1


def test_do_not_infer_tube_product_for_every_generic_steel_processor():
    sql, _ = load()
    line = re.search(r"IF v_seed.canonical_domain IN \(([^)]*)\)", sql)
    assert line is not None
    domains = re.findall(r"'([a-z0-9.-]+)'", line.group(1))
    assert len(domains) == 15
    assert len(set(domains)) == len(domains)
    for known_non_tube in ("bormanmetal.ro", "crosconstruct.ro", "feper.ro",
                           "laser-nsc.ro", "metalxpert.ro", "tibpet.com"):
        assert known_non_tube not in domains
    assert "AND v_seed.source_summary ~*" in sql
    assert "v_previous<>0" in sql
    assert "'already_published'" in sql
