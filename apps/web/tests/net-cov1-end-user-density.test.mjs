import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";
const read=p=>readFileSync(new URL(p,import.meta.url),"utf8");
const sql=read("../../../supabase/migrations/20261016203000_netcov1_end_user_core_density.sql");
const ui=read("../app/(platform)/platform/company-discovery/end-users/page.tsx");
const actions=read("../app/(platform)/platform/company-discovery/end-users/actions.ts");
const platform=read("../lib/platform-ia-contract.ts");

test("NET-COV1 stages genuine first-party evidence without publishing",()=>{
 assert.match(sql,/Evidence must come from exact company website domain/);
 assert.match(sql,/network_core_target_leads enable row level security/);
 assert.match(sql,/current_user<>'service_role'/);
 assert.match(sql,/private\.require_platform_permission\('discovery.enrich'\)/);
 assert.match(sql,/published',0/);
 assert.doesNotMatch(sql,/insert into public\.network_companies|insert into public\.network_company_discovery_candidates/);
});
test("NET-COV1 bulk review needs human Platform governance and doesn't grant execution to browser",()=>{
 assert.match(sql,/private\.require_platform_permission\('discovery.governance_review'\)/);
 assert.match(sql,/p_attested/);
 assert.match(sql,/reviewed_by=v_actor/);
 assert.match(sql,/grant execute on function private\.netcov1_stage_core\(text,text,text,text,text,text,text,text\) to service_role/);
 assert.doesNotMatch(sql,/grant execute on function private\.netcov1_stage_core\([^\n]+\) to authenticated/);
 assert.match(sql,/source_url='https:\/\/query.wikidata.org\/sparql'/);
 assert.match(sql,/properly licensed official-site curation source required/);
});
test("NET-COV1 guided Platform acquisition is wired without altering Free or Pro read policies",()=>{
 assert.match(ui,/Densità utilizzatori e commercianti/);
 assert.match(ui,/reviewEndUserTargets/);
 assert.match(ui,/stageEndUserTarget/);
 assert.match(ui,/enqueueEndUserTargets/);
 assert.match(ui,/name="target_ids"/);
 assert.match(actions,/requirePlatformPermission\("discovery.governance_review"\)/);
 assert.match(platform,/\/platform\/company-discovery\/end-users/);
});
