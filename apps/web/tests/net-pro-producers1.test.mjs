import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";

const get=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const route=get("app/(italian)/(workspace)/network/pro/producers/page.tsx");
const experience=get("components/network-producers-experience.tsx");
const catalog=get("components/network-pro-catalog.tsx");
const scope=get("lib/network-pro-coverage.ts");

test("NET-PRO-PRODUCERS1: server data uses existing country-scoped producer entitlement",()=>{
  assert.match(route,/getWorkspaceContext/);
  assert.match(route,/getNetworkProScopedDirectory/);
  assert.match(route,/module:"producers"/);
  assert.match(route,/country,\s*\n\s*q:query/);
  assert.match(route,/isSupportedNetworkCountry/);
  assert.match(scope,/netpro1b_scoped_directory/);
  assert.match(scope,/error\.code==="42501"/);
  assert.doesNotMatch(route,/service_role|SUPABASE_SERVICE_ROLE_KEY/);
});

test("NET-PRO-PRODUCERS1: free/locked view cannot display producer directory rows",()=>{
  assert.match(experience,/result\.status==="locked"/);
  assert.match(experience,/result\.status==="unavailable"/);
  assert.match(experience,/result\.status==="ready"\?result\.data\.items/);
  assert.match(experience,/href="\/network\/pro"/);
  assert.match(catalog,/href="\/network\/pro\/producers"/);
});

test("NET-PRO-PRODUCERS1: comparison never invents manufacturer specifications or catalogs",()=>{
  // Selection now resets by (query,page,country); test the current list, not a stale prior scope.
  assert.match(experience,/ids\.length<3/);
  assert.match(experience,/selection\.scope===selectionScope\?selection\.ids:\[\]/);
  assert.match(experience,/Non disponibile in questa vista/);
  assert.match(experience,/La ricerca tecnica per norma, grado e dimensione/);
  assert.match(experience,/cataloghi tecnici sono qualificazioni distinte/);
  assert.doesNotMatch(experience,/import \{safeNetworkWebsiteUrl\} from "@\/lib\/network-free"/);
  assert.doesNotMatch(experience,/service_role|stripe\.checkout\.sessions\.create/);
});
