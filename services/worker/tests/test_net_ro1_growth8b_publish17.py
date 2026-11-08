"""NET-RO1.GROWTH8.B: 17 Romanian industrial profiles, private-first publisher."""
import json
import re
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
MIGRATION = ROOT / "supabase/migrations/20261108131500_net_ro1_growth8b_end_users17_publisher.sql"
RESEARCH = ROOT / "services/worker/data/netro1_growth8_new25_20261108.json"


def load():
    sql = MIGRATION.read_text(encoding="utf8")
    match = re.search(r"v_cohort constant jsonb := '(\[[^;]*\])'::jsonb;", sql)
    assert match, "pinned manifest must be embedded into definition-only SQL"
    return sql, json.loads(match.group(1))


def test_wave_17_uses_11_end_users_5_processors_and_one_real_tube_producer():
    sql, rows = load()
    assert len(rows) == len({r["domain"] for r in rows}) == 17
    assert len({r["research_id"] for r in rows}) == 17
    assert Counter(r["role"] for r in rows) == {
        "end_user": 11, "processor_service_provider": 5, "producer": 1
    }
    assert all(r["lane"] == "web_profile_review_pending" for r in rows)
    assert all(set(r) == {"domain", "role", "lane", "research_id"} for r in rows)
    assert next(r for r in rows if r["role"] == "producer") == {
        "domain": "mairon-tubes.ro", "role": "producer",
        "lane": "web_profile_review_pending", "research_id": "NET-RO1-026"
    }
    assert "NET-RO1.GROWTH8.B-WEB17" in sql
    assert "'new_end_users',11" in sql
    assert "'new_processors',5" in sql
    assert "'new_producers',1" in sql


def test_no_alias_or_website_integrity_holds_are_published():
    _, rows = load()
    researched = json.loads(RESEARCH.read_text(encoding="utf8"))["candidates"]
    known_ready = {r["canonical_domain"] for r in researched
                   if r["review_lane"] == "web_profile_review_pending"}
    published_new = {r["domain"] for r in rows if r["domain"] != "mairon-tubes.ro"}
    assert len(known_ready) == 16
    assert published_new == known_ready
    assert "didicom.ro" not in published_new
    assert "interpipe.biz" not in published_new
    assert "dacia.ro" not in published_new
    assert "greenbrier-europe.com" not in published_new
    assert "variant-profile.com" not in published_new


def test_publisher_is_service_role_preview_first_and_atomically_fail_closed():
    sql, _ = load()
    for clause in (
        "p_commit boolean DEFAULT false",
        "IF NOT coalesce(p_commit,false) THEN",
        "LOCK TABLE public.network_companies IN SHARE ROW EXCLUSIVE MODE",
        "LOCK TABLE private.network_web_research_seeds IN SHARE ROW EXCLUSIVE MODE",
        "pg_advisory_xact_lock",
        "v_existing_public<>171",
        "v_research_count<>281",
        "v_eligible<>v_expected",
        "v_previous<>0",
        "v_published<>v_expected",
        "network_netfast3_suppressed_domains",
        "network_ro14c_publication_links",
        "s.review_lane=m.lane",
        "s.research_id=m.research_id",
        "other.id<>s.id",
        "source_kind='first_party_web'",
        "'web_profile_review_pending'",
        "source_summary LIKE 'Catalogo ufficiale MAIRON:%'",
        "'preview_only'",
        "'requires_explicit_commit',true",
        "'expected_total_public_ro',188",
        "'already_published'",
        "REVOKE ALL ON FUNCTION private.network_ro1g8b_publish_wave17(boolean)",
        "FROM PUBLIC, anon, authenticated",
        "TO service_role",
    ):
        assert clause in sql, clause
    assert sql.count("INSERT INTO public.network_companies") == 1
    assert sql.count("INSERT INTO private.network_ro14c_publication_links") == 1
    assert "SELECT private.network_ro1g8b_publish_wave17(true)" not in sql
    assert "INSERT INTO public.network_company_claims" not in sql
    assert "INSERT INTO public.network_company_certifications" not in sql
    assert "UPDATE private.network_web_research_seeds" not in sql


def test_end_users_are_unverified_company_roles_not_assumed_tube_buyers():
    sql, _ = load()
    assert "WHEN 'end_user' THEN" in sql
    assert "'industrial_tube_purchases_verified',false" in sql
    assert "'rfq_qualification_verified',false" in sql
    assert "'role_confirmed_by_company',false" in sql
    assert "'company_certified',false" in sql
    assert "'published','unclaimed','unverified'" in sql
    assert "source_reference" in sql and "source_type" in sql
    assert "network_company_role_assignments" in sql
    assert "v_seed.canonical_domain='mairon-tubes.ro'" in sql
    assert sql.count("INSERT INTO public.network_company_products") == 1
    # One permitted tube-product relationship is guarded by MAIRON identity.
    product_block = sql.split("IF v_seed.canonical_domain='mairon-tubes.ro'",1)[1]
    assert "AND v_seed.proposed_role='producer'" in product_block
    assert "VALUES(v_company_id,v_family_id,'produces',v_assertion_id)" in product_block
