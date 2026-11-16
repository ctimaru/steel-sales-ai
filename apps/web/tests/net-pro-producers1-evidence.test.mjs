import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";

const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const sql=readFileSync(new URL("../../../supabase/migrations/20261116123000_net_pro_producers1_firstparty_technical_claims.sql",import.meta.url),"utf8");
const page=read("app/(italian)/(workspace)/network/pro/producers/page.tsx");
const server=read("lib/network-producer-technical.ts");
const ui=read("components/network-producers-experience.tsx");

test("NET-PRO-PRODUCERS1.E: four official producer web pages, source per claim and no PDF mirroring",()=>{
  for(const domain of ["acciaitubi.it","alessiotubi.it","padanatubi.it","marcegaglia.com"]){
    assert.ok(sql.includes("'"+domain+"'"),domain);
  }
  assert.match(sql,/https:\/\/acciaitubi\.it\/en\/tubes\/welded-construction-tubes\//);
  assert.match(sql,/https:\/\/alessiotubi\.it\/it\/prodotti\//);
  assert.match(sql,/https:\/\/www\.padanatubi\.it\/prodotti\/acciaio-al-carbonio\//);
  assert.match(sql,/https:\/\/www\.carbonsteel\.marcegaglia\.com\/it\/tubi-saldati-in-acciaio-al-carbonio\//);
  assert.match(sql,/and c\.legal_name ilike s\.match_name/);
  assert.match(sql,/on conflict\(company_id,product_scope,claim_kind,claim_value,source_url\) do nothing/);
  assert.doesNotMatch(sql,/extracted_text|pdf_binary|COPY\s+public\.network_companies|INSERT INTO public\.network_company_product_standard_scopes/i);
});

test("NET-PRO-PRODUCERS1.E: access is scoped by producer subscription, country and selected companies",()=>{
  assert.match(sql,/enable row level security/);
  assert.match(sql,/revoke all on table private\.network_producer_technical_claims/);
  assert.match(sql,/private\.netpro1b_allowed_for\(p_organization_id,'producers','IT'\)/);
  assert.match(sql,/using errcode='42501'/);
  assert.match(sql,/cardinality\(p_company_ids\) not between 1 and 24/);
  assert.match(sql,/e\.company_id=any\(p_company_ids\)/);
  assert.match(sql,/c\.publication_status='published'/);
  assert.match(sql,/r\.canonical_key='producer'/);
  assert.match(sql,/e\.evidence_status='first_party_observed'/);
  assert.match(server,/db\.rpc\("netproducers1_technical_claims"/);
  assert.match(server,/claims\.every\(c=>allowed\.has\(c\.companyId\)\)/);
  assert.match(server,/return null/);
  assert.doesNotMatch(page,/service_role|SUPABASE_SERVICE_ROLE_KEY/);
  assert.doesNotMatch(server,/service_role|SUPABASE_SERVICE_ROLE_KEY/);
});

test("NET-PRO-PRODUCERS1.E: preview leaks no premium evidence, comparison links every observation",()=>{
  assert.match(page,/result\.status==="ready"/);
  assert.match(page,/getProducerTechnicalClaims/);
  assert.match(page,/technicalClaims=\{technicalClaims\}/);
  assert.match(ui,/result\.status==="locked"/);
  assert.match(ui,/technicalClaims\?\.filter/);
  assert.match(ui,/technicalKinds\.map/);
  assert.match(ui,/href=\{item\.sourceUrl\}/);
  assert.match(ui,/rel="noopener noreferrer"/);
  assert.match(ui,/Non disponibile in questa vista/);
  assert.match(ui,/non dimostrano una specifica combinazione/);
  assert.doesNotMatch(ui,/stock disponibile|produttore compatibile certificato/);
});
