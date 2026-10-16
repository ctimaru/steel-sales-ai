import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const read=(p)=>readFileSync(new URL(p,import.meta.url),"utf8");
const page=read("../app/(workspace)/network/page.tsx");
const detail=read("../app/(workspace)/network/[id]/page.tsx");
const directory=read("../components/free-network-directory.tsx");
const feed=read("../components/network-launch-discovery.tsx");

test("NET-LAUNCH1: Pro Network users see same unconfirmed Free discoveries",()=>{
 assert.match(page,/getFreeNetworkDirectory\(context\.organizationId/);
 assert.match(page,/<NetworkLaunchDiscovery directory=\{previewDirectory\}/);
 assert.ok(page.indexOf("<NetworkLaunchDiscovery")<page.indexOf("<ItalyRegionMap"),"Show discovery before map");
 assert.match(page,/searchNetwork\(\{/,"Keep canonical Pro search intact");
});
test("NET-LAUNCH1: Pro users can open unconfirmed profiles rather than 404",()=>{
 assert.match(detail,/getFreeNetworkProfile\(context\.organizationId,id\)/);
 assert.match(detail,/candidate\?\.item\.discovery_status === "unconfirmed"/);
 assert.match(detail,/return <FreeNetworkProfileView/);
 assert.match(detail,/await requireNetworkAccess\(\)/,"Keep existing Pro permission");
});
test("NET-LAUNCH1: Free users see discoveries first and map after company results",()=>{
 assert.match(directory,/NetworkLaunchDiscovery directory=\{data\}/);
 assert.ok(directory.indexOf("<NetworkLaunchDiscovery") < directory.indexOf('id="network-region-results"'));
 assert.ok(directory.indexOf("<ItalyRegionMap") > directory.indexOf('id="network-region-results"'));
 assert.match(directory,/aziende scoperte · da confermare/);
});
test("NET-LAUNCH1: cards never assert discovery is verified business",()=>{
 assert.match(feed,/Da confermare/);
 assert.match(feed,/clienti confermati né fornitori qualificati/);
 assert.match(feed,/company\.discovery_status==="unconfirmed"/);
 assert.doesNotMatch(feed,/service_role|supabase\.rpc\(/,"Presentation only, reuse existing RLS gate");
});
