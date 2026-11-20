import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const read=path=>readFileSync(new URL(path,import.meta.url),"utf8");
const page=read("../components/network-compact-experience.tsx");
const routedForm=read("../components/network-filter-route-form.tsx");
const autoSelect=read("../components/network-auto-submit-select.tsx");
const specPanel=read("../components/network-spec-filters.tsx");
const geoFilters=read("../components/network-country-region-filters.tsx");
const liveSearch=read("../components/network-live-search.tsx");

test("FILTERBAR1.P0: only Europe map and chat occupy the left rail; all facets precede the companies",()=>{
  const asideStart=page.indexOf('data-testid="network-side-column"');
  const map=page.indexOf('<NetworkEuropeanMap ');
  const asideEnd=page.indexOf('</aside>',asideStart);
  const mainResults=page.indexOf('data-testid="network-filter-toolbar"');
  const filter=page.indexOf('data-testid="network-refined-filters"');
  const listing=page.indexOf('id="network-results"');
  assert.ok(asideStart>0&&map>asideStart&&asideEnd>map&&mainResults>asideEnd);
  assert.ok(filter>mainResults&&listing>filter,"Facet bar must sit above results");
  assert.equal((page.match(/<NetworkEuropeanMap /g)||[]).length,1);
  assert.equal((page.match(/<NetworkFilterDrawer /g)||[]).length,1);
  assert.equal((page.match(/<NetworkLiveSearch /g)||[]).length,1);
  assert.doesNotMatch(page.slice(asideStart,asideEnd),/<NetworkFilterDrawer |<NetworkSpecPanel|<NetworkAutoSubmitSelect/);
  assert.match(page,/lg:grid-cols-\\[280px_minmax\\(0,1fr\\)\\]/);
  assert.match(page,/data-testid="network-filter-facets"/);
  assert.match(page,/sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5/);
  assert.match(page,/className="grid min-w-0 grid-cols-1 items-end gap-2/);
});

test("FILTERBAR1.P0: all five industrial role choices, country, region and three sector filters remain available",()=>{
  for(const role of ["Tutta la filiera","Produttori","Commercianti","Terzisti","Utilizzatori"]){
    assert.ok(page.includes('label:"'+role+'"'));
  }
  for(const facet of ["Prodotti","Lavorazioni e servizi","Mercato"]){
    assert.ok(page.includes('label:"'+facet+'"'));
  }
  assert.match(page,/NetworkCountryRegionFilters key=/);
  assert.match(page,/NetworkSpecPanel filters=\\{filters\\} accessMode=\\{accessMode\\}/);
  assert.match(page,/NETWORK_SPEC_PARAMS\\.map/);
  assert.match(page,/data-testid="network-filter-toolbar"/);
  assert.match(page,/data-testid="network-technical-filter-section"/);
  assert.match(page,/data-testid="network-active-filters"/);
  assert.match(geoFilters,/router\\.replace\\(/);
});

test("FILTERBAR1.P0: auto-submit facets and technical spec share SPA navigation with no full document reload",()=>{
  assert.match(page,/<NetworkFilterRouteForm ariaLabel="Filtri tecnici e geografici"/);
  assert.match(specPanel,/<NetworkFilterRouteForm ariaLabel="Ricerca per specifica tecnica"/);
  assert.match(specPanel,/<\\/NetworkFilterRouteForm>/);
  assert.match(autoSelect,/event\\.currentTarget\\.form\\?\\.requestSubmit\\(\\)/);
  assert.match(routedForm,/event\\.preventDefault\\(\\)/);
  assert.match(routedForm,/new FormData\\(event\\.currentTarget\\)/);
  assert.match(routedForm,/params\\.delete\\("np"\\)/);
  assert.match(routedForm,/params\\.delete\\("province"\\)/);
  assert.match(routedForm,/params\\.delete\\("city"\\)/);
  assert.match(routedForm,/startTransition\\(\\(\\)=>router\\.replace\\(href,\\{scroll:false\\}\\)\\)/);
  assert.match(routedForm,/action="\\/network"/);
  assert.match(liveSearch,/startTransition\\(\\(\\)=>router\\.replace\\(href,\\{scroll:false\\}\\)\\)/);
  assert.doesNotMatch(routedForm,/window\\.location\\.(?:reload|href|assign|replace)/);
});
