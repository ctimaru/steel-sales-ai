import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";

const read=(file)=>readFileSync(new URL(file,import.meta.url),"utf8");
const script=read("../../../supabase/migrations/20261119050000_net_eu_tubifici1_d2_guarded_batch02_publisher.sql");
const c1=read("../../../supabase/migrations/20261119013000_net_eu_tubifici1_c1_factory_proofs_and_guarded_release.sql");
const gov=read("../../../supabase/migrations/20261119020000_net_eu_tubifici1_c1_pa15_additive_governance.sql");

test("EU1.D2: second batch is accepted only via exact original first-party seed and fresh manufacturing proof",()=>{
 for(const required of [
  "private.net_eu_tubifici1_seed_matches(",
  "NET-EU-TUBIFICI-20261118-02",
  "web_profile_review_pending",
  "c.quality_flags <@ array['legal_identity_not_verified','producer_role_not_verified']",
  "m.proof_status='qualified_firstparty'",
  "m.source_kind='first_party_html'",
  "m.factory_country_code=c.country_code",
  "m.checked_at>now()-interval '30 days'",
  "e.verdict='observed_match'",
  "e.observed_name=c.legal_name",
  "e.name_matched",
  "e.confidence>=0.94",
  "e.last_checked_at>now()-interval '3 days'",
  "e.page_sha256 ~ '^[a-f0-9]{64}$'",
  "e.source_rights_state='unknown'",
  "c.review_status='pending_review'",
  "c.country_code<>'IT'",
  "not c.personal_data_detected",
  "not exists(",
 ]) assert.ok(script.includes(required),required);
 assert.match(script,/r.source_reference='net-eu-tubifici1:NET-EU-TUBIFICI-20261118-02'/);
 assert.doesNotMatch(script,/insert into public\.network_companies|update public\.network_companies/i);
});

test("EU1.D2: scope-only patch preserves first C1 batch and PA1.5 independent checks",()=>{
 assert.match(script,/pg_catalog\.replace\(v_pub,old_pub,new_pub\)/);
 assert.match(script,/pg_catalog\.replace\(v_pa,old_pa,new_pa\)/);
 assert.match(script,/raise exception 'D2 source implementation changed, refusing ungated publication scope'/);
 assert.match(script,/r.source_reference=''net-eu-tubifici1:NET-EU-TUBIFICI-20261118-01''/);
 assert.match(script,/v_run.source_reference=''net-eu-tubifici1:NET-EU-TUBIFICI-20261118-01''/);
 assert.match(c1,/not exists \(select 1 from private.net_eu_tubifici1_publication_ledger/);
 assert.match(c1,/not exists \(\s*select 1 from public.network_companies/);
 assert.match(c1,/review_status='published'/);
 assert.match(gov,/net_eu_tubifici1_pa15_accept\(OLD,NEW\)/);
 assert.match(gov,/session_user <> 'postgres'/);
 assert.match(gov,/v_company.claimed_status<>'unclaimed'/);
 assert.match(gov,/a.asserted_value->>'specific_dimensions_verified'='false'/);
 assert.doesNotMatch(script,/pa1_5_discovery_publication_guard\s*\(/i);
});

test("EU1.D2: publisher and gate are never exposed to service role or browser users",()=>{
 assert.match(script,/revoke all on function private\.net_eu_tubifici1_d2_release_scope\(uuid,uuid\)/);
 for(const fn of ["private","public"])
  assert.match(script,new RegExp("revoke execute on function "+fn+"\\.net_eu_tubifici1_publish\\(integer,boolean\\)[\\s\\S]*?from public,anon,authenticated,service_role"));
 assert.doesNotMatch(script,/grant execute [^;]* to anon|grant execute [^;]* to authenticated|grant execute [^;]* to service_role/i);
 assert.match(script,/language sql stable security invoker set search_path=''/);
});
