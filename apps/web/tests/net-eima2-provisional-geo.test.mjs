import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = path => readFileSync(new URL(path, import.meta.url),"utf8");
const sql = read("../../../supabase/migrations/20261017193000_net_eima2_provisional_geo_map.sql");
const map = read("../components/italy-region-map.tsx");
const compact = read("../components/network-resilient-first-screen.tsx");
const free = read("../components/free-network-directory.tsx");
const pro = read("../app/(italian)/(workspace)/network/page.tsx");
const profile = read("../components/network-launch-discovery.tsx");
test("NET-EIMA2: provisional geo staging uses first-party source + current ISTAT municipality",()=>{
 assert.match(sql,/current_user<>'service_role'/);
 assert.match(sql,/v_host<>t\.canonical_domain/);
 assert.match(sql,/municipality_normalized/);
 assert.match(sql,/is_current/);
 assert.match(sql,/Source must explicitly mention province/);
 assert.match(sql,/network_neteima2_provisional_geo_client_deny|neteima2_provisional_geo_client_deny/);
 assert.doesNotMatch(sql,/update public\.network_companies/);
 assert.doesNotMatch(sql,/insert into public\.network_facilities/);
});
test("NET-EIMA2: geographic observations are explicitly unverified and gated by existing access",()=>{
 assert.match(sql,/sourced_unverified/);
 assert.match(sql,/private\.netux11_require_active_company/);
 assert.match(sql,/private\.pa1_3_require_network_access/);
 assert.match(sql,/private\.netfast_discovered_records/);
 assert.match(sql,/lower\(g\.region\)=lower\(btrim\(p_region\)\)/);
 assert.match(sql,/grant execute on function public\.neteima2_region_coverage\(uuid,text\) to authenticated/);
});
test("NET-EIMA2: maps keep published and provisional counts separate for Free and Pro",()=>{
 assert.match(map,/provisionalRegionCount/);
 assert.match(map,/Da confermare/);
 assert.match(map,/#e6cb85/);
 assert.match(compact,/provisionalRegionCount/);
 assert.match(free,/getItalyProvisionalGeoCoverage\(organizationId,"free"\)/);
 assert.match(pro,/getItalyProvisionalGeoCoverage\(context\.organizationId,"pro"\)/);
 assert.match(profile,/Sede indicata, da confermare/);
});