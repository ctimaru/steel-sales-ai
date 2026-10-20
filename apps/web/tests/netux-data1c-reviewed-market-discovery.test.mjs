import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL(p,import.meta.url),"utf8");
const sql=read("../../../supabase/migrations/20261019190000_netdata1c_market_evidence_and_discovery.sql");
const filters=read("../lib/network-compact-directory.ts");
const free=read("../lib/network-free.ts");
const ui=read("../components/network-compact-experience.tsx");
const platform=read("../app/(italian)/(platform)/platform/company-discovery/market-review/page.tsx");
const actions=read("../app/(italian)/(platform)/platform/company-discovery/market-review/actions.ts");

test("DATA1C keeps market evidence private and explicitly unverified",()=>{
 assert.match(sql,/create table if not exists private\.network_market_source_evidence/);
 assert.match(sql,/enable row level security/);
 assert.match(sql,/review_status text not null default 'candidate'/);
 assert.match(sql,/unique\(lead_id,market_id,source_url\)/);
 assert.match(sql,/on conflict\(lead_id,market_id,source_url\) do nothing/);
 assert.match(sql,/candidate_not_verified',true/);
 assert.match(sql,/source_url.*summary/);
 assert.doesNotMatch(sql,/network_company_verification|verification_status='verified'/);
});
test("DATA1C has separate service-only ingestion, human review and Free/Pro tenant gates",()=>{
 assert.match(sql,/current_setting\('role',true\) is distinct from 'service_role'/);
 assert.match(sql,/private\.require_platform_permission\('discovery.enrich'\)/);
 assert.match(sql,/private\.require_platform_permission\('discovery.read'\)/);
 assert.match(sql,/private\.netux11_require_active_company\(p_organization_id\)/);
 assert.match(sql,/private\.pa1_3_require_network_access\(p_organization_id\)/);
 assert.match(sql,/revoke all on function public\.netdata1c_market_discovery_page/);
 assert.match(sql,/e\.review_status in \('candidate','accepted'\)/);
 assert.match(sql,/m\.canonical_key=p_market/);
 assert.match(sql,/v_host <> v_domain/);
});
test("DATA1C seven industry candidates are editorial claims with original corporate source URLs",()=>{
 const domains=["fincantieri.com","ansaldoenergia.com","cimolai.com","webuildgroup.com","sacmi.com","global.aermec.com","corporate.carel.com"];
 for(const name of domains)assert.ok(sql.includes("'"+name+"'"),name);
 for(const market of ["'marine'","'energy'","'hvac'","'construction_infrastructure'","'mechanical_engineering_market'"]){
  assert.match(sql,new RegExp(market));
 }
 assert.match(sql,/'candidate'[^]*?on conflict\(lead_id,market_id,source_url\) do nothing/);
});
test("DATA1C market-only search mixes paged published and reviewed-source discovered",()=>{
 assert.match(filters,/const sectorSearch=Boolean\(filters\.market/);
 assert.match(filters,/await getNetworkBrowsePage\(organizationId,access,"published"/);
 assert.match(filters,/getNetworkDiscoveredMarketPage\(organizationId,access/);
 assert.match(filters,/compactSourceWindows\(offset,COMPACT_NETWORK_PAGE_SIZE,publishedCount,discoveredCount\)/);
 assert.match(filters,/provisionalTake>0 && discoveredFirst/);
 assert.match(filters,/marketEvidence:true/);
 assert.match(filters,/filters\.market && !filters\.product && !filters\.capability/);
 assert.match(free,/p_organization_id:organizationId,p_access:access,p_market:filters.market/);
 assert.match(free,/candidate_not_verified/);
 assert.match(filters,/technicalOnly:true/);
});
test("DATA1C says sector indicator, never validated tube buyer or production capabilities",()=>{
 assert.match(ui,/company\.market_evidence_status==="accepted"/);
 assert.match(ui,/settore indicativo/);
 assert.match(ui,/Fonte ↗/);
 assert.match(ui,/azienda verificata, acquirente confermato o capacità produttiva certificata/);
 assert.match(ui,/aria-label=\{"Fonte del settore per "\+name\}/);
 assert.doesNotMatch(ui,/automaticallyAcceptMarkets/);
});
test("DATA1C platform review requires permission and stays distinct from company claim",()=>{
 assert.match(platform,/requirePlatformPermission\("discovery.read"\)/);
 assert.match(actions,/const route="\/platform\/company-discovery\/market-review"/);
 assert.match(platform,/Approva settore documentato/);
 assert.match(platform,/Rifiuta evidenza/);
 assert.match(actions,/requirePlatformPermission\("discovery.enrich"\)/);
 assert.match(actions,/netdata1c_review_market/);
 assert.doesNotMatch(actions,/publishCompany|approveClaim|verifyCompany/);
});
