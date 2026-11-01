import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import ts from "typescript";

const read=path=>readFileSync(new URL(path,import.meta.url),"utf8");
const load=async path=>{
  const source=read(path).replace(/^import .*;$/gm,"");
  const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText;
  return import("data:text/javascript;base64,"+Buffer.from(js).toString("base64"));
};

const spec=await load("../lib/network-spec-filters.ts");
const listing=read("../lib/network-compact-directory.ts");
const rpc=read("../lib/network-spec-search.ts");
const panel=read("../components/network-spec-filters.tsx");
const ui=read("../components/network-compact-experience.tsx");
const pro=read("../app/(italian)/(workspace)/network/page.tsx");
const free=read("../components/free-network-directory.tsx");
const live=read("../components/network-live-search.tsx");
const migration=read("../../../supabase/migrations/20261101110000_netaudit1_1_spec_search.sql");
const sqlTest=read("../../../supabase/tests/netaudit1_1_spec_search.sql");
const gate=read("../../../.github/workflows/p0-required-gate.yml");

test("NET-AUDIT1.1 millimetres accept Italian decimals and reject nonsense",()=>{
  assert.equal(spec.parseSpecMillimetres("60,3",5000),60.3);
  assert.equal(spec.parseSpecMillimetres(" 60.3 mm ",5000),60.3);
  assert.equal(spec.parseSpecMillimetres("1560",5000),1560);
  for(const bad of ["0","-3","abc","60,3,1","99999","1e3","",undefined]){
    assert.equal(spec.parseSpecMillimetres(bad,5000),undefined,String(bad));
  }
  assert.equal(spec.parseSpecMillimetres("600",500),undefined);
});

test("NET-AUDIT1.1 contradictory geometry is dropped, never guessed",()=>{
  assert.deepEqual(spec.normalizeSpecFilters({shape:"round",od:"60,3",side:"100"}),{shape:"round",od:60.3});
  assert.deepEqual(spec.normalizeSpecFilters({shape:"square",od:"60,3",side:"100"}),{shape:"square",side:100});
  assert.deepEqual(spec.normalizeSpecFilters({shape:"oval",std:"EN 10219<script>"}),{std:"EN 10219script"});
  assert.deepEqual(spec.normalizeSpecFilters({}),{});
});

test("NET-AUDIT1.1 a shape alone is not a technical criterion",()=>{
  assert.equal(spec.hasSpecCriteria({shape:"round"}),false);
  assert.equal(spec.hasSpecCriteria({grade:"S235"}),true);
  assert.equal(spec.hasSpecCriteria({wt:3}),true);
});

test("NET-AUDIT1.1 spec summary and provenance labels are Italian and honest",()=>{
  assert.equal(spec.describeSpecFilters({std:"EN 10219",grade:"S235",od:60.3,wt:3}),"EN 10219 · S235 · Ø 60,3 × 3 mm");
  assert.equal(spec.describeSpecFilters({shape:"square",side:100}),"quadro · lato 100 mm");
  assert.equal(spec.describeSpecFilters({wt:2.5}),"spessore 2,5 mm");
  assert.equal(spec.specProvenanceLabel("public_web"),"Da fonte pubblica");
  assert.equal(spec.specProvenanceLabel("platform_verified"),"Verificato");
  assert.deepEqual(spec.specFiltersToParams({std:"EN 10219",od:60.3}),{std:"EN 10219",od:"60.3"});
});

test("NET-AUDIT1.1 migration: paid guard, published scope only, no quantities",()=>{
  assert.match(migration,/perform private\.pa1_3_require_network_access\(p_organization_id\)/);
  assert.match(migration,/c\.publication_status='published' and c\.archived_at is null/);
  assert.match(migration,/review_state in \('rejected','superseded'\)/);
  assert.match(migration,/coalesce\(p_verification_status,''\)<>'rejected'/);
  assert.match(migration,/starts_with\(mg\.designation_key,v_grade\)/);
  assert.match(migration,/when 'unknown'=any\(array\[/);
  assert.match(migration,/where ps\.status<>'mismatch'/);
  assert.match(migration,/revoke all on function public\.netaudit1_spec_search\([^)]*\)\s*from public,anon;/);
  assert.doesNotMatch(migration,/p_quantity|p_length|commercial_memory/i);
  assert.match(sqlTest,/rollback;\s*$/);
  assert.match(gate,/netaudit1_1_spec_search\.sql \\/);
});

test("NET-AUDIT1.1 server: spec path first, Free locked, ignored filters reported",()=>{
  assert.match(listing,/if\(hasSpecCriteria\(spec\)\)return specCompactPage\(organizationId,access,filters,spec\);/);
  assert.match(listing,/if\(access!=="pro"\)return \{\.\.\.base,items:\[\]/);
  assert.match(listing,/specLocked:true/);
  assert.match(listing,/specIgnored/);
  assert.match(listing,/for\(const key of NETWORK_SPEC_PARAMS\)delete rest\[key\]/);
  assert.match(rpc,/supabase\.rpc\("netaudit1_spec_search"/);
  assert.match(rpc,/payload\.contract!=="netaudit1-spec-v1"/);
  assert.match(rpc,/import "server-only"/);
  // Never fall back silently to a listing that ignores the spec.
  assert.match(pro,/hasSpecCriteria\(normalizeSpecFilters\(compactFilters\)\)/);
  assert.match(free,/hasSpecCriteria\(normalizeSpecFilters\(filters\)\)/);
  for(const key of ["std","grade","shape","od","wt","side"]){
    assert.match(pro,new RegExp(key+":params\\."+key));
    assert.match(free,new RegExp(key+":filters\\."+key));
  }
});

test("NET-AUDIT1.1 UI: GET panel, Pro lock, divider, weakest provenance",()=>{
  assert.match(panel,/<form method="get" action="\/network" aria-label="Ricerca per specifica tecnica"/);
  assert.match(panel,/disabled=\{locked\}/);
  assert.match(panel,/Quantità e lunghezze di taglio si indicano nella richiesta d'offerta/);
  assert.match(panel,/Scope tecnico non dichiarato per questa specifica/);
  assert.match(panel,/Show the weakest provenance/);
  assert.match(ui,/<NetworkSpecPanel filters=\{filters\} accessMode=\{accessMode\}\/>/);
  assert.match(ui,/data-testid="network-spec-undeclared-divider"/);
  assert.match(ui,/data-testid="network-spec-locked"/);
  assert.match(ui,/La compatibilità dichiarata non è una conferma di disponibilità/);
  assert.match(ui,/" compatibili"/);
  assert.match(ui,/!specMode&&!filters\.product/);
  assert.match(live,/"std","grade","shape","od","wt","side"/);
});

const intent=await load("../lib/network-spec-intent.ts");
const actions=read("../app/(italian)/(workspace)/network/conversation-actions.ts");
const regionCatalog=await load("../lib/network-italy-regions.ts");
const intentParser=await load("../lib/network-intent-parser.ts");
const chat=read("../components/network-conversation.tsx");

test("NET-AUDIT1.1 chat extractor: spec becomes filters, quantity and length stay RFQ",()=>{
  const r=intent.extractNetworkSpecIntent("40 tubi EN 10219 S235 da 3 metri");
  assert.deepEqual(r.spec,{std:"EN 10219",grade:"S235"});
  assert.deepEqual(r.rfqDetails,["quantità 40 tubi","lunghezza 3 m"]);
  assert.deepEqual(r.notApplied,[]);
});

test("NET-AUDIT1.1 chat extractor: compact dimensions, shapes and context",()=>{
  const round=intent.extractNetworkSpecIntent("commercianti in Piemonte con tubi EN 10219 S355J2H 60,3x3");
  assert.deepEqual(round.spec,{std:"EN 10219",grade:"S355J2H",od:60.3,wt:3,shape:"round"});
  assert.match(round.remainder,/commercianti in Piemonte/);
  assert.deepEqual(intent.extractNetworkSpecIntent("tubo quadro 100x100x4 S355").spec,{grade:"S355",side:100,wt:4,shape:"square"});
  assert.equal(intent.extractNetworkSpecIntent("rettangolari 120x80x5").spec.shape,"rectangular");
  assert.deepEqual(intent.extractNetworkSpecIntent("EN ISO 3183 L245").spec,{std:"EN ISO 3183",grade:"L245"});
});

test("NET-AUDIT1.1 chat extractor: unsupported requirements are named, ISO 9001 is not a product standard",()=>{
  const r=intent.extractNetworkSpecIntent("Ø 48,3 spessore 2,6 inox con certificato 3.1");
  assert.deepEqual(r.spec,{od:48.3,wt:2.6});
  assert.deepEqual(r.notApplied,["materiale inox","certificato"]);
  const cert=intent.extractNetworkSpecIntent("fornitori certificati ISO 9001 in Lombardia");
  assert.deepEqual(cert.spec,{});
  assert.deepEqual(intent.extractNetworkSpecIntent("quanti commercianti in Lombardia?").spec,{});
});

test("NET-AUDIT1.1 chat action: spec answered before the RFQ redirect, honestly",()=>{
  const spec=actions.indexOf("if(hasSpecCriteria(specIntent.spec))");
  const rfq=actions.indexOf("if(looksLikeRfqRequest(query))");
  assert.ok(spec>0&&rfq>spec,"spec branch must precede the RFQ redirect");
  assert.match(actions,/answerSpecRequest\(context\.organizationId,access\.can_access_network,specIntent,query\)/);
  assert.match(actions,/disponibile nel Network Pro/);
  assert.match(actions,/getNetworkSpecPage\(organizationId,spec,\{role:filters\.role,region:filters\.region\},0,1\)/);
  assert.match(actions,/Compatibilità dichiarata, non disponibilità confermata\./);
  assert.match(actions,/restano per la richiesta d'offerta, non sono filtri del Network/);
  assert.match(actions,/Non applicati perché non filtrabili: /);
  assert.match(actions,/rfqHref=specIntent\.rfqDetails\.length\?/);
  assert.match(chat,/latestAssistant\?\.result\?\.rfqHref/);
  assert.match(chat,/Mostra fornitori compatibili →/);
});

test("NET-AUDIT1.1 chat Region never loses Piemonte when legacy facets omit it",()=>{
  const raw="commercianti in Piemonte con tubi EN 10219 S235";
  const extracted=intent.extractNetworkSpecIntent(raw);
  assert.equal(extracted.spec.std,"EN 10219");
  assert.equal(extracted.spec.grade,"S235");
  const legacy=intentParser.interpretNetworkIntent(extracted.remainder,{regions:["Lombardia"]});
  assert.notEqual(legacy.filters.region,"Piemonte","regression reproduces partial legacy facets");
  const recognized=intentParser.interpretNetworkIntent(extracted.remainder,{regions:[...regionCatalog.ITALY_REGIONS]});
  assert.equal(recognized.filters.region,"Piemonte");
  assert.equal(recognized.filters.role,"trader_distributor");
  const params=new URLSearchParams(spec.specFiltersToParams(extracted.spec));
  params.set("region",recognized.filters.region);
  params.set("role",recognized.filters.role);
  assert.match(params.toString(),/region=Piemonte/);
  assert.match(params.toString(),/role=trader_distributor/);
  assert.ok(actions.includes('import {ITALY_REGIONS} from "@/lib/network-italy-regions";'));
  assert.ok(actions.includes("interpretNetworkIntent(specIntent.remainder,{regions:[...ITALY_REGIONS]})"));
  assert.ok(actions.includes("getNetworkSpecPage(organizationId,spec,{role:filters.role,region:filters.region},0,1)"));
});
