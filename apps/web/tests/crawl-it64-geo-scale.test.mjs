import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {test} from "node:test";
const read=p=>readFileSync(new URL(p,import.meta.url),"utf8");
const sql=read("../../../supabase/migrations/20261014130000_crawl_it64_geographic_scale_readiness.sql");
const dbTest=read("../../../supabase/tests/crawl_it64_geo_scale_readiness.sql");
const page=read("../app/(italian)/(platform)/platform/company-discovery/coverage/page.tsx");
const chrome=read("./crawl-it64-geo-scale-chrome.mjs");
const governance=read("../app/(italian)/(platform)/platform/company-discovery/governance/page.tsx");
const discovery=read("../app/(italian)/(platform)/platform/company-discovery/page.tsx");
const perf=read("../../../.github/workflows/perf1-chrome-auth.yml");
const p0=read("../../../.github/workflows/p0-required-gate.yml");

test("CRAWL-IT6.4 KPI SQL is permission scoped, aggregate only, no publication writes",()=>{
  assert.match(sql,/private\.require_platform_permission\('discovery\.read'\)/);
  assert.match(sql,/security definer set search_path=''/);
  assert.match(sql,/stable security definer/);
  assert.match(sql,/revoke all on function public\.crawl_it64_geographic_scale_snapshot\(\) from public,anon,authenticated/);
  assert.match(sql,/grant execute on function public\.crawl_it64_geographic_scale_snapshot\(\) to authenticated,service_role/);
  assert.match(sql,/country_code='IT'/);
  assert.match(sql,/c\.publication_status='published'/);
  assert.match(sql,/f\.publication_status='published'/);
  assert.match(sql,/f\.archived_at is null/);
  assert.match(sql,/nullif\(btrim\(f\.city\),''\) is not null/);
  assert.match(sql,/worker_runtime_status','not_observable_from_database/);
  assert.match(sql,/publication_automatic',false/);
  assert.doesNotMatch(sql,/\binsert\s+into\s+public\./i);
  assert.doesNotMatch(sql,/\bupdate\s+public\./i);
  assert.doesNotMatch(sql,/\bdelete\s+from\s+public\./i);
  assert.match(dbTest,/has_function_privilege\('anon'/);
  assert.match(dbTest,/prosecdef and provolatile='s'/);
  assert.match(p0,/crawl_it64_geo_scale_readiness\.sql/);
});
test("CRAWL-IT6.4 dashboard distinguishes unavailable, source governance and ISTAT from actual activation",()=>{
  assert.match(page,/requirePlatformPermission\("discovery\.read"\)/);
  assert.match(page,/\.rpc\("crawl_it64_geographic_scale_snapshot"\)/);
  assert.match(page,/KPI non disponibili/);
  assert.match(page,/source_gate_ready/);
  assert.match(page,/Espansione autonoma non pronta/);
  assert.match(page,/worker Railway/);
  assert.match(page,/comuni ISTAT/i);
  assert.match(page,/Nessuna scansione o pubblicazione parte da questa pagina/);
  assert.doesNotMatch(page,/use server|\.insert\(|\.update\(|\.delete\(|service_role/);
  assert.match(governance,/href="\/platform\/company-discovery\/coverage"/);
  assert.match(discovery,/href="\/platform\/company-discovery\/coverage"/);
});
test("CRAWL-IT6.4 local Chrome acceptance checks permitted Owner and denies tenants/staff",()=>{
  assert.match(chrome,/assert\.equal\(process\.env\.PERF1_WEB_URL,WEB/);
  assert.match(chrome,/54321/);
  assert.match(chrome,/endsWith\("@example.test"\)/);
  for(const role of ["owner","buyer","buyerViewer","trader","platformStaff"]) {
    assert.ok(chrome.includes('"'+role+'"'),"Role missing: "+role);
  }
  assert.match(chrome,/source approvals: activation stays blocked/);
  assert.match(chrome,/for\(const width of \[320,390,768,1440\]\)/);
  assert.doesNotMatch(chrome,/https:\/\/www\.smartsteelsales\.com|auth\.admin|\.insert\(|\.update\(|\.delete\(/);
  assert.match(perf,/node tests\/crawl-it64-geo-scale-chrome\.mjs/);
  assert.match(perf,/supabase stop --no-backup/);
});
