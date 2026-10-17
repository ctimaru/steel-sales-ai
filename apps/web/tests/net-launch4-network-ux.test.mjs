import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read = path => readFileSync(new URL(path, import.meta.url), "utf8");

const pro = read("../app/(workspace)/network/page.tsx");
const free = read("../components/free-network-directory.tsx");
const overview = read("../components/network-discovery-overview.tsx");
const server = read("../lib/network-free.ts");

test("NET-LAUNCH4: account Free and Pro get the same live directory shortcuts", () => {
  assert.match(free, /<NetworkDiscoveryOverview/);
  assert.match(pro, /<NetworkDiscoveryOverview/);
  for(const role of ["producer", "trader_distributor", "processor_service_provider", "end_user"]){
    assert.ok(overview.includes('role: "'+role+'"'));
  }
  assert.match(overview, /Da confermare|da confermare/);
  assert.match(overview, /region \?/);
});
test("NET-LAUNCH4: Pro search precedes discovery cards and map remains after results", () => {
  assert.ok(pro.indexOf('id="network-company-search"') < pro.indexOf('<NetworkLaunchDiscovery'));
  assert.ok(pro.indexOf('<NetworkLaunchDiscovery') < pro.indexOf('<ItalyRegionMap'));
  assert.match(pro, /getProNetworkDiscoveryDirectory\(context\.organizationId/);
});
test("NET-LAUNCH4: do not mistake an RPC outage for zero discovered companies", () => {
  assert.match(server, /discovery_unavailable:true/);
  assert.match(server, /discovery_unavailable:false/);
  assert.match(free, /discoveryUnavailable=\{data\.discovery_unavailable\}/);
  assert.match(pro, /discoveryUnavailable=\{!previewDirectory\}/);
  assert.doesNotMatch(overview, /service_role|supabase\.rpc|fetch\(/);
});
