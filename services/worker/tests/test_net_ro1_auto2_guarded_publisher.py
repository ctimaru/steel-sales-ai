"""NET-RO1 AUTO2.B/A guardrail contract for the Romanian verifier/publisher."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
BASE = ROOT / "supabase/migrations/20261119010500_net_ro1_auto2_private_evidence_register.sql"
PUBLISH = ROOT / "supabase/migrations/20261119011000_net_ro1_auto2_guarded_publisher.sql"


def test_portable_register_is_private_and_non_publishing():
    sql = BASE.read_text(encoding="utf-8")
    assert "CREATE TABLE IF NOT EXISTS private.net_ro1_domain_verification_evidence" in sql
    assert "ENABLE ROW LEVEL SECURITY" in sql
    assert "FROM PUBLIC,anon,authenticated" in sql
    assert "NOT published OR" in sql
    assert "rights_checked" in sql
    assert "permissions_checked" in sql
    assert "INSERT INTO public.network_companies" not in sql


def test_queue_never_reimports_already_published_domains():
    sql = PUBLISH.read_text(encoding="utf-8")
    queue = sql.split("-- RO-AUTO2.B:")[1].split("-- RO-AUTO2.A:")[0]
    assert "private.net_ro1_domain_verification_evidence e" in queue
    assert "public.network_companies c" in queue
    assert "public.network_netfast3_suppressed_domains d" in queue
    assert "s.country_code='RO'" in queue
    assert "s.source_kind='first_party_web'" in queue
    assert "WHEN 'producer' THEN 0" in queue
    assert "WHEN 'processor_service_provider' THEN 1" in queue
    assert "INSERT INTO" not in queue


def test_publisher_requires_full_evidence_and_preview_before_commit():
    sql = PUBLISH.read_text(encoding="utf-8")
    for required in (
        "SECURITY INVOKER",
        "p_commit boolean DEFAULT false",
        "e.provenance_checked",
        "e.rights_checked",
        "e.permissions_checked",
        "e.identity_checked",
        "e.role_checked",
        "e.romania_checked",
        "e.rights_basis IS NOT NULL",
        "e.verified_legal_name IS NOT NULL",
        "e.public_activity_summary IS NOT NULL",
        "publisher_preview_fingerprint",
        "interval '48 hours'",
        "pg_advisory_xact_lock",
        "SHARE ROW EXCLUSIVE MODE",
        "network_netfast3_suppressed_domains",
        "network_ro14c_publication_links",
        "REVOKE ALL ON FUNCTION",
        "TO service_role",
        "'unclaimed','unverified'",
        "'company_verified',false",
        "'technical_capabilities_verified',false",
    ):
        assert required in sql, required
    # Each item is rechecked after prior inserts in the same batch,
    # not just once at cursor creation time.
    assert sql.count("SELECT 1 FROM public.network_companies c") >= 2
    assert "CONTINUE;" in sql
    assert sql.count("INSERT INTO public.network_companies") == 1
    assert sql.count("INSERT INTO public.network_data_assertions") == 1
    assert sql.count("INSERT INTO public.network_company_role_assignments") == 1
    assert "INSERT INTO public.network_contacts" not in sql
    assert "INSERT INTO public.network_company_certifications" not in sql
    assert "INSERT INTO public.network_company_products" not in sql
    assert "SELECT private.net_ro1_auto2_publish_verified(" not in sql
