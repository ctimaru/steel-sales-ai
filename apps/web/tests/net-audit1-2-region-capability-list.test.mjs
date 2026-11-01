import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import ts from "typescript";

const read=path=>readFileSync(new URL(path,import.meta.url),"utf8");
// Pure helpers are executed for real; runtime-only imports are removed first.
const load=async path=>{
  const source=read(path).replace(/^import .*;$/gm,"");
  const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText;
  return import("data:text/javascript;base64,"+Buffer.from(js).toString("base64"));
};

const regions=await load("../lib/network-italy-regions.ts");
const capabilities=await load("../lib/network-compact-capabilities.ts");
const geo=read("../components/network-country-region-filters.tsx");
const ui=read("../components/network-compact-experience.tsx");
const listing=read("../lib/network-compact-directory.ts");
const pro=read("../app/(italian)/(workspace)/network/page.tsx");
const free=read("../components/free-network-directory.tsx");
const capabilitySource=read("../lib/network-compact-capabilities.ts");

test("NET-AUDIT1.2 Italy offers all 20 official regions, including Piemonte and Veneto",()=>{
  const options=regions.italyRegionOptions();
  assert.equal(options.length,20);
  for(const name of ["Piemonte","Veneto","Lombardia","Emilia-Romagna","Valle d'Aosta","Trentino-Alto Adige"]){
    assert.ok(options.includes(name),name+" missing");
  }
  assert.equal(new Set(options).size,20);
});

test("NET-AUDIT1.2 a URL region is shown with its official spelling, never as another option",()=>{
  assert.equal(regions.canonicalItalyRegion("piemonte"),"Piemonte");
  assert.equal(regions.canonicalItalyRegion(" valle d aosta "),"Valle d'Aosta");
  assert.equal(regions.canonicalItalyRegion("Friuli Venezia Giulia"),"Friuli-Venezia Giulia");
  assert.equal(regions.canonicalItalyRegion(""),"");
  // A non-Italian value stays visible as the selected option instead of vanishing.
  const options=regions.italyRegionOptions("Bavaria");
  assert.equal(options.length,21);
  assert.ok(options.includes("Bavaria"));
  assert.equal(regions.italyRegionOptions("piemonte").length,20);
});

test("NET-AUDIT1.2 region select no longer depends on published-facility facets",()=>{
  assert.match(geo,/italyRegionOptions\(selectedRegion\)/);
  assert.match(geo,/canonicalItalyRegion\(region\)/);
  assert.doesNotMatch(geo,/regions=\[\]/);
  assert.doesNotMatch(ui,/regions=\{regions\}/);
  assert.doesNotMatch(pro,/compactGeo\.regions/);
  assert.doesNotMatch(free,/regions=\{compactCoverage/);
  // Foreign countries keep the Eurostat NUTS catalogue.
  assert.match(geo,/europeRegionsForCountry\(selectedCountry\)/);
});

test("NET-AUDIT1.2 capability labels are grouped per company, ordered and de-duplicated",()=>{
  const ids=["a","b","c"];
  const facilities=[{id:"f1",company_id:"a"},{id:"f2",company_id:"a"},{id:"f3",company_id:"b"}];
  const links=[
    {facility_id:"f1",capability_id:"laser"},{facility_id:"f2",capability_id:"laser"},
    {facility_id:"f1",capability_id:"stock"},{facility_id:"f2",capability_id:"saw"},
    {facility_id:"f3",capability_id:"retired"},{facility_id:"unknown",capability_id:"saw"},
  ];
  const caps=[
    {id:"laser",canonical_key:"laser_cutting",display_name:"Laser cutting",sort_order:20},
    {id:"stock",canonical_key:"stockholding",display_name:"Stockholding",sort_order:5},
    {id:"saw",canonical_key:"sawing",display_name:"Sawing",sort_order:20},
  ];
  const result=capabilities.groupCapabilityLabels(ids,facilities,links,caps);
  assert.deepEqual(result.a,["Stockholding","Laser cutting","Sawing"]);
  // Inactive / unknown capability ids are ignored, never invented.
  assert.deepEqual(result.b,[]);
  // Companies without published facilities (e.g. unconfirmed) get no labels.
  assert.deepEqual(result.c,[]);
});

test("NET-AUDIT1.2 labels come from published facilities of the exact page companies",()=>{
  assert.match(capabilitySource,/import "server-only"/);
  assert.match(capabilitySource,/from\("network_facilities"\)/);
  assert.match(capabilitySource,/\.eq\("publication_status","published"\)\.is\("archived_at",null\)/);
  assert.match(capabilitySource,/\.eq\("status","active"\)/);
  assert.doesNotMatch(capabilitySource,/service_role|SERVICE_ROLE|createAdminClient/);
  assert.match(capabilitySource,/catch\{\s*return \{\};/);
  assert.match(listing,/const capabilityLabels=await getPublishedCapabilityLabels\(page\.items\.map\(company=>company\.id\)\)/);
  assert.match(listing,/if\(page\.capabilityLabels\)return page;/);
  // The Pro page no longer reads an unrelated 18-row legacy window for labels.
  assert.doesNotMatch(pro,/compactLegacyResults/);
  assert.match(pro,/capabilityLabels=\{compact\.capabilityLabels\}/);
  assert.match(free,/capabilityLabels=\{compact\.capabilityLabels\}/);
});

test("NET-AUDIT1.2 capability cell shows two labels, a +N overflow and a neutral empty state",()=>{
  assert.match(ui,/data-testid="network-compact-capabilities"/);
  assert.match(ui,/capabilities\.slice\(0,2\)/);
  assert.match(ui,/\+\{capabilities\.length-2\}/);
  assert.match(ui,/Nessuna capability pubblicata/);
  assert.doesNotMatch(ui,/>Non indicate</);
});
