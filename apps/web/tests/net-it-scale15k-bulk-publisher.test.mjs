import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), "utf8");
const migration = read("../../../supabase/migrations/20261110134500_net_it_scale15k_bulk_publisher.sql");
const page = read("../app/(italian)/(platform)/platform/company-discovery/scale15k/page.tsx");
const action = read("../app/(italian)/(platform)/platform/company-discovery/scale15k/actions.ts");

test("Bulk publisher requires genuine Platform and source governance, never auto-approves", () => {
  assert.match(migration, /CREATE OR REPLACE FUNCTION private\.net_it_scale15k_bulk_publish_impl/);
  assert.match(migration, /auth\.uid\(\)/);
  assert.match(migration, /require_platform_permission\('discovery\.governance_review'\)/);
  assert.match(migration, /require_platform_permission\('discovery\.publish'\)/);
  assert.match(migration, /s\.governance_status='approved_company_data'/);
  assert.match(migration, /s\.source_governance='approved'/);
  assert.match(migration, /s\.source_reviewer IS NOT NULL/);
  assert.match(migration, /s\.source_reviewed_at IS NOT NULL/);
  assert.match(migration, /s\.terms_status IN \('allows_reuse','allows_limited_reuse'\)/);
  assert.match(migration, /s\.database_rights_status IN \('low_risk','licensed'\)/);
  assert.match(migration, /s\.personal_data_policy IN \('company_data_only','exclude_personal_data'\)/);
  assert.match(migration, /NOT s\.personal_data_detected/);
  assert.match(migration, /s\.minimal_eligible IS TRUE/);
  assert.match(migration, /s\.role_keys/);
  assert.doesNotMatch(migration, /(?:SET\s+governance_status\s*=|'approved_company_data'\s*AS\s*governance_status)/i);
});

test("One atomic 1–100 wave uses reviewed fingerprint and leaves historical publisher OFF", () => {
  assert.match(migration, /v_requested NOT BETWEEN 1 AND 100/);
  assert.match(migration, /array_agg\(id ORDER BY id\)/);
  assert.match(migration, /count\(DISTINCT lower\(trim\(c\.canonical_domain\)\)\)/);
  assert.match(migration, /sha256\(convert_to/);
  assert.match(migration, /p_expected_fingerprint<>v_fingerprint/);
  assert.match(migration, /p_attested IS DISTINCT FROM true/);
  assert.match(migration, /length\(btrim\(COALESCE\(p_review_note,''\)\)\) NOT BETWEEN 80 AND 2000/);
  assert.match(migration, /pg_catalog\.pg_advisory_xact_lock\(810021,20262\)/);
  assert.match(migration, /LOCK TABLE public\.network_companies/);
  assert.match(migration, /UPDATE private\.net_pipeline1b2_settings SET enabled=true/);
  assert.match(migration, /public\.net_pipeline1b2_publish_one\(v_row\.id\)/);
  assert.match(migration, /UPDATE private\.net_pipeline1b2_settings SET enabled=false/);
  assert.match(migration, /net_it_scale15k_publication_waves/);
  assert.match(migration, /UNIQUE/);
  assert.doesNotMatch(migration, /INSERT INTO public\.network_companies/);
});

test("Industrial role is assigned with evidence, without fictitious certifications or contacts", () => {
  assert.match(migration, /INSERT INTO public\.network_data_assertions/);
  assert.match(migration, /INSERT INTO public\.network_company_role_assignments/);
  assert.match(migration, /'role_confirmed_by_company',false/);
  assert.match(migration, /'company_verified',false/);
  assert.match(migration, /'tube_procurement_confirmed',false/);
  assert.match(migration, /'public_web',v_row\.source_url/);
  assert.match(migration, /'published_count',v_requested/);
  assert.match(migration, /'verified_companies',0/);
});

test("Public facade uses invoker + anonymous revocation; source proof stays private", () => {
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.net_it_scale15k_bulk_publish/);
  assert.match(migration, /LANGUAGE sql SECURITY INVOKER/);
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.net_it_scale15k_bulk_publish/);
  assert.match(migration, /REVOKE ALL ON FUNCTION private\.net_it_scale15k_bulk_publish_impl/);
  assert.match(migration, /ALTER TABLE private\.net_it_scale15k_publication_waves ENABLE ROW LEVEL SECURITY/);
  assert.match(action, /requirePlatformPermission\("discovery\.publish"\)/);
  assert.match(action, /serverIds\.length !== ids\.length/);
  assert.match(action, /p_expected_fingerprint: fingerprint/);
  assert.match(action, /p_attested: true/);
  assert.match(action, /p_commit: true/);
  assert.doesNotMatch(action, /service_role|createAdminClient|\.from\("network_companies"\)/);
});

test("UI is a single visible, consciously attested batch, not a background autopublish", () => {
  assert.match(page, /publishScale15KReadyWave/);
  assert.match(page, /p_lane: "ready", p_limit: 100/);
  assert.match(page, /p_candidate_ids: readyIds/);
  assert.match(page, /p_commit: false/);
  assert.match(page, /status === "ready_for_attested_commit"/);
  assert.match(page, /name="review_note"/);
  assert.match(page, /name="attested"/);
  assert.match(page, /name="manifest_fingerprint"/);
  assert.match(page, /Pubblica \{readyIds\.length\} aziende/);
});
