import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";
const read=(p)=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const route=read("app/(italian)/(workspace)/network/pro/producers/page.tsx");
const ui=read("components/network-producers-experience.tsx");
const entry=read("components/network-producers-entry.tsx");
const compact=read("components/network-compact-experience.tsx");
const access=read("lib/network-pro-coverage.ts");

test("EU1.C2: country from URL reaches server-side producer PRO entitlement without fallback escalation",()=>{
  assert.match(route,/country\?:string/);
  assert.match(route,/isSupportedNetworkCountry\(requestedCountry\)&&requestedCountry!=="US"/);
  assert.match(route,/\?requestedCountry:"IT"/);
  assert.match(route,/getNetworkProScopedDirectory\(\{/);
  assert.match(route,/module:"producers",\s*country,/);
  assert.match(route,/row\.countryCode===country/);
  assert.match(access,/netpro1b_scoped_directory/);
  assert.match(access,/error\.code==="42501"/);
  assert.doesNotMatch(route,/SUPABASE_SERVICE_ROLE_KEY|service_role/);
});

test("EU1.C2: country is preserved through Network entry, search, pagination and compare",()=>{
  assert.match(compact,/<NetworkProducersEntry country=\{filters\.country\|\|"IT"\}/);
  assert.match(entry,/href=\{"\/network\/pro\/producers\?country="\+encodeURIComponent\(country\)\}/);
  assert.match(ui,/<select id="manufacturer-country" name="country" defaultValue=\{country\}/);
  assert.match(ui,/EU_MEMBER_COUNTRIES\.map/);
  assert.match(ui,/OTHER_NETWORK_COUNTRIES\.filter\(item=>item\.code!=="US"\)/);
  assert.match(ui,/new URLSearchParams\(\{q:query,country,p:String\(page\)\}\)/);
  assert.match(ui,/JSON\.stringify\(\[query,page,country\]\)/);
  assert.match(ui,/networkCountryName\(company\.countryCode\)/);
  assert.match(ui,/networkCountryName\(c\.countryCode\)/);
});

test("EU1.C2: Italy default and independent module/territory lock preserved",()=>{
  assert.match(route,/params\.country\|\|"IT"/);
  assert.match(ui,/result\.status==="locked"/);
  assert.match(ui,/result\.status==="unavailable"/);
  assert.doesNotMatch(ui,/service_role|SUPABASE_SERVICE_ROLE_KEY/);
});
