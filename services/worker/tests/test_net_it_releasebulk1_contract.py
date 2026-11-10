"""Releasebulk1 contract checks. Offline-only: no production schema installation."""
import json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
SQL=ROOT/"sql"/"net_it_releasebulk1_proposed.sql"
MANIFEST=ROOT/"data"/"net_it_releasebulk1_pilot3_review_template_20261108.json"
FACTS_POLICY=ROOT/"sql"/"net_it_facts1_policy_proposed.sql"
FACTS_PILOT=ROOT/"data"/"net_it_facts1_carpenteria_pilot3_review_template_20261108.json"

def test_netit_releasebulk1_sql_security_contract():
    sql=SQL.read_text(encoding="utf-8").lower()
    required=(
        "private.require_platform_permission('discovery.governance_review')",
        "private.require_platform_permission('discovery.run')",
        "auth.uid()",
        "web_profile_review_pending",
        "web_sourced_unverified",
        "not_published",
        "unclaimed",
        "source_kind='first_party_web'",
        "rights_reference_url",
        "rights_decision",
        "identity_evidence_url",
        "sha256",
        "p_expected_fingerprint<>v_hash",
        "pg_advisory_xact_lock",
        "lock table public.network_companies",
        "lock table private.network_web_research_seeds",
        "network_netfast3_suppressed_domains",
        "network_core_target_leads",
        "already_published",
        "published_count",
        "revoke all on function public.netit_releasebulk1",
        "grant execute on function public.netit_releasebulk1",
        "security invoker",
        "'role_confirmed_by_company',false",
        "'buyer_confirmed',false",
        "'tube_procurement_confirmed',false",
    )
    for condition in required:
        assert condition in sql, condition
    assert "p_commit boolean default false" in sql
    assert "p_attested boolean default false" in sql
    assert "from public.network_company_roles" in sql

def test_netit_releasebulk1_requires_discovery_publish_for_commit_only():
    """Static fail-closed guard: review grants cannot authorize a publish."""
    sql = SQL.read_text(encoding="utf-8").lower()
    clause = (
        "if coalesce(p_commit,false) then\\n"
        "        perform private.require_platform_permission('discovery.publish');\\n"
        "    end if;"
    )
    assert clause.replace("\\n", "\n") in sql
    # Commit authorization is checked before replay/idempotency and canonical writes.
    guard_index = sql.index("private.require_platform_permission('discovery.publish')")
    assert sql.index("private.require_platform_permission('discovery.run')") < guard_index
    assert guard_index < sql.index("if v_previous>0 then")
    assert guard_index < sql.index("insert into public.network_companies")
    assert sql.count("private.require_platform_permission('discovery.publish')") == 1


def test_netit_releasebulk1_review_template_blocks_false_approval():
    x=json.loads(MANIFEST.read_text(encoding="utf-8"))
    assert x["status"]=="readonly_pilot_blocked_rights_not_submittable"
    assert x["p_commit"] is False and x["attested"] is False
    assert x["p_expected_fingerprint"] is None
    assert x["source_rights_verified"] is False
    assert x["identity_review_completed"] is False
    assert len(x["items"])==3
    assert len({r["seed_id"] for r in x["items"]})==3
    assert len({r["domain"] for r in x["items"]})==3
    expected={"seed_id","domain","role","legal_name","identity_evidence_url","rights_reference_url","rights_decision","rights_note"}
    for row in x["items"]:
        assert set(row)==expected
        assert row["identity_evidence_url"].startswith("https://")
        assert row["rights_reference_url"] is None
        assert row["rights_decision"] is None
        assert row["rights_note"] is None


def test_netit_releasebulk1_replay_hash_and_competing_writes_locked():
    sql=SQL.read_text(encoding="utf-8").lower()
    assert "and p_expected_fingerprint = v_hash then" in sql
    assert "lock table public.network_core_target_leads" in sql
    assert "lock table public.network_company_discovery_candidates" in sql
    assert "lock table public.network_netfast3_suppressed_domains" in sql
    assert "rights_reference_url" in sql
    assert "m.rights_decision in ('allows_limited_reuse','licensed','allows_reuse')" in sql


def test_releasebulk1_legal_identity_and_all_catalog_gates():
    sql=SQL.read_text(encoding="utf-8").lower()
    assert "v_unique_names <> v_expected" in sql
    assert "count(distinct pg_catalog.regexp_replace(" in sql
    for gate in ("network_discovery_domain_leads","network_netfast2_structured_entities","network_netfast3_entities","netfast_discovered_records","network_bulk_intake_rows","network_netfast3b_cordis_research"):
        assert ("from " in sql and gate in sql), gate
    assert "where (lower(c.website_domain)=m.domain" in sql
    assert "where c.archived_at is null and" not in sql
    assert "p_expected_fingerprint = v_hash then" in sql


def test_factsonly_policy_default_disabled_and_platform_privacy_gate():
    policy=FACTS_POLICY.read_text(encoding="utf-8").lower()
    publisher=SQL.read_text(encoding="utf-8").lower()
    assert "enabled boolean not null default false" in policy
    assert "values (true,false) on conflict (singleton) do nothing" in policy
    assert "alter table private.netit_facts1_policy enable row level security" in policy
    assert "revoke all on private.netit_facts1_policy from public, anon, authenticated" in policy
    assert "revoke all on private.netit_facts1_signoff_ledger from public, anon, authenticated" in policy
    assert "private.require_platform_permission('network.privacy_governance_review')" in policy
    assert "private.require_platform_permission('discovery.governance_review')" in policy
    assert "private.require_platform_permission('discovery.publish')" in policy
    assert "auth.uid()" in policy
    assert "revision=revision+1" in policy
    assert "security invoker" in policy
    assert "'factual_metadata_only_reviewed'" in publisher
    assert "m.legal_name ~*" in publisher
    assert "p.legal_review_url=m.rights_reference_url" in publisher
    assert "'facts1_policy_revision'" in publisher
    assert "lock table private.netit_facts1_policy" in publisher


def test_factsonly_internal_legal_review_remains_private():
    publisher=SQL.read_text(encoding="utf-8").lower()
    assertion=publisher.split("insert into public.network_data_assertions(")[1].split(
        "insert into public.network_company_role_assignments(")[0]
    assert "'rights_reference_url'," not in assertion
    assert "'rights_review_note'," not in assertion
    ledger=publisher.split("insert into private.netit_releasebulk1_links(")[1]
    assert "rights_reference_url" in ledger and "rights_note" in ledger


def test_factsonly_three_carpenterie_are_not_preapproved():
    packet=json.loads(FACTS_PILOT.read_text(encoding="utf-8"))
    assert packet["status"]=="review_packet_only_not_submittable"
    assert packet["legal_signoff_status"]=="pending"
    assert packet["platform_signoff_status"]=="pending"
    assert packet["rights_verified"] is False
    assert packet["published_in_this_workstream"]==0
    assert len(packet["items"])==3
    assert len({r["domain"] for r in packet["items"]})==3
    for entry in packet["items"]:
        assert entry["rights_reference_url"] is None
        assert entry["rights_decision"] is None
        assert entry["rights_note"] is None
    for entry in packet["identity_reconciliation"]:
        assert entry["legal_name_reconciled"] is False
