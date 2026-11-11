import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const file = (path) => fs.readFileSync(new URL(path, import.meta.url), "utf8");
const sql = file("../../../supabase/migrations/20261111103000_net_it_seed1_site_finder.sql");
const worker = file("../../../services/worker/app/net_it_seed1_pipeline.py");

test("site discovery is default OFF, owner-granted, expiring and capped", () => {
  assert.match(sql, /INSERT INTO private\.net_it_seed1_policy\(singleton,enabled\)\s+VALUES\(true,false\) ON CONFLICT/);
  assert.match(sql, /daily_crawl_cap BETWEEN 1 AND 5000/);
  assert.match(sql, /private\.is_platform_superadmin\(\)/);
  assert.match(sql, /'policy_disabled'/);
  assert.match(sql, /'daily_limit_reached'/);
});

test("private tables and worker RPCs are closed to browsers", () => {
  for (const table of ["policy", "index_sources", "domains", "events"]) {
    assert.match(sql, new RegExp(`ALTER TABLE private\\.net_it_seed1_${table} ENABLE ROW LEVEL SECURITY`));
    assert.match(sql, new RegExp(`REVOKE ALL ON private\\.net_it_seed1_${table} FROM PUBLIC,anon,authenticated,service_role`));
  }
  for (const rpc of ["claim_sources", "stage", "claim_batch", "record", "finish_batch"]) {
    const grants = [...sql.matchAll(new RegExp(`GRANT EXECUTE ON FUNCTION (?:private|public)\\.net_it_seed1_${rpc}(?:_impl)?\\([^)]*\\)\\s+TO (\\w+)`, "g"))].map((m) => m[1]);
    assert.deepEqual([...new Set(grants)], ["service_role"], rpc);
  }
  assert.doesNotMatch(sql, /TO anon/);
});

test("discovery never publishes and never claims a human review", () => {
  assert.doesNotMatch(sql, /INSERT INTO public\.network_companies/);
  assert.doesNotMatch(sql, /review_status\s*=\s*'published'/);
  assert.doesNotMatch(sql, /governance_status\s*=\s*'approved/);
  assert.doesNotMatch(sql, /net_it_auto3_|net_it_auto1_|net_pipeline1b2_publish/);
  assert.match(sql, /'published',0/);
});

test("staging deduplicates against catalogue, candidates, seeds and suppressions", () => {
  for (const table of ["public.network_companies", "public.network_company_discovery_candidates",
    "private.network_web_research_seeds", "public.network_netfast3_suppressed_domains",
    "private.net_it_seed1_domains"]) {
    assert.ok(sql.includes(`NOT EXISTS(SELECT 1 FROM ${table}`), table);
  }
});

test("worker only talks to its five RPCs and respects robots on index pages", () => {
  assert.match(worker, /ALLOWED = frozenset\(\{/);
  assert.match(worker, /robots\.txt refusal or unreachable: respect it/);
  assert.match(worker, /"paginegialle\.it"/);
  assert.match(worker, /"linkedin\.com"/);
  assert.doesNotMatch(worker, /net_it_auto3|publish_one|set_policy/);
});
