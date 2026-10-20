import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import ts from "typescript";

const read=path=>readFileSync(new URL(path,import.meta.url),"utf8");
const geometrySource=read("../lib/network-europe-geometry.ts");
const geometryCode=ts.transpileModule(geometrySource,{
  compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS},
}).outputText;
const sandbox={exports:{}};
new Function("module","exports",geometryCode)(sandbox,sandbox.exports);
const {EUROPE_COUNTRY_SHAPES,EUROPE_MAP_VIEWBOX}=sandbox.exports;
const map=read("../components/network-europe-map.tsx");
const ui=read("../components/network-compact-experience.tsx");
const countryFilters=read("../components/network-country-region-filters.tsx");
const originalItaly=read("../components/italy-region-map.tsx");

test("EUROPE1B: 27 real distinct EU paths, complete geometry and ISO Greece mapping",()=>{
  assert.equal(EUROPE_COUNTRY_SHAPES.length,27);
  assert.equal(new Set(EUROPE_COUNTRY_SHAPES.map(x=>x.code)).size,27);
  assert.ok(EUROPE_COUNTRY_SHAPES.some(x=>x.code==="GR"));
  assert.ok(!EUROPE_COUNTRY_SHAPES.some(x=>x.code==="EL"));
  assert.equal(EUROPE_MAP_VIEWBOX,"0 0 960 710");
  for(const x of EUROPE_COUNTRY_SHAPES){
    assert.match(x.path,/^M/);
    assert.match(x.path,/Z$/);
    assert.ok(x.path.length>80,x.code+" real geometry");
    assert.equal(x.bounds.length,4);
    assert.ok(x.bounds.every(Number.isFinite));
    assert.ok(x.bounds[0]<x.bounds[2]&&x.bounds[1]<x.bounds[3]);
  }
  for(const code of ["IT","DE","FR","ES","MT","CY","LU","FI","PT","GR"])assert.ok(EUROPE_COUNTRY_SHAPES.some(x=>x.code===code));
  assert.match(geometrySource,/Eurostat GISCO NUTS 2024/);
  assert.match(geometrySource,/EUPL 1\.2/);
});
test("EUROPE1B: country navigation preserves filters but never stale region or page",()=>{
  assert.match(map,/export function europeMapCountryHref/);
  for(const key of ["q","role","persona","product","capability","market"])assert.ok(map.includes('"'+key+'"'));
  assert.match(map,/params\.set\("country",country\)/);
  const countryBuilder=map.split("export function europeMapCountryHref")[1].split("export function europeMapRegionHref")[0];
  assert.doesNotMatch(countryBuilder,/params\.set\("region"/);
  assert.match(map,/export function europeMapRegionHref/);
  assert.doesNotMatch(map,/params\.set\("np"/);
  assert.match(map,/router\.replace\(europeMapCountryHref\(filters,code\),\{scroll:false\}\)/);
  assert.match(countryFilters,/router\.replace\(/);
});
test("EUROPE1B: compact, full-screen dialog, focus, native links and keyboard list",()=>{
  assert.match(map,/data-testid="network-europe-mini-map"/);
  assert.match(map,/data-testid=\{compact\?"network-eu-map-mini-svg"/);
  assert.match(map,/<dialog ref=\{dialogRef\}/);
  assert.match(map,/modal\.showModal\(\)/);
  assert.match(map,/onClose=\{\(\)=>setExpanded\(false\)\}/);
  assert.match(map,/aria-label="Chiudi mappa europea"/);
  assert.match(map,/europeMapViewBox\(zoomCountry\)/);
  assert.match(map,/aria-label=\{"Cerca aziende in "\+name\}/);
  assert.match(map,/aria-current=\{isCurrent\?"location":undefined\}/);
  assert.match(map,/EU_MEMBER_COUNTRIES\.map/);
  assert.match(map,/setZoomCountry\(null\)/);
  assert.match(map,/20 regioni italiane/);
  assert.match(map,/Confini europei: © Eurostat/);
  assert.doesNotMatch(map,/count\(\)|source_role|service_role|supabase|Math\.random\(/);
});
test("EUROPE1B: Free/Pro single-screen map always visible, Italy regions retained",()=>{
  assert.equal((ui.match(/<NetworkEuropeanMap /g)||[]).length,2);
  assert.match(ui,/data-testid="network-compact-mobile-map"/);
  assert.match(ui,/Mappa interattiva dell'Unione europea/);
  assert.match(ui,/fullMapHref=\{accessMode==="pro"/);
  assert.match(originalItaly,/ITALY_REGION_PATHS\.map/);
  assert.match(originalItaly,/italyRegionFilterHref/);
  assert.match(ui,/NetworkLiveSearch filters=\{filters\}/);
  assert.match(ui,/NetworkCountryRegionFilters key=/);
});
