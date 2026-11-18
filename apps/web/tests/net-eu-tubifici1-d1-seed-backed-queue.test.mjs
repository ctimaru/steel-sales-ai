import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";

const migration=readFileSync(
 new URL("../../../supabase/migrations/20261119040000_net_eu_tubifici1_d1_seed_backed_queue.sql",import.meta.url),
 "utf8",
);
const b1=readFileSync(
 new URL("../../../supabase/migrations/20261119010000_net_eu_tubifici1_evidence_only_queue.sql",import.meta.url),
 "utf8",
);

test("EU1.D1: research intake requires exact private first-party seed identity and provenance",()=>{
  for(const token of [
    "private.network_web_research_seeds",
    "s.id::text=p_seed_id","s.research_id=p_research_id",
    "s.country_code=p_country","s.canonical_domain=p_domain",
    "s.source_url=p_source_url","s.source_kind='first_party_web'",
    "s.publication_status='not_published'",
    "s.verification_status='web_sourced_unverified'",
    "s.proposed_role='producer'",
    "p_run_source_reference='net-eu-tubifici1:'||s.batch_key",
  ]) assert.ok(migration.includes(token),token);
  assert.match(migration,/NET-EU-TUBIFICI-\[0-9\]\{8\}-\[0-9\]\{2\}/);
  assert.match(migration,/s.source_url ~\* '\^https:\/\/'/);
  assert.match(migration,/s.country_code<>'IT'/);
});

test("EU1.D1: queue and evidence recorder keep original security and change only batch gate",()=>{
  assert.match(migration,/pg_catalog\.pg_get_functiondef/);
  assert.match(migration,/pg_catalog\.replace\(q_def,q_old,q_new\)/);
  assert.match(migration,/pg_catalog\.replace\(r_def,r_old,r_new\)/);
  assert.match(migration,/raise exception 'Unexpected European B1 reviewer definition/);
  assert.match(b1,/auth\.role\(\) is distinct from 'service_role'/);
  assert.match(b1,/auth\.uid\(\) is not null/);
  assert.match(b1,/p_reviewer_version is distinct from 'net-eu-tubifici1-firstparty-v1'/);
  assert.match(b1,/on conflict \(candidate_id, reviewer_version/);
  assert.match(b1,/publication_authorized',false/);
  assert.doesNotMatch(migration,/grant execute [^;]* to anon|create table public|update public\.network_companies|insert into public\.network_companies/i);
  assert.doesNotMatch(migration,/net_eu_tubifici1_publish|pa1_5_discovery_publication_guard|net_it_auto2|net_it_auto3/i);
});

test("EU1.D1: private match helper never accessible to clients or service-role directly",()=>{
 assert.match(migration,/revoke all on function private\.net_eu_tubifici1_seed_matches\([\s\S]*?\) from public,anon,authenticated,service_role/);
 assert.match(migration,/language sql stable security definer set search_path=''/);
});

test("EU1.D1: automatic one-time canary must actually store eight evidence records and zero publications",()=>{
 const workflow=readFileSync(
  new URL("../../../.github/workflows/net-eu-tubifici1-canary.yml",import.meta.url),
  "utf8",
 );
 assert.match(workflow,/branches: \[main\]/);
 assert.match(workflow,/paths:[\s\S]*net-eu-tubifici1-canary\.yml/);
 assert.match(workflow,/python -m app\.net_eu_tubifici1_reviewer --limit 8 --persist/);
 for(const x of ['payload.get("queued") != 8','payload.get("inspected") != 8','payload.get("recorded") != 8','payload.get("published") != 0'])
  assert.ok(workflow.includes(x),x);
 assert.doesNotMatch(workflow,/net_eu_tubifici1_publish|net_it_auto3_release/);
});
