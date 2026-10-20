import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const migration=readFileSync(new URL("../../../supabase/migrations/20261020160000_netdata1eu_trader1a_research_foundation.sql",import.meta.url),"utf8");
test("TRADER1A: research and facility staging are private, RLS-enabled and nonpublishing",()=>{
 for(const name of ["netdata1eu_trader_research","netdata1eu_trader_facility_evidence"]){
   assert.match(migration,new RegExp("private\\."+name+" ENABLE ROW LEVEL SECURITY"));
   assert.match(migration,new RegExp("REVOKE ALL ON private\\."+name+" FROM public,anon,authenticated"));
 }
 assert.match(migration,/published_by_this_pipeline',0/);
 assert.doesNotMatch(migration,/INSERT INTO public\.network_companies|UPDATE public\.network_companies|UPDATE public\.network_facilities|GRANT .*authenticated.*netdata1eu_trader_research/i);
});
test("TRADER1A: no inferred country, no automatic NUTS, license and identity review blockers",()=>{
 assert.match(migration,/target_country_code text NOT NULL/);
 assert.match(migration,/legal_country_code text/);
 assert.match(migration,/legal_identity_evidence_url/);
 assert.match(migration,/source_rights text NOT NULL DEFAULT 'not_assessed'/);
 assert.match(migration,/research_state text NOT NULL DEFAULT 'research_only'/);
 assert.match(migration,/research_state <> 'ready_for_review' OR source_rights='license_approved'/);
 assert.match(migration,/NUTS mapping is deliberately absent/);
 assert.match(migration,/netdata1eu_trader_official_host/);
});
test("TRADER1A: exact-domain duplication warnings across live and provisional sources",()=>{
 assert.match(migration,/public\.network_companies c/);
 assert.match(migration,/private\.netfast_discovered_records d/);
 assert.match(migration,/public\.network_core_target_leads l/);
 assert.match(migration,/other\.domain=r\.domain/);
 assert.match(migration,/GRANT EXECUTE ON FUNCTION private\.netdata1eu_trader_audit/);
 assert.match(migration,/TO service_role/);
 assert.doesNotMatch(migration,/CREATE OR REPLACE FUNCTION public\.netdata1eu/);
});
