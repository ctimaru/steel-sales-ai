import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const sql=readFileSync(new URL("../../../supabase/migrations/20261116151000_net_pro_producers1_auto1b_claim_verifier.sql",import.meta.url),"utf8");
const web=read("lib/network-producer-source-mentions.ts");
const page=read("app/(italian)/(workspace)/network/pro/producers/page.tsx");
const ui=read("components/network-producers-experience.tsx");
const worker=readFileSync(new URL("../../../services/worker/app/net_pro_producers_auto1.py",import.meta.url),"utf8");

test("AUTO1.B: verifies each literal source mention against CURRENT canonical site and page fingerprint",()=>{
  assert.match(sql,/private\.netproducers1_auto1b_verify/);
  assert.match(sql,/for update of a skip locked/);
  assert.match(sql,/a\.evidence_status='pending_verification'/);
  assert.match(sql,/position\(lower\(v_candidate\.claim_value\) in v_excerpt\)=0/);
  assert.match(sql,/v_candidate\.queue_sha is distinct from v_candidate\.source_sha256/);
  assert.match(sql,/v_candidate\.source_url<>v_candidate\.queue_url/);
  assert.match(sql,/v_candidate\.website_url<>v_candidate\.queue_url/);
  assert.match(sql,/v_host<>v_candidate\.canonical_domain/);
  assert.match(sql,/r\.canonical_key='producer' and r\.status='active'/);
  assert.match(sql,/negative_or_conflicting_context/);
  assert.match(sql,/unrecognized_standard/);
  assert.match(sql,/unrecognized_grade/);
  assert.match(sql,/product_scope_not_documented/);
  assert.match(sql,/network_producer_auto1_verification_events/);
  assert.match(sql,/unique\(candidate_id,verifier_version\)/);
  assert.match(sql,/'manufacturing_capabilities_published',0/);
});

test("AUTO1.B: paid server-scoped mentions only, separate from real product manufacturing evidence",()=>{
  assert.match(sql,/private\.netpro1b_allowed_for\(p_organization_id,'producers','IT'\)/);
  assert.match(sql,/cardinality\(p_company_ids\) not between 1 and 24/);
  assert.match(sql,/a\.company_id=any\(p_company_ids\)/);
  assert.match(sql,/a\.evidence_level='source_mention_only'/);
  assert.match(sql,/a\.source_sha256=q\.last_sha256/);
  assert.match(sql,/revoke all on function public\.netproducers1_auto1b_verify\(integer\)/);
  assert.match(sql,/grant execute on function public\.netproducers1_auto1b_verify\(integer\)\s+to service_role/);
  assert.match(sql,/revoke all on function public\.netproducers1_auto1b_mentions\(uuid,uuid\[\]\)/);
  assert.doesNotMatch(sql,/insert into private\.network_producer_technical_claims/i);
  assert.match(web,/db\.rpc\("netproducers1_auto1b_mentions"/);
  assert.match(web,/!granted\.has\(x\.company_id\)/);
  assert.match(page,/result\.status==="ready"/);
  assert.match(page,/getProducerSourceMentions/);
  assert.match(page,/sourceMentions=\{sourceMentions\}/);
  assert.match(ui,/Menzioni tecniche rilevate/);
  assert.match(ui,/una specifica combinazione/);
  assert.match(ui,/rel="noopener noreferrer"/);
  assert.match(worker,/netproducers1_auto1b_verify/);
});
