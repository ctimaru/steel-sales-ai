import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const sql=readFileSync(new URL("../../../supabase/migrations/20261119090000_net_eu_tubifici1_d5_automatic_source_operators.sql",import.meta.url),"utf8");
test("EU1.D5 source verified backlog: eleven canonical factory operators only, no group aliases",()=>{
 const operators=[
"BENTELER Steel/Tube GmbH & Co. KG",
"BORNAY, S.L.",
"TUBACEX TUBOS INOXIDABLES S.A.U.",
"TUBOS REUNIDOS INDUSTRIAL S.L.U.",
"SSAB Europe Oy",
"MARCEGAGLIA (UK) LIMITED",
"Marcegaglia Poland sp. z o.o.",
"Borusan Birleşik Boru Fabrikaları Sanayi ve Ticaret A.Ş.",
"Erciyas Çelik Boru Sanayi A.Ş.",
"CENTRAVIS PRODUCTION UKRAINE PJSC",
"INTERPIPE NIKO TUBE LLC"
 ];
 for(const op of operators) assert.ok(sql.includes(op),op);
 assert.match(sql,/join public\.network_company_discovery_candidates c on c\.id=v\.candidate_id::uuid/);
 assert.match(sql,/join public\.network_company_discovery_runs r on r\.id=c\.run_id/);
 assert.match(sql,/private\.net_eu_tubifici1_seed_matches/);
 assert.match(sql,/on conflict\(candidate_id\) do nothing/);
 assert.doesNotMatch(sql,/insert into private\.network_web_research_seeds/);
});
test("EU1.D5 can scale to future seed-backed batches without bypassing published/PII/identity gates",()=>{
 for(const term of [
 "source_reference ~ '^net-eu-tubifici1:NET-EU-TUBIFICI-[0-9]{8}-[0-9]{2}$'",
 "private.net_eu_tubifici1_seed_matches(",
 "c.review_status='pending_review'",
 "c.governance_status='unreviewed'",
 "c.country_code<>'IT'",
 "and c.role_keys @> array['producer']::text[]",
 "not c.personal_data_detected",
 "cardinality(c.personal_data_fields)=0",
 "not exists(",
 "public.network_netfast3_suppressed_domains",
 "s.source_checked_at>now()-interval '180 days'",
 "s.rights_state='not_restricted'",
 "n.registration_id=s.operator_registration_id",
 "identity_quality=pg_catalog.jsonb_set",
 "source_candidate_still_audit_only",
 "legal_registration_verified',false",
 "manufacturer_confirmed',false",
 "specific_dimensions_verified',false",
 ])assert.ok(sql.includes(term),term);
 assert.doesNotMatch(sql,/update public\.network_company_discovery_candidates [\s\S]*set review_status/i);
 assert.doesNotMatch(sql,/alter function private\.pa1_5|create or replace function private\.pa1_5/i);
});
test("EU1.D5 publishing is maintenance only, table private, existing source-view contract reused",()=>{
 assert.match(sql,/alter table private\.net_eu_tubifici1_d5_operator_sources enable row level security/);
 assert.match(sql,/revoke all on private\.net_eu_tubifici1_d5_operator_sources from public,anon,authenticated,service_role/);
 assert.match(sql,/session_user<>'postgres' or auth\.uid\(\) is not null/);
 assert.match(sql,/p_max not between 1 and 50/);
 assert.match(sql,/revoke all on function private\.net_eu_tubifici1_d5_publish\(integer,boolean\)/);
 assert.match(sql,/eu_tube_factory_reconciled_operator/);
 assert.match(sql,/source_type,source_reference,ownership_type,asserted_by,confidence,review_state/);
 assert.doesNotMatch(sql,/grant execute on function private\.net_eu_tubifici1_d5_publish/i);
});
