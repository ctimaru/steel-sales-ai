import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";

const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const sql=readFileSync(new URL("../../../supabase/migrations/20261116145000_net_pro_producers1_auto1_source_queue.sql",import.meta.url),"utf8");
const bundle=read("lib/network-pro-catalog.ts");
const producerPage=read("app/(italian)/(workspace)/network/pro/producers/page.tsx");
const technical=read("lib/network-producer-technical.ts");
const catalogs=read("lib/network-producer-catalogs.ts");

test("Existing producers module includes Intelligence Produttori, no fifth SKU or price",()=>{
  assert.match(bundle,/key: "producers"/);
  assert.match(bundle,/Include Intelligence Produttori/);
  assert.match(bundle,/Cataloghi|cataloghi/);
  assert.match(bundle,/networkProQuote/);
  assert.match(producerPage,/module:"producers"/);
  assert.match(producerPage,/country,\s*\n\s*q:query/);
  assert.match(producerPage,/result\.status==="ready"/);
  assert.match(technical,/netproducers1_technical_claims/);
  assert.match(catalogs,/netproducers1_catalog_index/);
  assert.doesNotMatch(bundle,/key: "intelligence_producers"|key: "producer_intelligence"/);
});

test("Source queue is bounded, durable, idempotent and invisible to clients",()=>{
  assert.match(sql,/private\.network_producer_auto1_sources/);
  assert.match(sql,/private\.network_producer_auto1_candidates/);
  assert.match(sql,/p_limit not between 1 and 100/);
  assert.match(sql,/for update of q skip locked/);
  assert.match(sql,/not exists \(select 1 from private\.network_producer_auto1_sources q where q\.company_id=c\.id\)/);
  assert.match(sql,/last_sha256/);
  assert.match(sql,/last_etag/);
  assert.match(sql,/leased_until/);
  assert.match(sql,/next_check_at/);
  assert.match(sql,/enable row level security/);
  assert.match(sql,/revoke all on private\.network_producer_auto1_sources from public,anon,authenticated/);
  assert.match(sql,/grant execute on function private\.netproducers1_auto1_claim\(integer\) to service_role/);
  assert.match(sql,/create or replace function public\.netproducers1_auto1_claim/);
  assert.match(sql,/create or replace function public\.netproducers1_auto1_complete/);
  assert.match(sql,/revoke all on function public\.netproducers1_auto1_claim\(integer\) from public,anon,authenticated/);
  assert.match(sql,/grant execute on function public\.netproducers1_auto1_claim\(integer\) to service_role/);
  assert.match(sql,/evidence_status text not null default 'pending_verification'/);
  assert.match(sql,/'published_claims',0/);
  assert.doesNotMatch(sql,/insert into public\.network_company_product_standard_scopes|update public\.network_companies/i);
});
