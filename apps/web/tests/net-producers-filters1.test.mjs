import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";
import ts from "typescript";

// NET-PRODUCERS-FILTERS1 (founder decisions, 23 Nov 2026): filters on all Italian
// producers, documented first-party values only, mentions behind their own switch,
// «Prodotto» as written in the sources, Italy first.
const file=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const sql=file("../../supabase/migrations/20261123180000_net_producers_filters1_directory.sql");
const filtersSrc=file("lib/network-producer-filters.ts");
const reader=file("lib/network-producer-directory.ts");
const route=file("app/(italian)/(workspace)/network/pro/producers/page.tsx");
const page=file("components/network-producers-experience.tsx");
const bar=file("components/network-producers-filter-bar.tsx");
const chat=file("components/eu-producer-intelligence-chat.tsx");

function runtime(source){
  const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const module={exports:{}};
  new Function("require","module","exports",compiled)(()=>{throw Error("no deps");},module,module.exports);
  return module.exports;
}
const f=runtime(filtersSrc);

test("FILTERS1 address: parse, de-duplicate, cap and round-trip",()=>{
  const parsed=f.parseProducerFilters({
    prodotto:["Tubi saldati","tubi  saldati","RHS"],norma:"EN 10219",grado:["S355J2H"],
    regione:"Lombardia",doc:"1",menzioni:"0",ord:"doc",
  });
  assert.deepEqual(parsed.products,["Tubi saldati","RHS"]);
  assert.deepEqual(parsed.standards,["EN 10219"]);
  assert.equal(parsed.region,"Lombardia");
  assert.equal(parsed.documentedOnly,true);
  assert.equal(parsed.includeMentions,false,"mentions only with an explicit 1");
  assert.equal(parsed.sort,"documented");
  const params=f.producerFilterParams({q:"tubi",country:"IT",page:2},parsed);
  assert.equal(params.toString(),"q=tubi&country=IT&prodotto=Tubi+saldati&prodotto=RHS&norma=EN+10219&grado=S355J2H&regione=Lombardia&doc=1&ord=doc&p=2");
  const back=f.parseProducerFilters(Object.fromEntries([...new Set(params.keys())].map(k=>[k,params.getAll(k).length>1?params.getAll(k):params.get(k)])));
  assert.deepEqual(back,parsed);
  const many=f.parseProducerFilters({norma:Array.from({length:30},(_,i)=>"EN "+(10000+i)),grado:"x".repeat(81)});
  assert.equal(many.standards.length,10);
  assert.deepEqual(many.grades,[],"over-long values are dropped");
  assert.equal(f.parseProducerFilters({}).sort,"name");
});

test("FILTERS1 active filters: sort alone is not a filter, mentions switch is not counted",()=>{
  const none=f.parseProducerFilters({ord:"doc",menzioni:"1"});
  assert.equal(f.hasActiveProducerFilters(none),false);
  assert.equal(f.activeProducerFilterCount(f.parseProducerFilters({norma:["EN 10219","EN 10305"],doc:"1"})),3);
  assert.deepEqual(f.toggleFilterValue(["EN 10219"],"en 10219"),[]);
  assert.deepEqual(f.toggleFilterValue([],"EN 10219"),["EN 10219"]);
  assert.notEqual(f.producerFiltersKey(none),f.producerFiltersKey(f.EMPTY_PRODUCER_FILTERS));
});

test("FILTERS1 SQL: entitlement, Italy only, published producers, documented first-party values",()=>{
  for(const token of [
    "private.netpro1b_allowed_for(p_organization_id,'producers',v_country)",
    "using errcode='42501'","using errcode='22023'","v_country<>'IT'",
    "c.publication_status='published' and c.archived_at is null",
    "r.canonical_key='producer' and r.status='active'",
    "e.evidence_status='first_party_observed' and e.rights_status='link_only'",
    "a.evidence_level='source_mention_only'",
    "select * from ev where level='documented' or v_mentions",
    "l.source_status='official_link_observed'",
    "'manufacturer_confirmed',false,'exact_combination_confirmed',false",
    "security definer set search_path=''","security invoker set search_path=''",
  ])assert.ok(sql.includes(token),token);
  // The mentions rule is the same as netproducers1_auto1b_mentions (freshness and hashes).
  for(const token of ["q.last_checked_at>=now()-interval '35 days'","a.source_sha256=q.last_sha256","pg.root_sha256=q.last_sha256"])
    assert.ok(sql.includes(token),token);
  assert.doesNotMatch(sql,/\b(insert into|update [a-z_.]+ set|delete from)\b/i);
  assert.doesNotMatch(sql,/service_role/);
});

test("FILTERS1 SQL privileges: evidence helper never callable directly, no anon",()=>{
  assert.match(sql,/revoke all on function private\.netproducers2_evidence_impl\(text\) from public,anon,authenticated;/);
  assert.doesNotMatch(sql,/grant execute on function private\.netproducers2_evidence_impl/);
  assert.match(sql,/grant execute on function public\.netproducers2_directory\([^)]+\) to authenticated;/);
  assert.match(sql,/grant execute on function public\.netproducers2_facets\(uuid,text,boolean\) to authenticated;/);
  assert.doesNotMatch(sql,/grant execute[^;]*to anon/i);
  // The existing directory is untouched, so the frontend can always fall back to it.
  assert.doesNotMatch(sql,/create or replace function [a-z_.]*netpro1b_scoped_directory/);
});

test("FILTERS1 reader: fails closed, falls back, never uses a service key",()=>{
  assert.match(reader,/db\.rpc\("netproducers2_directory"/);
  assert.match(reader,/db\.rpc\("netproducers2_facets"/);
  assert.match(reader,/error\.code === "42501" \? \{ result: \{ status: "locked", data: null \}, counts: \{\} \} : null/);
  assert.match(reader,/obj\.manufacturer_confirmed !== false \|\| obj\.exact_combination_confirmed !== false/);
  assert.doesNotMatch(reader,/SUPABASE_SERVICE_ROLE_KEY|service_role/);
  assert.match(route,/const filtersAvailable=filtered!==null;/);
  assert.match(route,/filtered\?filtered\.result:await getNetworkProScopedDirectory\(\{/);
  assert.match(route,/country==="IT"\?parseProducerFilters\(params\):EMPTY_PRODUCER_FILTERS/);
});

test("FILTERS1 page: filter bar, honest empty state, AI answer can become a filter",()=>{
  assert.match(page,/<NetworkProducersFilterBar filters=\{filters\} facets=\{facets\}/);
  assert.match(page,/I filtri usano solo i dati tecnici con fonte/);
  assert.match(page,/data-testid="producer-filters-unavailable"/);
  assert.match(bar,/Includi menzioni da qualificare/);
  assert.match(bar,/Più documentati prima/);
  assert.match(bar,/producerFilterParams\(\{q:query,country\},next\)/);
  assert.match(chat,/data-testid="eu-producer-chat-apply-filters"/);
  assert.match(page,/onApplyFilters=\{filtersAvailable\?applyAiFilters:undefined\}/);
});
