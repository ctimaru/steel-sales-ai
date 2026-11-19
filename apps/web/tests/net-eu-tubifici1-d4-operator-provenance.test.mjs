import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";

const sql=readFileSync(new URL(
"../../../supabase/migrations/20261119070000_net_eu_tubifici1_d4_legal_operator_source_profiles.sql",
import.meta.url),"utf8");
const evidence=readFileSync(new URL("../lib/network-profile-evidence.ts",import.meta.url),"utf8");
const hub=readFileSync(new URL("../components/network-profile-overview.tsx",import.meta.url),"utf8");
const route=readFileSync(new URL("../app/(italian)/(workspace)/network/[id]/page.tsx",import.meta.url),"utf8");

test("EU D4 maps six ambiguous candidate labels to actual legal operators with sources",()=>{
 const pairs=[
 ["Mannesmann Precision Tubes GmbH","HRB 20198"],
 ["ARATUBO S.A.U.","A01242627"],
 ["ARCELORMITTAL TUBULAR PRODUCTS HAUTMONT","784689499"],
 ["TATA STEEL UK LIMITED","02280000"],
 ["FERPINTA - INDUSTRIAS DE TUBOS DE AÇO DE FERNANDO PINHO TEIXEIRA S.A.","500113009"],
 ["Alleima Tube AB","556234-6832"],
 ];
 for(const [name,id]of pairs){
  assert.ok(sql.includes(name),name);
  assert.ok(sql.includes(id),id);
 }
 assert.match(sql,/source_kind='independent_epd'/);
 assert.match(sql,/https:\/\/environdec.com\/library\/epd23048/);
 assert.match(sql,/original_candidate_id/);
 assert.match(sql,/source_company_label/);
 assert.match(sql,/legal_registration_verified',false/);
 assert.match(sql,/manufacturer_confirmed',false/);
 assert.match(sql,/specific_dimensions_verified',false/);
});

test("EU D4 guard requires exact private seeds, evidence and no collisions, no Italian bypass",()=>{
 for(const phrase of [
  "session_user<>'postgres' or auth.uid() is not null",
  "p_max not between 1 and 6",
  "private.net_eu_tubifici1_seed_matches(",
  "and d.manufacturing_observed",
  "d.last_checked_at>now()-interval '30 days'",
  "not c.personal_data_detected",
  "cardinality(c.personal_data_fields)=0",
  "c.country_code<>'IT'",
  "not exists(",
  "public.network_netfast3_suppressed_domains",
  "v_row.operator_registration_id",
  "v_row.operator_legal_name",
  "on conflict(candidate_id) do nothing",
 ])assert.ok(sql.includes(phrase),phrase);
 assert.doesNotMatch(sql,/create or replace function private\.pa1_5_discovery_publication_guard/i);
 assert.doesNotMatch(sql,/update public\.network_company_discovery_candidates/i);
 assert.doesNotMatch(sql,/grant execute on function private\.net_eu_tubifici1_d4_publish/i);
 assert.match(sql,/revoke all on function private\.net_eu_tubifici1_d4_publish\(integer,boolean\)/);
});

test("EU D4 source visibility only on published company after original authorized network access",()=>{
 for(const term of [
 "public.netprofile1d_profile_evidence(uuid,uuid,text)",
 "netprofile1d-evidence-v1",
 "n.publication_status='published'",
 "n.archived_at is null",
 "a.entity_id=p_company_id",
 "a.review_state='accepted'",
 "a.ownership_type='platform_curated'",
 "eu_tube_factory_firstparty_observation",
 "eu_tube_factory_reconciled_operator",
 "a.source_reference ~* '^https://'",
 "'field_key','industrial_source'",
 ])assert.ok(sql.includes(term),term);
 assert.match(sql,/raise exception 'EU D4 profile evidence contract drift: refusing unsafe patch'/);
 assert.match(evidence,/industrial_source/);
 assert.match(evidence,/if\(item.field_key==="industrial_source"\)/);
 assert.match(route,/industrialSource=\{reviewedEvidence\.some/);
 assert.match(hub,/Consulta la fonte tecnica/);
 assert.match(hub,/Non equivale a conferma dell'azienda/);
 assert.doesNotMatch(sql,/grant execute on function public\.netprofile1d_profile_evidence/i);
});
