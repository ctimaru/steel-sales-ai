"""NET-RO1.4.C: public-web claimable pilot, source attribution and fail-closed guards.

No external database is modified by this test. Authenticated affiliation proof
remains the existing P3.6/HP5 flow; no new ownership/verification approval.
"""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
SQL_PATH = ROOT / "supabase/migrations/20261105161000_net_ro14c_claimable_web_pilot.sql"
CTA = ROOT / "apps/web/components/network-activation-cta.tsx"
PROFILE = ROOT / "apps/web/app/(italian)/(workspace)/network/[id]/page.tsx"
CLAIM = ROOT / "apps/web/app/(italian)/(workspace)/network/[id]/claim/page.tsx"

EXPECTED = {
    "artrom.com", "steel-tubes.ro", "baurom.ro", "laser-rmc.ro",
    "zsofia.ro", "metaldistribution.ro", "baduc.ro", "conbuz.ro",
    "plasmarapid.ro",
}


def test_pilot_cohort_uses_only_nine_sourced_domains():
    sql = SQL_PATH.read_text(encoding="utf-8")
    # Three appearances: eligibility, opt-out, exact duplicate/readback, and loop.
    matches = re.findall(r"\('([a-z0-9.-]+)', '([^']+)'\)", sql)
    assert len(matches) == len(EXPECTED) * 4
    assert {domain for domain, _ in matches} == EXPECTED
    assert all(len(description) >= 40 for _, description in matches)
    assert "v_expected constant integer := 9" in sql


def test_commit_never_happens_on_migration_and_preview_is_default():
    sql = SQL_PATH.read_text(encoding="utf-8")
    assert "p_commit boolean DEFAULT false" in sql
    assert "IF NOT coalesce(p_commit,false)" in sql
    assert "'preview_only'" in sql
    assert "'requires_explicit_commit',true" in sql
    assert "v_published<>v_expected" in sql
    assert "pg_advisory_xact_lock" in sql
    assert "LOCK TABLE public.network_companies IN SHARE ROW EXCLUSIVE MODE" in sql
    assert "GRANT EXECUTE ON FUNCTION private.network_ro14c_publish_pilot(boolean)" in sql
    assert "FROM PUBLIC, anon, authenticated" in sql
    assert re.search(r"CREATE TABLE IF NOT EXISTS private\.network_ro14c_publication_links",sql)
    assert "ENABLE ROW LEVEL SECURITY" in sql
    assert "INSERT INTO public.network_companies" in sql
    assert "INSERT INTO public.network_company_claims" not in sql
    assert "UPDATE public.network_company_claims" not in sql
    assert "UPDATE private.network_web_research_seeds" not in sql
    assert "'verified'" not in sql or "'verification_status','unverified'" in sql


def test_claimable_profiles_have_source_provenance_and_correct_role_semantics():
    sql = SQL_PATH.read_text(encoding="utf-8")
    for clause in (
        "s.source_kind='first_party_web'",
        "s.review_lane='web_profile_review_pending'",
        "s.claim_status='unclaimed'",
        "s.verification_status='web_sourced_unverified'",
        "s.publication_status='not_published'",
        "network_netfast3_suppressed_domains",
        "'public_web',v_seed.source_url,'platform_curated'",
        "'verification_status','unverified'",
        "'independent_company_verified',false",
        "'web_source_evidence_only',true",
        "network_company_role_assignments",
        "network_company_products",
        "WHEN 'producer' THEN 'produces'",
        "WHEN 'trader_distributor' THEN 'distributes'",
        "ELSE 'processes'",
        "'tubes_pipes'",
        "'published','unclaimed','unverified'",
    ):
        assert clause in sql, clause
    assert "OD_FIRME" not in sql
    assert "personal_email" not in sql
    assert "certifications" not in sql


def test_claim_entry_is_immediately_visible_but_existing_auth_guards_remain():
    cta = CTA.read_text(encoding="utf-8")
    profile = PROFILE.read_text(encoding="utf-8")
    claim = CLAIM.read_text(encoding="utf-8")
    assert "Rivendica questa azienda" in cta
    assert 'mode==="published"' in cta
    assert '"/network/"+encodeURIComponent(companyId)+"/claim"' in cta
    assert 'data-testid="network-unclaimed-company-claim"' in profile
    assert "Profilo non rivendicato" in profile
    assert '(!adminOrganizationId || !claimState' in profile
    assert 'adminOrganizationId ? (' in profile
    assert 'data-testid="network-company-claim-registration"' in profile
    assert 'href={"/register?company="+encodeURIComponent(displayName)+"&return_to="+encodeURIComponent("/network/"+profile.company.id+"/claim")+"#company-check"}' in profile
    assert '<NetworkActivationCta mode="published"' in profile
    assert "requireWorkspaceAdmin" in claim
    assert "getCompanyClaimExperience" in claim
    assert "requestNetworkClaim" in claim
