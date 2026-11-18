import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";

const sql=readFileSync(new URL(
 "../../../supabase/migrations/20261119060000_net_eu_tubifici1_d3_firstparty_identity_recovery.sql",
 import.meta.url),"utf8");

test("D3: same-host, sha256, seed and company-identity scope cannot be skipped",()=>{
 for(const term of [
  "private.net_eu_tubifici1_seed_matches(",
  "c.country_code<>'IT'",
  "c.review_status<>'pending_review'",
  "c.publication_actor_type<>'platform'",
  "c.personal_data_detected",
  "cardinality(c.personal_data_fields)>0",
  "p_legal_hash !~ '^[a-f0-9]{64}$'",
  "p_factory_hash !~ '^[a-f0-9]{64}$'",
  "p_legal_url !~* '^https://'",
  "p_factory_url !~* '^https://'",
  "lower(c.canonical_domain)",
  "r.source_reference in (",
  "m.candidate_id=c.id",
  "source_kind,proof_note,proof_status",
 ])assert.ok(sql.includes(term),term);
});

test("D3: normal user and anonymous have no access to RPC, tables, or publisher",()=>{
 for(const term of [
  "alter table private.net_eu_tubifici1_d3_recovery enable row level security",
  "revoke all on private.net_eu_tubifici1_d3_recovery from public,anon,authenticated,service_role",
  "if auth.role() is distinct from 'service_role' or auth.uid() is not null",
  "revoke all on function public.net_eu_tubifici1_d3_queue(integer)",
  "revoke all on function public.net_eu_tubifici1_d3_record(",
  "returns jsonb language sql security invoker set search_path=''",
 ])assert.ok(sql.includes(term),term);
 assert.doesNotMatch(sql,/grant execute on function [^;]*to authenticated/i);
 assert.doesNotMatch(sql,/grant execute on function [^;]*to anon/i);
});

test("D3: group and mixed legal entities remain held; publisher untouched",()=>{
 for(const term of [
  "c.identity_quality->>'review_lane'='web_profile_review_pending'",
  "c.quality_flags <@ array['legal_identity_not_verified','producer_role_not_verified']",
  "c.canonical_domain in ('alleima.com','ferpinta.pt')",
  "hold_legal_identity",
  "hold_group_entity",
  "hold_rights",
  "not p_rights_restricted",
  "v_status='qualified_firstparty'",
  "'observed_match'",
  "'first_party_html'",
  "on conflict(candidate_id) do nothing",
 ])assert.ok(sql.includes(term),term);
 assert.doesNotMatch(sql,/create or replace function (?:private|public)\.net_eu_tubifici1_publish/i);
 assert.doesNotMatch(sql,/create or replace function private\.net_eu_tubifici1_pa15_accept/i);
 assert.doesNotMatch(sql,/update public\.network_companies|insert into public\.network_companies/i);
});

test("D3: bounded first-party, source-level ledger and seven day cooldown",()=>{
 assert.match(sql,/p_max not between 1 and 8/);
 assert.match(sql,/last_checked_at>now\(\)-interval '7 days'/);
 assert.match(sql,/unique\(candidate_id,legal_page_sha256,manufacturing_page_sha256\)/);
 assert.match(sql,/evidence_status text not null/);
 assert.match(sql,/publication_authorized',false/);
 assert.match(sql,/'published',0/);
});
