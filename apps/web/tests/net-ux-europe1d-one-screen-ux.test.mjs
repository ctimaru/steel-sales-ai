import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=path=>readFileSync(new URL(path,import.meta.url),"utf8");
const page=read("../components/network-compact-experience.tsx");
const map=read("../components/network-europe-map.tsx");
const geo=read("../components/network-country-region-filters.tsx");
test("EUROPE1D puts map next to shared filter pane, not next to a giant empty header",()=>{
  const header=page.indexOf('data-testid="network-europe1d-compact-header"');
  const shell=page.indexOf('data-testid="network-europe1d-one-screen-shell"');
  const search=page.indexOf('aria-label="Ricerca e filtri delle aziende"');
  const desktopMap=page.indexOf('<NetworkEuropeanMap ');
  const results=page.indexOf('id="network-results"');
  assert.ok(header>=0&&shell>header&&search>shell&&desktopMap>search&&results>desktopMap);
  assert.equal((page.match(/<NetworkEuropeanMap /g)||[]).length,2);
  assert.match(page,/lg:grid-cols-\[minmax\(0,1fr\)_260px\]/);
});
test("EUROPE1D respects mobile disclosure and visible aligned facet labels",()=>{
  assert.match(page,/data-testid="network-compact-mobile-map"/);
  assert.match(page,/lg:hidden/);
  assert.match(page,/items-end gap-2/);
  for(const label of ["Paese","Regione"])assert.match(geo,new RegExp('text-\\[11px\\].*>'+label+'</span>'));
  for(const label of ["Prodotti","Capability","Mercato"])assert.ok(page.includes('label:"'+label+'"'));
  assert.match(page,/europeNutsRegionName\(filters.country\|\|""/);
  assert.match(page,/data-testid="network-europe1d-active-geography"/);
  assert.match(page,/aria-label="Territorio selezionato"/);
  assert.match(page,/Rimuovi filtro regione/);
});
test("EUROPE1D keeps mini map as European overview, dialog as detail, and country/region navigation distinct",()=>{
  assert.match(map,/europeMapViewBox\(compact\?null:zoomCountry\)/);
  assert.match(map,/data-testid="network-europe1d-overview"/);
  assert.match(map,/setExpanded\(false\);\s*router\.replace\(europeMapRegionHref/);
  assert.match(map,/router\.replace\(europeMapCountryHref\(filters,code\),\{scroll:false\}\)/);
  assert.match(map,/setZoomCountry\(null\)/);
  assert.match(map,/role="group" aria-label="Mappa europea/);
  assert.match(map,/aria-label="Scegli area regionale"/);
});
