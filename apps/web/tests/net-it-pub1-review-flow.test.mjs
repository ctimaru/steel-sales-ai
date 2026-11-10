import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sql = readFileSync(new URL("../../../supabase/migrations/20261110092500_net_it_pub1_review_queue.sql", import.meta.url), "utf8");
const migration = readFileSync(new URL("../../../supabase/migrations/20261110090000_net_it_releasebulk1_guarded_default_off.sql", import.meta.url), "utf8");
const page = readFileSync(new URL("../app/(italian)/(platform)/platform/company-discovery/carpenterie/pubblicazione/page.tsx", import.meta.url), "utf8");
const actions = readFileSync(new URL("../app/(italian)/(platform)/platform/company-discovery/carpenterie/pubblicazione/actions.ts", import.meta.url), "utf8");
const entrance = readFileSync(new URL("../app/(italian)/(platform)/platform/company-discovery/carpenterie/page.tsx", import.meta.url), "utf8");

test("First-five review is precisely scoped, authenticated and read-only in SQL", () => {
  const domains = ["carpenteriamfn.it", "csmetalmeccanica.com", "guazzifratelli.it", "ntcgroupitalia.com", "carpenteriacosta.com"];
  for (const domain of domains) assert.ok(sql.includes("'" + domain + "'"), "Missing exact cohort: " + domain);
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
  assert.doesNotMatch(actions, /netit_releasebulk1|net_pipeline1b2_publish_one|service_role|createAdminClient/);
});

test("Publisher definitions remain disabled and install no public company", () => {
  assert.match(migration, /netit_releasebulk1_runtime/);
  assert.match(migration, /netit_facts1_policy/);
  assert.match(migration, /enabled boolean NOT NULL DEFAULT false/);
  assert.match(migration, /VALUES \(true,false\) ON CONFLICT/);
  assert.doesNotMatch(migration, /\bINSERT\s+INTO\s+public\.network_companies\b/i);
});
