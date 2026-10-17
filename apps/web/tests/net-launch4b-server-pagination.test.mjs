import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read = path=>readFileSync(new URL(path,import.meta.url),"utf8");
const db=read("../../../supabase/migrations/20261017180000_netlaunch4b_server_browse_paging.sql");
const lib=read("../lib/network-free.ts");
const free=read("../components/free-network-directory.tsx");
const pro=read("../app/(workspace)/network/page.tsx");
const cards=read("../components/network-launch-discovery.tsx");
const nav=read("../components/network-pagination.tsx");
const m6=read("../lib/network.ts");

test("NET-LAUNCH4B: both sources are server paginated after guard evaluation",()=>{
 assert.match(db,/private\.netux11_require_active_company\(p_organization_id\)/);
 assert.match(db,/private\.pa1_3_require_network_access\(p_organization_id\)/);
 assert.match(db,/limit v_limit offset \(v_page-1\)\*v_limit/g);
 assert.match(db,/least\(greatest\(coalesce\(p_limit,18\),1\),24\)/);
 assert.match(db,/v_page>100000/);
 assert.match(db,/revoke all on function public\.netlaunch4b_browse_page/);
 assert.match(db,/from public,anon/);
 assert.match(db,/grant execute on function public\.netlaunch4b_browse_page/);
 assert.match(db,/to authenticated/);
});
test("NET-LAUNCH4B: role relevance ordered globally in SQL, not within a downloaded subset",()=>{
 for (const persona of ["end_user","trader_distributor","producer","processor_service_provider"]) {
  assert.match(db,new RegExp("when '"+persona+"' then array"));
 }
 assert.match(db,/origin='official_company_research'/);
 assert.match(db,/when d\.finished_only then 3/);
 assert.match(db,/role_priority,source_priority,lower\(company_name\),id/);
 assert.match(db,/order by role_priority,lower\(legal_name\),id/);
 assert.match(db,/and nullif\(btrim\(coalesce\(p_region,''\)\),''\) is null/); // no synthetic geography
});
test("NET-LAUNCH4B: Free uses two real page windows and preserves each navigation cursor",()=>{
 assert.match(lib,/getFreeNetworkPagedDirectory/);
 assert.match(lib,/getNetworkBrowsePage\(organizationId,"free","published",rankedFilters\)/);
 assert.match(lib,/getNetworkBrowsePage\(organizationId,"free","unconfirmed"/);
 assert.match(free,/page:parseNetworkPage\(filters\.p\)/);
 assert.match(free,/discoveryPage:parseNetworkPage\(filters\.dpage\)/);
 assert.match(free,/items = data\.published_page\.items/);
 assert.match(free,/pagination=\{data\.discovery_page\}/);
 assert.match(free,/parameter="p" params=\{filters\}/);
});
test("NET-LAUNCH4B: Pro technical search gains offset; provisional search gains dedicated pages",()=>{
 assert.match(pro,/searchNetwork\(\{/);
 assert.match(pro,/page:parseNetworkPage\(params\.p\)/);
 assert.match(pro,/getProNetworkDiscoveryDirectory\(context\.organizationId/);
 assert.match(pro,/page:parseNetworkPage\(params\.dpage\)/);
 assert.match(pro,/pagination=\{previewDirectory\?\.discovery_page\}/);
 assert.match(m6,/p_offset: \(Math\.max/);
 assert.match(m6,/p_limit: 18/);
});
test("NET-LAUNCH4B: server page counts, navigation and unavailable state are explicit",()=>{
 assert.match(nav,/parameter:"p"\|"dpage"/);
 assert.match(nav,/rel="prev"/);
 assert.match(nav,/rel="next"/);
 assert.match(nav,/parseNetworkPage\(params\[other\]\)/);
 assert.match(cards,/<NetworkPagination/);
 assert.match(lib,/discovery_unavailable:!provisional/);
 assert.match(db,/'has_more',v_total::bigint>v_page::bigint\*v_limit::bigint/);
});
