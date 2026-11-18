import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";

const read=(path)=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const sql=readFileSync(new URL(
  "../../../supabase/migrations/20261118190000_net_producers_structured_autopublish_owner_moderation.sql",
  import.meta.url),"utf8");
const reader=read("lib/network-producer-structured-catalog.ts");
const catalogue=read("components/producer-structured-catalogue.tsx");
const company=read("components/producer-structured-moderation.tsx");
const page=read("app/(italian)/(workspace)/network/cataloghi/page.tsx");
const ownerPage=read("app/(italian)/(workspace)/network/manage/cataloghi/page.tsx");
const sec=readFileSync(new URL("../../../supabase/tests/sec1_public_rpc_boundary.sql",import.meta.url),"utf8");

test("facts are auto-published individually from official published first-party records",()=>{
  for(const term of [
    "create table private.network_producer_structured_facts",
    "source_claim_id uuid not null unique",
    "evidence_status='first_party_observed'",
    "v.rights_status<>'link_only'",
    "c.website_domain is not null",
    "length(c.website_domain)>4",
    "c.publication_status='published'",
    "r.canonical_key='producer'",
    "netproducers1_structured_auto_publish",
    "on private.network_producer_technical_claims",
    "private.netproducers1_structured_sync_claim(v_claim)",
    "constraint structured_dimensions_valid",
    "netproducers1_structure_dimension",
    "diameter_min_mm","width_max_mm","height_min_mm",
    "thickness_min_mm",
  ]) assert.ok(sql.includes(term),term);
  assert.doesNotMatch(sql,/join private\\.network_producer_catalog_grants/i);
  assert.doesNotMatch(sql,/manufacturer_confirmed/);
  assert.match(sql,/on conflict\\(source_claim_id\\) do update set/);
});

test("company withdrawal cannot be undone by future automatic scans",()=>{
  assert.match(sql,/private\\.network_producer_structured_facts\\.producer_review<>'removed'/);
  assert.match(sql,/s\\.producer_review<>'removed'/);
  assert.match(sql,/visibility='published'/);
  assert.match(sql,/source_withdrawn/);
  assert.match(sql,/netproducers1_structured_events_append_only/);
  assert.match(sql,/private\\.netproducers1_b3c2_is_authorized_company_admin\\(p_company\\)/);
  assert.match(sql,/where id=p_fact and company_id=p_company/);
  assert.match(sql,/when 'confirm' then 'confirmed'/);
  assert.match(sql,/when 'remove' then 'removed'/);
  assert.match(sql,/when 'restore' then 'pending'/);
  assert.doesNotMatch(sql,/grant execute on function public\\.netproducers1_structured_owner_manage\\(text,uuid,uuid\\)\\s+to anon/);
});

test("public catalog response remains atomic, scoped and never an exact SKU",()=>{
  assert.match(sql,/create function sec1_public\\.netproducers1_structured_public_impl/);
  assert.match(sql,/create function public\\.netproducers1_structured_public/);
  assert.match(sql,/security invoker set search_path=''/);
  assert.match(sql,/p_limit not between 1 and 160/);
  assert.match(sql,/source_url',q\\.source_url/);
  assert.match(sql,/exact_skus_confirmed',0/);
  assert.match(sql,/source_pdf_copies',0/);
  assert.match(sql,/visibility='published' and s\\.producer_review<>'removed'/);
  assert.match(reader,/data\\.exact_skus_confirmed!==0/);
  assert.match(reader,/data\\.source_pdf_copies!==0/);
  assert.match(reader,/getProducerStructuredCatalog/);
  assert.match(sec,/netproducers1_structured_public_impl/);
  assert.match(sec,/if v_published_facades<>13 then/);
  assert.match(sec,/if v_internals<>14 then/);
});

test("web/mobile page displays numeric ranges ahead of source links",()=>{
  assert.match(page,/ProducerStructuredCatalogue result=\\{structured\\}/);
  assert.match(page,/Mostra le fonti originali e le schede di provenienza/);
  assert.match(page,/<details className=/);
  assert.match(catalogue,/Dati già disponibili · Senza aprire PDF/);
  assert.match(catalogue,/Gamme dimensionali strutturate/);
  assert.match(catalogue,/diameterMin/);
  assert.match(catalogue,/widthMin/);
  assert.match(catalogue,/thicknessMin/);
  assert.match(catalogue,/Da confermare dal produttore/);
  assert.match(catalogue,/details className=/);
  assert.match(catalogue,/xl:grid-cols-2/);
  assert.match(catalogue,/Non indica automaticamente/i);
});

test("verified producer can confirm/remove/restore without internal platform review",()=>{
  assert.match(ownerPage,/ProducerStructuredModeration/);
  assert.match(ownerPage,/network_company_id/);
  assert.match(company,/netproducers1_structured_owner_manage/);
  for(const value of ["confirm","remove","restore","p_company:companyId","p_fact:factId"])
    assert.ok(company.includes(value),value);
  assert.match(company,/rimosso immediatamente dalla consultazione pubblica/);
  assert.doesNotMatch(company,/SUPABASE_SERVICE_ROLE_KEY|SUPABASE_SECRET_KEY/);
});
