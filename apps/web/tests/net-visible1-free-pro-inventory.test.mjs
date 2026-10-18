import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read = path => readFileSync(new URL(path,import.meta.url),"utf8");
const pro=read("../app/(workspace)/network/page.tsx");
const free=read("../components/free-network-directory.tsx");
const banner=read("../components/network-inventory-bar.tsx");
const lib=read("../lib/network-free.ts");

test("NET-VISIBLE1: tier is entitlement-derived and never selected via query string",()=>{
 assert.match(pro,/if \(!access\.can_access_network\)/);
 assert.match(pro,/<NetworkInventoryBar accessMode="pro"/);
 assert.match(free,/<NetworkInventoryBar accessMode="free"/);
 assert.match(banner,/Assegnata al tuo account aziendale/);
 assert.doesNotMatch(banner,/setAccessMode|window\.location|localStorage|supabase\.rpc/);
});
test("NET-VISIBLE1: canonical Pro default no longer uses the limited technical reader count",()=>{
 assert.match(pro,/getNetworkBrowsePage\(context\.organizationId,"pro","published"/);
 assert.match(pro,/simplePublishedSearch && authoritativePublishedPage/);
 assert.match(pro,/total:authoritativePublishedPage\.total/);
 assert.match(pro,/searchNetwork\(\{/); // advanced technical filters still use M6
 assert.match(pro,/getProNetworkDiscoveryDirectory\(context\.organizationId/);
 assert.match(lib,/getNetworkBrowsePage\(organizationId,"free","unconfirmed"/);
});
test("NET-VISIBLE1: main Network inventory includes provisional companies and filter tabs",()=>{
 assert.match(banner,/published\+unconfirmed/);
 assert.match(banner,/aziende nel Network/);
 assert.match(banner,/Tutte/);
 assert.match(banner,/Da confermare/);
 assert.match(banner,/network-company-list/);
 assert.match(pro,/listingView!=="published" \? <NetworkLaunchDiscovery/);
 assert.match(free,/listingView!=="published" \? <NetworkLaunchDiscovery/);
 assert.match(pro,/listingView!=="unconfirmed" \? <section id="network-region-results"/);
 assert.match(free,/listingView!=="unconfirmed" \? <section id="network-region-results"/);
 assert.match(pro,/view:params\.view/);
 assert.match(free,/view\?: string/);
});
