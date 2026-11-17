"""A5.5.1 — prioritisation is observational, source-local, and access-scoped."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
SQL = (
    ROOT / "supabase/migrations"
    / "20261117161700_net_producers_auto1a551_prioritise_confirmed_page_mentions.sql"
).read_text().lower()


def test_priority_uses_confirmed_claims_from_identical_first_party_sha():
    assert "same_page_observations" in SQL
    for suffix in ("n", "g"):
        for guard in (
            f"{suffix}.company_id=p.company_id",
            f"{suffix}.source_url=p.source_url",
            f"{suffix}.source_sha256=p.last_sha256",
            f"{suffix}.evidence_status='confirmed'",
        ):
            assert guard in SQL
    assert "n.claim_kind='technical_standard'" in SQL
    assert "g.claim_kind='steel_grade'" in SQL
    assert "case when same_page_observations then 0 else 1 end" in SQL
    assert "ranked as (" in SQL
    assert "order by" in SQL


def test_sql_keeps_a55_sampling_and_current_source_guards():
    for guard in (
        "not between 1 and 12",
        "domain_rank<=2",
        "p.status in ('processed','candidate_review')",
        "p.next_check_at>now()",
        "p.last_checked_at>=now()-interval '35 days'",
        "p.root_sha256=q.last_sha256",
        "p.root_source_url=q.source_url",
        "q.source_url=c.website_url",
        "q.canonical_domain=c.website_domain",
        "c.country_code='it'",
        "c.publication_status='published'",
        "c.archived_at is null",
        "r.canonical_key='producer'",
        "r.status='active'",
        "'netproducers-auto1a55-product-audit-sample-v1'",
        "source_sha256",
    ):
        assert guard in SQL
    assert SQL.count("$body$;") == 1
    assert "stable security definer set search_path=''" in SQL


def test_security_no_public_access_no_mutation_no_false_sku():
    assert SQL.count("from public,anon,authenticated;") == 2
    assert SQL.count("to service_role;") == 2
    for forbidden in (
        "update private.", "insert into private.", "delete from private.",
        "truncate ", "alter table ", "drop table ",
        "'confirmed_capacity'", "'exact_product'", "'confirmed_sku'",
        "http_get(", "netproducers1_auto1a4_complete_page(",
    ):
        assert forbidden not in SQL
    assert "same-page mention != same-row exact capacity" in SQL
    assert "same-page mention" in SQL
