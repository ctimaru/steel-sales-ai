import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";

const file=readFileSync(
 new URL("../../../supabase/migrations/20261116105000_net_it_tubifici1_reconsider_rejected_name_errors.sql",import.meta.url),
 "utf8"
);

test("TUBIFICI1: only previously rejected P3.3 name extractions can be re-evaluated",()=>{
 assert.match(file,/intake_batch='NET-IT-TUBIFICI-20261116-01'/);
 assert.match(file,/t\.proposed_role='producer'/);
 assert.match(file,/c\.review_status='rejected'/);
 assert.match(file,/c\.governance_status='unreviewed'/);
 assert.match(file,/c\.review_note like 'P3\.3 closure:%'/);
 assert.match(file,/c\.review_note like 'P3\.3 quality gate:%'/);
 assert.match(file,/lower\(regexp_replace\(btrim\(c\.legal_name\)/);
 assert.match(file,/<> lower\(regexp_replace\(btrim\(t\.company_name\)/);
 assert.match(file,/not coalesce\(c\.personal_data_detected,false\)/);
});
test("TUBIFICI1: preserve suppression, duplicate and first-party guards",()=>{
 assert.match(file,/t\.evidence_url ~\* '\^https:\/\//);
 assert.match(file,/network_netfast3_suppressed_domains/);
 assert.match(file,/not exists \(\s*select 1 from public\.network_companies/);
 assert.match(file,/net_preview_bridge1_ledger/);
 assert.match(file,/for update of t skip locked/);
 assert.match(file,/identity_verified',false/);
 assert.match(file,/publication_authorized',false/);
});
test("TUBIFICI1: maintenance-only, bounded and no publication bypass",()=>{
 assert.match(file,/session_user <> 'postgres'/);
 assert.match(file,/p_max not between 1 and 100/);
 assert.match(file,/net_it_auto3_policy/);
 assert.match(file,/from public,anon,authenticated,service_role/);
 assert.doesNotMatch(file,/insert into public\.network_companies/i);
 assert.doesNotMatch(file,/insert into private\.net_it_auto3_publications/i);
 assert.doesNotMatch(file,/update public\.network_companies/i);
});
