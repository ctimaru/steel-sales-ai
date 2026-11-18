import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";

const get=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const migration=get("../../supabase/migrations/20261119030000_net_eu_tubifici1_c2_factory_evidence_pro.sql");
const library=get("lib/network-producer-technical.ts");
const page=get("app/(italian)/(workspace)/network/pro/producers/page.tsx");

test("EU1.C2.B private process claims require existing tenant+producer+country EU entitlement",()=>{
 assert.match(migration,/private\.netpro1b_allowed_for\(p_organization_id,'producers',v_country\)/);
 assert.match(migration,/errcode='42501'/);
 assert.match(migration,/authenticat(?:ed)/);
 assert.match(migration,/revoke all on function public\.net_eu_tubifici1_c2_factory_claims\(uuid,text,uuid\[\]\)/);
 assert.match(migration,/grant execute on function public\.net_eu_tubifici1_c2_factory_claims\(uuid,text,uuid\[\]\)\s+to authenticated/);
 assert.match(migration,/p_company_ids is null or cardinality\(p_company_ids\) not between 1 and 24/);
 assert.match(migration,/c\.id=any\(p_company_ids\) and c\.country_code=v_country/);
 assert.match(migration,/v_country='IT' or v_country='US'/);
 assert.doesNotMatch(migration,/grant execute [^;]* to anon/i);
});
test("EU1.C2.B only attributed first-party industrial process, never an exact grade or size",()=>{
 for(const term of ["net_eu_tubifici1_publication_ledger","net_eu_tubifici1_manufacturing_proofs","eu_tube_factory_firstparty_observation","manufacturer_confirmed","specific_dimensions_verified","source_reference=m.source_url","first_party_observed","link_only","produces","tubes_pipes","'manufacturing_process'"]){
  assert.ok(migration.includes(term),term);
 }
 assert.match(migration,/char_length\(m\.source_url\)<=1200/);
 assert.match(migration,/m\.source_url ~\* '\^https:\/\/'/);
 assert.doesNotMatch(migration,/'steel_grade'|'dimension_range'|'technical_standard'/);
});
test("EU1.C2.B UI uses existing Italy path and separate EU gated firstparty claim path",()=>{
 assert.match(library,/country="IT"/);
 assert.match(library,/country==="IT"\s*\?await db\.rpc\("netproducers1_technical_claims"/);
 assert.match(library,/db\.rpc\("net_eu_tubifici1_c2_factory_claims"/);
 assert.match(library,/p_country:country/);
 assert.match(page,/getProducerTechnicalClaims\(context\.organizationId,ids,country\)/);
 assert.match(page,/country==="IT"\?getNetworkProducerCatalogLinks/);
 assert.match(page,/country==="IT"\?getProducerSourceMentions/);
 assert.doesNotMatch(page,/service_role|SUPABASE_SERVICE_ROLE_KEY/);
});
