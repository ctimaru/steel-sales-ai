import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";

const get=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const migration=get("../../supabase/migrations/20261119115904_net_eu_tubifici1_d5d_technical_pro_claims.sql");
const reader=get("lib/network-producer-technical.ts");
const countries=get("lib/network-eu-countries.ts");
const page=get("app/(italian)/(workspace)/network/pro/producers/page.tsx");
const view=get("components/network-producers-experience.tsx");

test("EU D5D uses only the existing real organization-country producer entitlement",()=>{
  assert.match(migration,/private\.net_eu_tubifici1_c2_factory_claims_impl\(/);
  assert.match(migration,/errcode='22023'/);
  assert.match(migration,/p_company_ids is null or cardinality\(p_company_ids\) not between 1 and 24/);
  assert.match(migration,/v_country in \('IT','US'\)/);
  assert.match(migration,/c\.country_code=v_country/);
  assert.match(migration,/c\.id=any\(p_company_ids\)/);
  assert.match(migration,/private\.netpro1b_europe_country/);
  assert.match(migration,/revoke all on function public\.net_eu_tubifici1_d5d_technical_claims\(uuid,text,uuid\[\]\)/);
  assert.match(migration,/grant execute on function public\.net_eu_tubifici1_d5d_technical_claims\(uuid,text,uuid\[\]\)\s+to authenticated/);
  assert.doesNotMatch(migration,/grant execute [^;]* to anon|grant execute [^;]* to service_role/i);
});
test("EU D5D reads only first-party observed, canonical, published and licensed facts",()=>{
  for(const token of [
    "private.network_producer_technical_claims",
    "private.net_eu_tubifici1_d5_operator_sources",
    "public.network_data_assertions",
    "a.review_state='accepted'",
    "s.rights_state='not_restricted'",
    "tc.evidence_status='first_party_observed'",
    "tc.rights_status='link_only'",
    "c.publication_status='published'",
    "c.archived_at is null",
    "ro.canonical_key='producer'",
    "pf.canonical_key='tubes_pipes'",
    "c.website_domain",
    "v_room := greatest(0,160-",
  ])assert.ok(migration.includes(token),token);
  assert.match(migration,/lower\(regexp_replace\(split_part\(tc\.source_url,'\/',3\)/);
  assert.doesNotMatch(migration,/manufacturer_confirmed\s*=\s*true|exact_skus_confirmed\s*=\s*true/i);
});
test("EU countries RS/TR/UA gain the existing Europe entitlement, never US",()=>{
  for(const code of ["RS","TR","UA"]) {
    assert.match(countries,new RegExp('code:"'+code+'"'));
    assert.match(migration,new RegExp("'"+code+"'"));
  }
  assert.doesNotMatch(countries,/code:"RU"/);
  assert.match(migration,/v_country in \('IT','US'\)/);
});
test("existing 57 EU claims flow to authorized responsive producer comparison",()=>{
  assert.match(reader,/db\.rpc\("net_eu_tubifici1_d5d_technical_claims"/);
  assert.match(reader,/country==="IT"\s*\?await db\.rpc\("netproducers1_technical_claims"/);
  assert.match(reader,/claims.every\(c=>allowed.has\(c.companyId\)\)/);
  assert.match(page,/getProducerTechnicalClaims\(context.organizationId,ids,country\)/);
  assert.match(view,/network-producers-eu-evidence/);
  assert.match(view,/Norme dalle fonti/);
  assert.match(view,/nessuna combinazione norma, grado, dimensione e spessore/i);
});
