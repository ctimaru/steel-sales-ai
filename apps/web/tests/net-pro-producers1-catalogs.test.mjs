import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";

const text=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const sql=readFileSync(new URL("../../../supabase/migrations/20261116112000_net_pro_producers1_catalog_links.sql",import.meta.url),"utf8");
const server=text("lib/network-producer-catalogs.ts");
const page=text("app/(italian)/(workspace)/network/pro/producers/page.tsx");
const ui=text("components/network-producers-experience.tsx");

test("NET-PRO-PRODUCERS1: official catalog index is link-only and typed",()=>{
  assert.match(sql,/network_producer_catalog_links/);
  assert.match(sql,/rights_status text not null default 'link_only'/);
  assert.match(sql,/observed_at timestamptz/);
  assert.match(sql,/on conflict \(company_id,source_url\) do nothing/);
  assert.match(sql,/https:\/\/www\.acciaitubi\.it\/files\/pages\/12\/Acciaitubi-catalogo-2024-it\.pdf/);
  assert.match(sql,/https:\/\/alessiotubi\.it\/wp-content\/uploads\/2026\/04/);
  assert.match(sql,/https:\/\/www\.padanatubi\.it\/prodotti\//);
  assert.match(sql,/https:\/\/www\.publications\.marcegaglia\.com/);
  assert.doesNotMatch(sql,/extracted_text|insert into public\.documents|pdf_binary/i);
});

test("NET-PRO-PRODUCERS1: table denied to browser, RPC checks IT producers entitlement and published roles",()=>{
  assert.match(sql,/enable row level security/);
  assert.match(sql,/revoke all on table private\.network_producer_catalog_links from public,anon,authenticated/);
  assert.match(sql,/private\.netpro1b_allowed_for\(p_organization_id,'producers','IT'\)/);
  assert.match(sql,/using errcode='42501'/);
  assert.match(sql,/cardinality\(p_company_ids\) not between 1 and 24/);
  assert.match(sql,/c\.publication_status='published'/);
  assert.match(sql,/r\.canonical_key='producer'/);
  assert.match(sql,/revoke all on function public\.netproducers1_catalog_index\(uuid,uuid\[\]\)/);
  assert.match(sql,/grant execute on function public\.netproducers1_catalog_index\(uuid,uuid\[\]\)/);
});

test("NET-PRO-PRODUCERS1: client sees catalog links only after authorized directory",()=>{
  assert.match(page,/result\.status==="ready"/);
  assert.match(page,/getNetworkProducerCatalogLinks/);
  assert.match(server,/db\.rpc\("netproducers1_catalog_index"/);
  assert.match(server,/parseNetworkProducerCatalogLinks/);
  assert.match(ui,/Cataloghi ufficiali/);
  assert.match(ui,/href=\{doc\.sourceUrl\} target="_blank" rel="noopener noreferrer"/);
  assert.match(ui,/catalogs===null\?"Indice non disponibile"/);
  assert.doesNotMatch(ui,/service_role|SUPABASE_SERVICE_ROLE_KEY/);
});
