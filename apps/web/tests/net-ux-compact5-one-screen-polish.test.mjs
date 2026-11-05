import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const page=readFileSync(new URL("../components/network-compact-experience.tsx",import.meta.url),"utf8");
const live=readFileSync(new URL("../components/network-live-search.tsx",import.meta.url),"utf8");
const geo=readFileSync(new URL("../components/network-country-region-filters.tsx",import.meta.url),"utf8");

test("COMPACT5 keeps the dashboard summary compact and free of filler metrics",()=>{
  assert.match(page,/aria-label="Statistiche Network"/);
  // NET-UX LOT1: one inline line next to the title instead of a stats box.
  assert.doesNotMatch(page,/label:"Ruoli nella filiera"/);
  assert.match(page,/profili pubblicati/);
  assert.match(page,/censite da fonti pubbliche/);
});

test("COMPACT5 places the region within the single filter form instead of a separate disclosure",()=>{
  assert.equal((page.match(/<form method="get" action="\/network"/g)||[]).length,1);
  assert.equal((geo.match(/name="region"/g)||[]).length,1);
  assert.match(geo,/name="region" aria-label="Regione"/);
  assert.match(geo,/Tutte le regioni/);
  assert.match(page,/className="grid grid-cols-1 gap-3"/); // NET-UX LOT1: one column in the filter pane
  assert.match(page,/Applica filtri/);
  assert.doesNotMatch(page,/open=\{Boolean\(filters.region\)\}/);
  // Preserve search query, role and persona when submitting all five facets.
  for(const filter of ["q","role","persona"]){
    assert.match(page,new RegExp('name="'+filter+'" value=\\{filters\\.'+filter+'\\}'));
  }
});

test("NET-UX-MAP1 keeps the European map permanently visible above filters",()=>{
  assert.match(page,/data-testid="network-europe-persistent-map"/);
  assert.doesNotMatch(page,/data-testid="network-compact-mobile-map"/);
  // NET-UX-MAP1: exactly one map remains outside the mobile filter drawer.
  assert.ok(page.indexOf('data-testid="network-europe-persistent-map"')<page.indexOf('<NetworkFilterDrawer activeCount='));
  assert.equal((page.match(/<NetworkEuropeanMap /g)||[]).length,1);
  assert.match(page,/aria-label="Filtri delle aziende"/);
  assert.match(page,/aria-label="Ricerca e filtri delle aziende"/);
});

test("COMPACT5 leaves the core conversion and trust boundaries unchanged",()=>{
  assert.match(page,/ui-action-primary/);
  assert.match(page,/ui-action-secondary/);
  assert.match(page,/Località indicativa/);
  assert.match(page,/Fonte ↗/);
  assert.match(page,/>\s*Connetti\s*</);
  assert.match(page,/\{accessMode==="pro"\?"Pro":"Free"\}/);
  assert.match(live,/window\.setTimeout\(\(\)=>navigate\(draft\),350\)/);
  assert.match(live,/router\.replace\(href,\{scroll:false\}\)/);
});
