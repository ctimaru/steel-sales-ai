import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const page=readFileSync(new URL("../components/network-compact-experience.tsx",import.meta.url),"utf8");
const live=readFileSync(new URL("../components/network-live-search.tsx",import.meta.url),"utf8");
const geo=readFileSync(new URL("../components/network-country-region-filters.tsx",import.meta.url),"utf8");

test("COMPACT5 keeps the dashboard summary compact and free of filler metrics",()=>{
  assert.match(page,/aria-label="Statistiche Network"/);
  assert.match(page,/flex flex-wrap items-center gap-x-5 gap-y-1/);
  assert.doesNotMatch(page,/label:"Ruoli nella filiera"/);
  assert.match(page,/Aziende nel Network/);
  assert.match(page,/Profili pubblicati/);
  assert.match(page,/Aziende censite/);
});

test("COMPACT5 places the region within the single filter form instead of a separate disclosure",()=>{
  assert.equal((page.match(/<form method="get" action="\/network"/g)||[]).length,1);
  assert.equal((geo.match(/name="region"/g)||[]).length,1);
  assert.match(geo,/name="region" aria-label="Regione"/);
  assert.match(geo,/Tutte le regioni/);
  assert.match(page,/xl:grid-cols-\[repeat\(5,minmax\(0,1fr\)\)_auto\]/);
  assert.match(page,/Applica filtri/);
  assert.doesNotMatch(page,/open=\{Boolean\(filters.region\)\}/);
  // Preserve search query, role and persona when submitting all five facets.
  for(const filter of ["q","role","persona"]){
    assert.match(page,new RegExp('name="'+filter+'" value=\\{filters\\.'+filter+'\\}'));
  }
});

test("EUROPE1B preserves COMPACT5 optional map and desktop location",()=>{
  assert.match(page,/data-testid="network-compact-mobile-map"/);
  assert.match(page,/<details className="rounded-xl border/);
  assert.match(page,/Mappa interattiva dell'Unione europea/);
  assert.equal((page.match(/<NetworkEuropeanMap /g)||[]).length,2);
  assert.match(page,/lg:hidden/);
  assert.match(page,/hidden min-w-0 lg:block/);
  assert.match(page,/aria-label="Ricerca e filtri delle aziende"/);
});

test("COMPACT5 leaves the core conversion and trust boundaries unchanged",()=>{
  assert.match(page,/ui-action-primary/);
  assert.match(page,/ui-action-secondary/);
  assert.match(page,/Località indicativa/);
  assert.match(page,/Fonte località ↗/);
  assert.match(page,/Esplora azienda/);
  assert.match(page,/Modalità \{accessMode===/);
  assert.match(live,/window\.setTimeout\(\(\)=>navigate\(draft\),350\)/);
  assert.match(live,/router\.replace\(href,\{scroll:false\}\)/);
});
