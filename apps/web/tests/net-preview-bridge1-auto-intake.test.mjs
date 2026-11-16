import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const sql=readFileSync(new URL("../../../supabase/migrations/20261116084458_net_preview_bridge1_auto_intake.sql",import.meta.url),"utf8");

test("BRIDGE1 stages only first-party research with bounded automatic batches",()=>{
  assert.match(sql,/p_max integer default 100/);
  assert.match(sql,/not between 1 and 100/);
  assert.match(sql,/session_user <> 'postgres'/);
  assert.match(sql,/private\.net_it_auto3_policy/);
  assert.match(sql,/evidence_url ~\* '\^https:\/\/'/);
  assert.match(sql,/network_netfast3_suppressed_domains/);
  assert.match(sql,/network_company_discovery_candidates/);
  assert.match(sql,/network_companies/);
  assert.match(sql,/for update of t skip locked/);
});

test("BRIDGE1 does not bypass identity verification or publish contact data",()=>{
  assert.match(sql,/identity_verified',false/);
  assert.match(sql,/human_review_performed',false/);
  assert.match(sql,/publication_authorized',false/);
  assert.match(sql,/'unreviewed','not_checked','not_assessed','not_assessed'/);
  assert.match(sql,/published',0/);
  assert.doesNotMatch(sql,/insert into public\.network_companies/i);
  assert.doesNotMatch(sql,/insert into public\.network_contacts/i);
  assert.match(sql,/net-preview-bridge1-daily-stage/);
});

test("BRIDGE1 keeps repeated imports idempotent and respects the independent publisher",()=>{
  assert.match(sql,/lead_id uuid primary key/);
  assert.match(sql,/candidate_id uuid not null unique/);
  assert.match(sql,/on conflict \(lead_id\) do nothing/);
  assert.match(sql,/pg_advisory_xact_lock\(810021,20262\)/);
  assert.match(sql,/network_netfast3_suppressed_domains/);
  assert.match(sql,/status','staged_for_ai_identity_verification'/);
  assert.doesNotMatch(sql,/insert into private\.net_it_auto3_publications/i);
});
