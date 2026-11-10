import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sql = readFileSync(new URL("../../../supabase/migrations/20261110092500_net_it_pub1_review_queue.sql", import.meta.url), "utf8");
const migration = readFileSync(new URL("../../../supabase/migrations/20261110090000_net_it_releasebulk1_guarded_default_off.sql", import.meta.url), "utf8");
const release = readFileSync(new URL("../../../supabase/migrations/20261110103500_net_it_pub1_atomic_minimal_release.sql", import.meta.url), "utf8");
const page = readFileSync(new URL("../app/(italian)/(platform)/platform/company-discovery/carpenterie/pubblicazione/page.tsx", import.meta.url), "utf8");
const actions = readFileSync(new URL("../app/(italian)/(platform)/platform/company-discovery/carpenterie/pubblicazione/actions.ts", import.meta.url), "utf8");
const entrance = readFileSync(new URL("../app/(italian)/(platform)/platform/company-discovery/carpenterie/page.tsx", import.meta.url), "utf8");

test("First-five review is precisely scoped, authenticated and read-only in SQL", () => {
  const domains = ["carpenteriamfn.it", "csmetalmeccanica.com", "guazzifratelli.it", "ntcgroupitalia.com", "carpenteriacosta.com"];
  for (const domain of domains) assert.ok(sql.includes("'" + domain + "'"), "Missing exact cohort: " + domain);
  assert.match(sql, /CREATE OR REPLACE FUNCTION private\.net_it_pub1_review_queue_impl\(\)/);
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.net_it_pub1_review_queue\(\)/);
  assert.match(sql, /SECURITY DEFINER/);
  assert.match(sql, /SECURITY INVOKER/);
  assert.match(sql, /auth\.uid\(\)/);
  assert.match(sql, /require_platform_permission\('discovery\.governance_review'\)/);
  assert.match(sql, /FROM public\.network_company_discovery_candidates c/);
  assert.match(sql, /JOIN private\.netit_carp1_growth100_bridge b ON b\.candidate_id = c\.id/);
  assert.match(sql, /net_it_pub1_20261110/);
  assert.match(sql, /publisher_eligibility_reason/);
  assert.match(sql, /canonical_collision/);
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.net_it_pub1_review_queue\(\) FROM PUBLIC, anon/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.net_it_pub1_review_queue\(\) TO authenticated/);
  assert.doesNotMatch(sql, /\b(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+public\.network_companies\b/i);
});

test("Platform page exposes real per-source and per-candidate review, no publication shortcut", () => {
  assert.match(page, /requirePlatformPermission\("discovery\.governance_review"\)/);
  assert.match(page, /rpc\("net_it_pub1_review_queue"\)/);
  assert.match(page, /Array\.isArray\(payload\.items\) && payload\.items\.length === 5/);
  assert.match(page, /action=\{reviewNetItPub1Source\}/);
  assert.match(page, /action=\{reviewNetItPub1Candidate\}/);
  assert.match(page, /row\.canonical_collision/);
  assert.match(page, /row\.source_status === "approved"/);
  assert.match(page, /personali/);
  assert.match(entrance, /href="\/platform\/company-discovery\/carpenterie\/pubblicazione"/);
  assert.doesNotMatch(page, /\.rpc\("netit_releasebulk1"|publish_new|enablePublisher/);
});

test("Source and candidate decisions require real platform permission and reuse existing audited governance RPCs", () => {
  assert.match(actions, /requirePlatformPermission\("discovery\.governance_review"\)/);
  assert.match(actions, /await selectedQueue\(\)/g);
  assert.match(actions, /rows\.some\(\(row\) => row\.run_id === runId\)/);
  assert.match(actions, /rows\.some\(\(row\) => row\.candidate_id === candidateId\)/);
  assert.match(actions, /pa1_5_review_discovery_run_governance/);
  assert.match(actions, /pa1_5_review_discovery_candidate_governance/);
  assert.match(actions, /note\.length < 20/);
  assert.match(actions, /decision === "approved_company_data"/);
  assert.match(actions, /requirePlatformPermission\("discovery.publish"\)/);
  assert.match(actions, /publishNetItPub1All/);
  assert.match(actions, /formData.get\("attested"\)/);
  assert.match(actions, /rpc\("net_it_pub1_release"/);
  assert.match(page, /action=\{publishNetItPub1All\}/);
  assert.match(page, /manifest_fingerprint/);
  assert.match(page, /Cinque carpenterie/);
  assert.match(sql, /minimal_publisher_enabled/);
  assert.doesNotMatch(actions, /netit_releasebulk1|service_role|createAdminClient/);
});

test("Publisher definitions remain disabled and install no public company", () => {
  assert.match(migration, /netit_releasebulk1_runtime/);
  assert.match(migration, /netit_facts1_policy/);
  assert.match(migration, /enabled boolean NOT NULL DEFAULT false/);
  assert.match(migration, /VALUES \(true,false\) ON CONFLICT/);
  // Publication INSERT exists inside a guarded function, not as top-level migration DML.
  assert.match(migration, /IF coalesce\(p_commit,false\) AND NOT EXISTS \(/);
  assert.match(migration, /WHERE rt\.singleton=true AND rt\.enabled=true/);
  assert.match(migration, /Publisher installed but public release not enabled/);
});

test("First five are released via the EXISTING minimal publisher, atomically and with real Platform attestation", () => {
  for (const candidate of [
    "3222c3fa-4a44-4b68-bb27-5fb04d52f6fc",
    "28defb68-413d-47d7-93e0-3bbb95afa1cf",
    "79960391-2660-4843-a0e3-f423130166c5",
    "9d306e06-e62d-49f6-8b90-7ea088c741d9",
    "d6307036-2999-4c56-a5d6-801130e13bdd",
  ]) assert.ok(release.includes(candidate), "Missing restricted candidate " + candidate);
  assert.match(release, /auth\.uid\(\)/);
  assert.match(release, /require_platform_permission\('discovery\.governance_review'\)/);
  assert.match(release, /require_platform_permission\('discovery\.publish'\)/);
  assert.match(release, /private\.net_pipeline1b2_eligibility/);
  assert.match(release, /r\.governance_status='approved'/);
  assert.match(release, /c\.governance_status='approved_company_data'/);
  assert.match(release, /p_expected_fingerprint<>v_fingerprint/);
  assert.match(release, /p_attested IS DISTINCT FROM true/);
  assert.match(release, /LOCK TABLE public\.network_companies/);
  assert.match(release, /UPDATE private\.net_pipeline1b2_settings SET enabled=true/);
  assert.match(release, /public\.net_pipeline1b2_publish_one\(v_row\.id\)/);
  assert.match(release, /UPDATE private\.net_pipeline1b2_settings SET enabled=false/);
  assert.match(release, /SECURITY INVOKER/);
  assert.match(release, /REVOKE ALL ON FUNCTION public\.net_it_pub1_release/);
  assert.match(release, /GRANT EXECUTE ON FUNCTION public\.net_it_pub1_release/);
  assert.doesNotMatch(release, /INSERT INTO public\.network_companies/);
  assert.doesNotMatch(actions, /service_role|createAdminClient|netit_releasebulk1/);
});
