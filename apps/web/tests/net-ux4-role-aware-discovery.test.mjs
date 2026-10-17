import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const source=(p)=>readFileSync(new URL(p,import.meta.url),"utf8");
const free=source("../components/free-network-directory.tsx");
const pro=source("../app/(workspace)/network/page.tsx");
const persona=source("../lib/network-role-discovery.ts");
const component=source("../components/network-role-discovery.tsx");
const map=source("../components/italy-region-map.tsx");
const service=source("../lib/network-free.ts");

test("role-aware persona is presentation-only and does not grant access",()=>{
 assert.match(persona,/UI-only persona/);
 assert.match(persona,/q\.delete\("role"\)/);
 assert.match(persona,/validNetworkPersona/);
 assert.match(persona,/recommendedNetworkRoles/);
 assert.doesNotMatch(persona,/network_entitlement|grant |supabase\.from|auth\.uid/);
 assert.match(component,/non cambia la classificazione della tua azienda/);
 assert.match(component,/distingue profili pubblicati da aziende scoperte da confermare/);
});
test("both Free and Pro apply guided discovery while keeping server guards",()=>{
 assert.match(free,/NetworkRoleDiscovery/);
 assert.match(free,/items = data\.published_page\.items/);
 assert.match(service,/getFreeNetworkPagedDirectory/);
 assert.match(pro,/NetworkRoleDiscovery/);
 assert.match(pro,/getFreeNetworkViewerRole\(context\.organizationId\)/);
 assert.match(pro,/orderNetworkDiscovery\(results\.items, persona, Boolean\(params\.q \|\| hasAdvancedFilters\)\)/);
 assert.match(pro,/orderedResults\.map/);
 assert.match(service,/netux11_free_directory/);
 assert.match(service,/p_limit:1/);
});
test("persona survives Free and Pro searches and regional map selection",()=>{
 assert.match(free,/name="persona" type="hidden"/);
 assert.match(pro,/name="persona" value=\{params\.persona\}/);
 assert.match(map,/"persona"/);
 assert.match(persona,/key === "persona"/);
 assert.match(persona,/networkDiscoveryHref/);
});
test("commercial counterpart role priorities remain transparent and nonexclusive",()=>{
 assert.match(component,/NETWORK_COMPANY_ROLES\.map/);
 assert.match(component,/priority\.map/);
 assert.match(component,/Tutta la filiera/);
 assert.match(component,/Sono un utilizzatore/);
 assert.match(component,/Sono un commerciante/);
});
