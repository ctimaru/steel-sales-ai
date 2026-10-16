import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
const read = (path) => fs.readFileSync(new URL(path, import.meta.url), "utf8");
const sql = read("../../../supabase/migrations/20261016180000_netux3b_controlled_geo_evidence.sql");
const publisher = read("../../../supabase/migrations/20261016181000_netux3b_reviewed_publication_istat_guard.sql");
const page = read("../app/(platform)/platform/company-discovery/geo-review/page.tsx");
const actions = read("../app/(platform)/platform/company-discovery/geo-review/actions.ts");
test("NET-UX3B requires published company + its official site + province + unique ISTAT", () => {
 assert.match(sql,/publication_status='published'/);
 assert.match(sql,/Source host must match active Network company website/);
 assert.match(sql,/p_evidence_snippet !~\*/);
 assert.match(sql,/municipality_normalized=lower/);
 assert.match(sql,/v_count<>1/);
 assert.match(sql,/m.region_name,m.istat_code/);
 assert.match(sql,/facility_published',false/);
 assert.doesNotMatch(sql,/insert into public\.network_facilities|update public\.network_facilities/);
});
test("NET-UX3B service import never grants review or publication", () => {
 assert.match(sql,/grant execute on function public\.netux3b_stage_screened_official_geo\(uuid,uuid,text,text,text,text\) to service_role/);
 assert.match(sql,/revoke all on function public\.netux3b_stage_screened_official_geo\(uuid,uuid,text,text,text,text\) from public,anon,authenticated/);
 assert.match(sql,/private\.require_platform_permission\('discovery.enrich'\)/);
 assert.match(sql,/language sql security invoker/);
 assert.match(sql,/network_it_geo_collection_batches enable row level security/);
 assert.match(sql,/revoke all on public\.network_it_geo_collection_batches from public,anon,authenticated/);
});
test("NET-UX3B publication still demands independent human review and current ISTAT", () => {
 assert.match(publisher,/create or replace function private\.netux3_publish_reviewed_geo_impl/);
 assert.match(publisher,/private\.require_platform_permission\('discovery.publish'\)/);
 assert.match(publisher,/private\.require_platform_permission\('discovery.governance_review'\)/);
 assert.match(publisher,/v.reviewed_by is null or v.reviewed_at is null/);
 assert.match(publisher,/private\.netux3b_check_istat_before_publish\(p_evidence_id\)/);
 assert.match(publisher,/'published','unverified'/);
});
test("NET-UX3B adds a city/province first-party evidence operator flow", () => {
 assert.match(page,/stageOfficialGeoWithIstat/);
 assert.match(page,/stageOfficialGeoEvidence/);
 assert.match(page,/Inserimento manuale precedente/);
 assert.match(page,/non pubblica/);
 assert.match(actions,/netux3b_operator_stage_geo/);
 assert.match(actions,/await requirePlatformPermission\("discovery.enrich"\)/);
});