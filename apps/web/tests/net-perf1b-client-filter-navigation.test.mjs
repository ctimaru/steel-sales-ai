import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const load=path=>readFileSync(new URL(path,import.meta.url),"utf8");
const ui=load("../components/network-compact-experience.tsx");
const form=load("../components/network-filter-client-form.tsx");
const auto=load("../components/network-auto-submit-select.tsx");
const country=load("../components/network-country-region-filters.tsx");
const search=load("../components/network-live-search.tsx");

test("NET-PERF1.B: desktop and mobile technical dropdowns use App Router without document reload",()=>{
  assert.match(ui,/<NetworkFilterClientForm>/);
  assert.match(ui,/<\/NetworkFilterClientForm>/);
  assert.doesNotMatch(ui,/<form method="get" action="\/network" aria-label="Filtri tecnici e geografici"/);
  assert.match(form,/event\.preventDefault\(\)/);
  assert.match(form,/router\.replace\(destination,\{scroll:false\}\)/);
  assert.match(auto,/event\.currentTarget\.form\?\.requestSubmit\(\)/);
});

test("NET-PERF1.B: native GET remains accessible without hydration or JavaScript",()=>{
  assert.match(form,/<form method="get" action="\/network"/);
  assert.match(form,/onSubmit=\{submit\}/);
  assert.match(ui,/Applica filtri/);
  assert.match(ui,/type="submit"/);
  assert.match(form,/aria-live="polite"/);
});

test("NET-PERF1.B: filter state preserved, omitted selections cleared, page reset",()=>{
  for(const key of ["q","role","persona","steel","std","grade","shape","od","wt","side","side2","stock","country","region","product","capability","market"]){
    assert.ok(form.includes('"'+key+'"'),"missing controlled filter: "+key);
  }
  for(const reset of ["np","p","dpage","province","city"]){
    assert.ok(form.includes('"'+reset+'"'),"old pagination/geography not reset: "+reset);
  }
  assert.match(form,/const params=new URLSearchParams\(currentSearch\)/);
  assert.match(form,/for\(const key of CONTROLLED_FILTERS\)params\.delete\(key\)/);
  assert.match(form,/if\(trimmed\)params\.set\(key,trimmed\)/);
  assert.match(form,/#network-results/);
});

test("NET-PERF1.B: map, geo dropdowns and live typing retain existing client transitions",()=>{
  assert.match(country,/router\.replace\("\/network\?"/);
  assert.match(search,/startTransition\(\(\)=>router\.replace/);
  assert.match(ui,/data-testid="network-europe-persistent-map"/);
  assert.match(ui,/data-testid="network-europe1d-one-screen-shell"/);
});
