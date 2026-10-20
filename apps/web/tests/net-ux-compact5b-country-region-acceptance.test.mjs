import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const read=path=>readFileSync(new URL(path,import.meta.url),"utf8");
const ui=read("../components/network-compact-experience.tsx");
const geo=read("../components/network-country-region-filters.tsx");
const listing=read("../lib/network-compact-directory.ts");
const pro=read("../app/(italian)/(workspace)/network/page.tsx");
const free=read("../components/free-network-directory.tsx");
const live=read("../components/network-live-search.tsx");

test("COMPACT5B selection: changing country clears a stale Italian region",()=>{
  assert.match(geo,/"use client"/);
  assert.match(geo,/setSelectedCountry\(event.target.value\);setSelectedRegion\(""\)/);
  assert.match(geo,/disabled=\{!italy\}/);
  assert.match(geo,/value=\{selectedRegion\}/);
  assert.match(geo,/name="region"/);
  assert.match(geo,/name="country"/);
  assert.match(geo,/Solo per Italia/);
  assert.match(geo,/aria-describedby="network-region-country-hint"/);
  assert.match(geo,/role="status"/);
});

test("COMPACT5B server defends URL imports and Free/Pro against a foreign-region combination",()=>{
  assert.match(listing,/export function normalizeCompactGeoFilters/);
  assert.match(listing,/country&&country!=="IT"\?undefined:filters.region/);
  assert.match(listing,/filters=normalizeCompactGeoFilters\(filters\)/);
  assert.match(pro,/const compactFilters=normalizeCompactGeoFilters\(/);
  assert.match(free,/const compactFilters=normalizeCompactGeoFilters\(/);
  assert.match(listing,/\["IT","DE","FR","ES","US","GB","CH"\]/);
  assert.match(listing,/await getNetworkBrowsePage\(organizationId,access,"published"/);
});

test("EUROPE1B updates COMPACT5B: European map is contextual for every supported country",()=>{
  assert.doesNotMatch(ui,/const italySelected=!filters.country/);
  assert.match(ui,/NetworkEuropeanMap filters=\{filters\}/);
  assert.match(ui,/data-testid="network-compact-mobile-map"/);
  assert.equal((ui.match(/<NetworkEuropeanMap /g)||[]).length,2);
});

test("COMPACT5B mobile rows show a short usable action with descriptive accessible name",()=>{
  assert.match(ui,/aria-label=\{"Apri profilo di "\+name\}/);
  assert.match(ui,/sm:min-w-\[112px\]/);
  assert.match(ui,/<span className="sm:hidden">Apri<\/span>/);
  assert.match(ui,/<span className="hidden sm:inline">Esplora azienda<\/span>/);
  assert.match(ui,/ui-action-primary/);
  assert.match(ui,/ui-action-secondary/);
});

test("COMPACT5B keeps one form and the existing live search, source and access boundaries",()=>{
  assert.equal((ui.match(/<form method="get" action="\/network"/g)||[]).length,1);
  assert.match(ui,/<NetworkCountryRegionFilters key=/);
  assert.match(ui,/name=\{group.name\}/);
  assert.match(ui,/Località indicativa/);
  assert.match(ui,/Fonte località ↗/);
  assert.match(ui,/Modalità \{accessMode===/);
  assert.match(live,/window\.setTimeout\(\(\)=>navigate\(draft\),350\)/);
  assert.match(live,/router\.replace\(href,\{scroll:false\}\)/);
});
