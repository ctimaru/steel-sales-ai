import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const read=path=>readFileSync(new URL(path,import.meta.url),"utf8");
const geometry=read("../lib/network-europe-extended-geometry.ts");
const countries=read("../lib/network-eu-countries.ts");
const map=read("../components/network-europe-map.tsx");
const compact=read("../components/network-compact-experience.tsx");

const json=geometry.split("}>=")[1]?.split(";\n\nexport")[0];
assert.ok(json,"Generated extra-country geometry not found");
const shapes=JSON.parse(json);
const europeanCodes=["GB","CH","RS","UA","TR"];
const countryKeys=shapes.map(x=>x.code);

test("EUROPE-EXT1: real shapes for European Network extra-EU markets and geographic context",()=>{
  assert.equal(shapes.length,16);
  assert.equal(new Set(countryKeys).size,16);
  for(const code of europeanCodes)assert.ok(countryKeys.includes(code),code+" must be mapped");
  for(const code of ["IS","NO","AL","BA","ME","MK","LI","XK","MD","BY","RU"])assert.ok(countryKeys.includes(code));
  assert.match(geometry,/Eurostat GISCO\/Nuts2json boundaries/);
  assert.match(geometry,/2021 1:60M NUTS release/);
  assert.match(geometry,/Natural Earth \(public domain/);
  assert.match(geometry,/EUROPE_EXTENDED_MAP_VIEWBOX="-240 0 1330 710"/);
  for(const shape of shapes){
    assert.match(shape.path,/^M/);
    assert.match(shape.path,/Z$/);
    assert.ok(shape.path.length>75,"Non-trivial path for "+shape.code);
    assert.equal(shape.bounds.length,4);
    assert.ok(shape.bounds.every(Number.isFinite));
    assert.ok(shape.bounds[0]<shape.bounds[2]&&shape.bounds[1]<shape.bounds[3]);
    assert.ok(shape.bounds[0]>=-240&&shape.bounds[2]<1092,shape.code+" in viewbox");
    assert.ok(shape.bounds[1]>=0&&shape.bounds[3]<=710,shape.code+" in viewbox");
  }
});

test("EUROPE-EXT1: selective map shows 32 supported countries, excludes US and contextual countries",()=>{
  assert.match(countries,/export const EUROPE_NETWORK_COUNTRIES/);
  assert.match(countries,/OTHER_NETWORK_COUNTRIES\.filter\(country=>country\.code!=="US"\)/);
  assert.match(map,/const selectableCountryCodes=new Set\(EUROPE_NETWORK_COUNTRIES\.map/);
  assert.match(map,/const mappedCountries=EUROPE_EXTENDED_COUNTRY_SHAPES\.filter/);
  assert.match(map,/const contextualCountries=EUROPE_EXTENDED_COUNTRY_SHAPES\.filter/);
  assert.match(map,/contextualCountries\.map\(shape=><path/);
  assert.match(map,/mappedCountries\.map\(shape=>/);
  assert.match(map,/OTHER_NETWORK_COUNTRIES\.filter\(item=>item\.code!=="US"\)\.map\(renderCountry\)/);
  assert.match(map,/EU_MEMBER_COUNTRIES\.map\(renderCountry\)/);
  assert.match(map,/Oltre l'Unione europea/);
  assert.match(map,/europeCountryCount/);
});

test("EUROPE-EXT1: real country counts are reused and map selection keeps SPA semantics",()=>{
  assert.match(compact,/countryCounts=\{Object\.fromEntries\(networkCountries\.map/);
  assert.match(map,/countryCounts:Record<string,number>/);
  assert.match(map,/countsAvailable=Object\.keys\(countryCounts\)\.length>0/);
  assert.match(map,/publishedCount>0\?"#92bea7"/);
  assert.match(map,/startTransition\(\(\)=>router\.replace\(href,\{scroll:false\}\)\)/);
  assert.match(map,/europeMapCountryHref\(filters,item\.code\)/);
  assert.match(map,/params\.set\("country",country\)/);
  assert.doesNotMatch(map,/window\.location\.(?:reload|replace|assign|href)/);
  assert.match(map,/aria-label="Mappa interattiva dell'Europa estesa"/);
});
