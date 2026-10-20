import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import ts from "typescript";

const read=path=>readFileSync(new URL(path,import.meta.url),"utf8");
const source=read("../lib/network-eu-countries.ts");
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
const runtime={exports:{}};
new Function("module","exports",compiled)(runtime,runtime.exports);
const {EU_MEMBER_COUNTRIES,OTHER_NETWORK_COUNTRIES,isEuMemberCountry,isSupportedNetworkCountry,networkCountryName}=runtime.exports;

test("EUROPE1A: exactly 27 unique EU members and legacy non-EU countries",()=>{
  assert.equal(EU_MEMBER_COUNTRIES.length,27);
  const members=EU_MEMBER_COUNTRIES.map(x=>x.code);
  assert.equal(new Set(members).size,27);
  for(const code of ["IT","DE","FR","ES","PL","AT","GR","CZ","SE","FI","HR","RO","PT","NL"]){
    assert.equal(isEuMemberCountry(code),true);
    assert.equal(isSupportedNetworkCountry(code),true);
  }
  for(const code of ["GB","CH","US"]){
    assert.equal(isEuMemberCountry(code),false);
    assert.equal(isSupportedNetworkCountry(code),true);
  }
  assert.equal(OTHER_NETWORK_COUNTRIES.length,3);
  assert.equal(isSupportedNetworkCountry("ZZ"),false);
  assert.equal(networkCountryName("pl"),"Polonia");
});
test("EUROPE1A: Country before Region and native automatic navigation",()=>{
  const geo=read("../components/network-country-region-filters.tsx");
  const ui=read("../components/network-compact-experience.tsx");
  const directory=read("../lib/network-compact-directory.ts");
  assert.ok(geo.indexOf('name="country"')<geo.indexOf('name="region"'));
  assert.ok(ui.indexOf("<NetworkCountryRegionFilters")<ui.indexOf('name:"product"'));
  assert.match(geo,/router\.replace\(/);
  assert.match(geo,/params\.delete\("region"\)/);
  assert.match(geo,/params\.delete\("np"\)/);
  assert.match(directory,/isSupportedNetworkCountry\(requested\)/);
  assert.match(directory,/country&&country!=="IT"\?undefined:filters\.region/);
});
