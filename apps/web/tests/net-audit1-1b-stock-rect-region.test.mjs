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
const intent=await load("../lib/network-spec-intent.ts");
const rpc=read("../lib/network-spec-search.ts");
const panel=read("../components/network-spec-filters.tsx");
const actions=read("../app/(italian)/(workspace)/network/conversation-actions.ts");
const live=read("../components/network-live-search.tsx");
const pro=read("../app/(italian)/(workspace)/network/page.tsx");
const free=read("../components/free-network-directory.tsx");
const migration=read("../../../supabase/migrations/20261101210000_netaudit1_1b_spec_search_v2.sql");

test("NET-AUDIT1.1b URL: second side only for a rectangle with a first side",()=>{
  assert.deepEqual(spec.normalizeSpecFilters({shape:"rectangular",side:"120",side2:"80"}),{shape:"rectangular",side:120,side2:80});
  assert.deepEqual(spec.normalizeSpecFilters({shape:"square",side:"100",side2:"80"}),{shape:"square",side:100});
  assert.deepEqual(spec.normalizeSpecFilters({shape:"rectangular",side2:"80"}),{shape:"rectangular"});
  assert.deepEqual(spec.normalizeSpecFilters({std:"EN 10219",stock:"1"}),{std:"EN 10219",stock:true});
  assert.deepEqual(spec.normalizeSpecFilters({std:"EN 10219",stock:"yes"}),{std:"EN 10219"});
});

test("NET-AUDIT1.1b stock alone is not a specification; params round-trip",()=>{
  assert.equal(spec.hasSpecCriteria({stock:true}),false);
  assert.equal(spec.hasSpecCriteria({stock:true,grade:"S355"}),true);
  assert.deepEqual(spec.specFiltersToParams({shape:"rectangular",side:120,side2:80,stock:true}),
    {shape:"rectangular",side:"120",side2:"80",stock:"1"});
  assert.equal(spec.describeSpecFilters({std:"EN 10219",shape:"rectangular",side:120,side2:80,wt:5,stock:true}),
    "EN 10219 · rettangolare · 120 × 80 × 5 mm · a stock");
});

test("NET-AUDIT1.1b chat: rectangles keep both sides, stock words become the filter",()=>{
  assert.deepEqual(intent.extractNetworkSpecIntent("rettangolari 120x80x5 EN 10219 a stock").spec,
    {std:"EN 10219",stock:true,side:120,wt:5,side2:80,shape:"rectangular"});
  assert.deepEqual(intent.extractNetworkSpecIntent("tubo rettangolare 120x80 S355").spec,
    {grade:"S355",side:120,side2:80,shape:"rectangular"});
  assert.deepEqual(intent.extractNetworkSpecIntent("quadro 100x100x4").spec,{side:100,wt:4,shape:"square"});
  const ready=intent.extractNetworkSpecIntent("EN 10219 S355 in pronta consegna");
  assert.equal(ready.spec.stock,true);
  assert.deepEqual(ready.notApplied,[],"pronta consegna is stock, not a delivery deadline");
  assert.deepEqual(intent.extractNetworkSpecIntent("EN 10219 consegna entro 5 giorni").notApplied,["tempi di consegna"]);
});

test("NET-AUDIT1.1b RPC: v2 first, v1 fallback only without the new criteria",()=>{
  assert.match(rpc,/supabase\.rpc\("netaudit1_spec_search_v2"/);
  assert.match(rpc,/p_side2_mm:spec\.side2\?\?null,p_in_stock:spec\.stock===true/);
  assert.match(rpc,/if\(missingFunction\(error\)&&!spec\.side2&&!spec\.stock\)/);
  assert.match(rpc,/payload\.contract!=="netaudit1-spec-v1"&&payload\.contract!=="netaudit1-spec-v2"/);
});

test("NET-AUDIT1.1b migration: additive, v1 contract kept, stock is declared-only",()=>{
  assert.match(migration,/create or replace function public\.netaudit1_spec_search_v2\(/);
  assert.match(migration,/'\{contract\}','"netaudit1-spec-v1"'::jsonb/);
  assert.match(migration,/drop function if exists private\.netaudit1_spec_search_impl\(/);
  assert.match(migration,/when p\.relationship_type='stocks' then 'exact'/);
  assert.match(migration,/cap\.canonical_key='stockholding'/);
  assert.match(migration,/else 'unknown' end as s_stock/);
  assert.match(migration,/p_side_mm between wh\.w_min and wh\.w_max and p_side2_mm between wh\.h_min and wh\.h_max/);
  assert.match(migration,/perform private\.pa1_3_require_network_access\(p_organization_id\)/);
  assert.match(migration,/revoke all on function public\.netaudit1_spec_search_v2\([^)]*\) from public,anon;/);
});

test("NET-AUDIT1.1b UI and chat wiring",()=>{
  assert.match(panel,/field\("side2","2° lato \(mm\)"/);
  assert.match(panel,/name="stock" value="1"/);
  assert.match(panel,/\.\.\.\(match\.stock\?\["a stock"\]:\[\]\)/);
  assert.match(live,/"side","side2","stock"\]/);
  assert.match(pro,/side2:params\.side2,stock:params\.stock/);
  assert.match(free,/side2:filters\.side2,stock:filters\.stock/);
  // Generic chat uses the 20 official regions, not published-facility facets.
  assert.match(actions,/regions:\[\.\.\.ITALY_REGIONS\],\.\.\.europeanIntentTaxonomy\(\)/);
  assert.doesNotMatch(actions,/getNetworkGeoFacets/);
});
