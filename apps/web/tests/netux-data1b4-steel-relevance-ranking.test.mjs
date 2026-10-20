import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL(p,import.meta.url),"utf8");
const sql=read("../../../supabase/migrations/20261020093000_netux_data1b4_steel_relevance_ranking.sql");
const free=read("../lib/network-free.ts");
const compact=read("../lib/network-compact-directory.ts");
const ui=read("../components/network-compact-experience.tsx");
const live=read("../components/network-live-search.tsx");
const page=read("../app/(italian)/(workspace)/network/page.tsx");
const freePage=read("../components/free-network-directory.tsx");

test("DATA1B.4 enforces existing tenant gates and forbids anon",()=>{
 assert.match(sql,/private\.netux11_require_active_company\(p_organization_id\)/);
 assert.match(sql,/private\.pa1_3_require_network_access\(p_organization_id\)/);
 assert.match(sql,/revoke all on function public\.netdata1b4_steel_relevance_page/);
 assert.match(sql,/grant execute on function public\.netdata1b4_steel_relevance_page[\s\S]*?to authenticated/);
 assert.match(sql,/p_limit>18/);
 assert.match(sql,/p_offset>10000/);
});
test("DATA1B.4 ranks the complete source pool BEFORE SQL pagination",()=>{
 assert.match(sql,/from public\.network_companies c/);
 assert.match(sql,/from private\.netfast_discovered_records d/);
 assert.match(sql,/order by priority,case when review_status='accepted'/);
 assert.match(sql,/limit p_limit offset p_offset/);
 assert.match(sql,/'published',v_published,'discovered',v_total-v_published/);
 assert.match(free,/netdata1b4_steel_relevance_page/);
 assert.match(free,/obj\.total!==obj\.published\+obj\.discovered/);
 assert.match(compact,/const steelMode=filters\.steel==="1"/);
 assert.match(compact,/getNetworkSteelRelevancePage\(organizationId,access/);
 assert.match(compact,/offset,limit:COMPACT_NETWORK_PAGE_SIZE/);
});
test("DATA1B.4 never treats candidate as buyer, supplier or published capability",()=>{
 assert.match(sql,/e\.review_status in \('candidate','accepted'\)/);
 assert.match(sql,/e\.field_key in \('products','services','industry'\)/);
 assert.match(sql,/b\.domain_uses=1/);
 assert.match(sql,/e\.evidence_url ~ '\^https:/);
 assert.match(sql,/candidate_not_verified',true/);
 assert.doesNotMatch(sql,/insert into public\.network_facility_capabilities/i);
 assert.doesNotMatch(sql,/update public\.network_companies/i);
 assert.match(ui,/company\.steel_evidence_status==="candidate"/);
 assert.match(ui,/Da confermare/);
 assert.match(ui,/non attestano acquisti di tubi/);
 assert.match(ui,/steel_source_url/);
});
test("DATA1B.4 uses the same Free/Pro compact page and keeps filters when searching",()=>{
 assert.match(freePage,/steel:filters\.steel/);
 assert.match(page,/steel:params\.steel/);
 assert.match(compact,/!filters\.product && !filters\.capability/);
 assert.match(compact,/!filters\.market && \(!filters\.country/);
 assert.match(ui,/network-steel-ranking-toggle/);
 assert.match(ui,/Priorità acciaio/);
 assert.match(live,/if\(filters\.steel\)query\.set\("steel",filters\.steel\)/);
 assert.match(live,/filters\.country,filters\.steel/);
});
