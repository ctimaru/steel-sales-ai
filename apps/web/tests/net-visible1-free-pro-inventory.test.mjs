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
test("NET-PROFILE1: both tiers expose unified discovery with profile-first actions",()=>{
 assert.match(banner,/published\+unconfirmed/);
 assert.match(banner,/aziende nel Network/);
 assert.doesNotMatch(banner,/Mostra aziende/);
 assert.match(banner,/network-company-list/);
 assert.match(pro,/<NetworkLaunchDiscovery directory=\{previewDirectory\}/);
 assert.match(free,/<NetworkLaunchDiscovery directory=\{data\}/);
 assert.match(pro,/<section id="network-region-results"/);
 assert.match(free,/<section id="network-region-results"/);
 assert.match(pro,/Esplora azienda/);
 assert.match(free,/Esplora azienda/);
 assert.match(pro,/view:params\.view/);
 assert.match(free,/view\?: string/);
});
