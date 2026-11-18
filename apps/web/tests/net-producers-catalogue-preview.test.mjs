import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";

const base=new URL("../",import.meta.url);
const read=(p)=>readFileSync(new URL(p,base),"utf8");
const page=read("app/(italian)/(workspace)/network/cataloghi/page.tsx");
const parser=read("lib/network-producer-catalog-preview.ts");
const entry=read("components/network-producers-entry.tsx");
const producers=read("components/network-producers-experience.tsx");
const sql=readFileSync(new URL(
  "../../../supabase/migrations/20261118181000_net_producers_public_catalog_preview.sql",
  import.meta.url),"utf8");
const sec=readFileSync(new URL(
  "../../../supabase/tests/sec1_public_rpc_boundary.sql",
  import.meta.url),"utf8");

test("catalog preview exposes ONLY official published producer source metadata",()=>{
  assert.match(sql,/sec1_public\.netproducers1_catalog_observed_preview_impl/);
  assert.match(sql,/public\.netproducers1_catalog_observed_preview/);
  assert.match(sql,/security invoker set search_path=''/);
  assert.match(sql,/security definer set search_path=''/);
  assert.match(sql,/c\.publication_status='published'/);
  assert.match(sql,/c\.archived_at is null/);
  assert.match(sql,/c\.country_code='IT'/);
  assert.match(sql,/l\.rights_status='link_only'/);
  assert.match(sql,/l\.source_status='official_link_observed'/);
  assert.match(sql,/e\.evidence_status='first_party_observed'/);
  assert.match(sql,/r\.canonical_key='producer'/);
  assert.match(sql,/limit p_limit/);
  assert.match(sql,/limit 25/);
  assert.doesNotMatch(sql,/network_producer_catalog_submissions/);
  assert.doesNotMatch(sql,/network_producer_catalog_grants/);
  assert.doesNotMatch(sql,/storage\.objects|supabase_service_role_key/i);
  assert.doesNotMatch(sql,/insert into|update private\.|delete from private\./i);
});

test("producer preview cannot certify exact manufacturing or copy PDF bytes",()=>{
  for(const key of ["producer_confirmation_pending","manufacturer_confirmed',0","exact_skus_verified',0","document_copies',0"])
    assert.ok(sql.includes(key),key);
  for(const key of ["manufacturer_confirmed!==0","exact_skus_verified!==0","document_copies!==0","item.status!==\"producer_confirmation_pending\""])
    assert.ok(parser.includes(key),key);
  assert.match(page,/Da confermare dal produttore/);
  assert.match(page,/La ricerca trova attributi presenti nelle fonti/);
  assert.match(page,/senza archiviare copie/);
  assert.match(page,/Non serve attendere il claim aziendale/);

});

test("source cards are searchable, linked and responsive with honest no-data states",()=>{
  assert.match(page,/getCataloguePreview\(q\)/);
  assert.match(page,/Form action="\/network\/cataloghi"/);
  assert.match(page,/data-testid="catalog-preview-card"/);
  assert.match(page,/target="_blank" rel="noopener noreferrer"/);
  assert.match(page,/grid gap-3 lg:grid-cols-2/);
  assert.match(page,/data-testid="network-cataloghi-preview"/);
  assert.match(page,/Indice temporaneamente non disponibile/);
  assert.match(entry,/href="\/network\/cataloghi"/);
  assert.match(producers,/href="\/network\/cataloghi"/);
  assert.doesNotMatch(page+parser,/SUPABASE_SECRET_KEY|SUPABASE_SERVICE_ROLE_KEY/);
});

test("SEC1 specifically audits the new anonymous published-only reader",()=>{
  assert.match(sec,/netproducers1_catalog_observed_preview_impl/);
  assert.match(sec,/netproducers1_catalog_observed_preview',/);
  assert.match(sec,/if v_published_facades<>14 then/);
  assert.match(sec,/if v_internals<>15 then/);
  assert.match(sec,/SEC1: catalogue preview must be source-only and published-only/);
});
