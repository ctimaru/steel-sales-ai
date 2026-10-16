import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";
const read=p=>readFileSync(new URL(p,import.meta.url),"utf8");
const sql=read("../../../supabase/migrations/20261016210000_netcov2_campaign_batch_acquisition.sql");
const actions=read("../app/(platform)/platform/company-discovery/end-users/actions.ts");
const ui=read("../app/(platform)/platform/company-discovery/end-users/page.tsx");

test("NET-COV2 campaign import preserves role permissions, batch limit and NET-COV1 dedupe",()=>{
 assert.match(sql,/private\.require_platform_permission\('discovery.enrich'\)/);
 assert.match(sql,/auth\.uid\(\) is null/);
 assert.match(sql,/jsonb_array_length\(p_items\) not between 1 and 40/);
 assert.match(sql,/private\.netcov1_stage_core\(/);
 assert.match(sql,/published_companies',0/);
 assert.match(sql,/crawler_runs',0/);
 assert.doesNotMatch(sql,/insert into public\.network_companies|insert into public\.network_company_discovery_candidates/);
 assert.match(sql,/public\.netcov2_operator_batch_stage\([\s\S]+?language sql security invoker/);
});
test("NET-COV2 Platform spreadsheet intake only stages official-site leads and displays campaign metrics",()=>{
 assert.match(actions,/export async function stageIndustrialCampaign/);
 assert.match(actions,/requirePlatformPermission\("discovery.enrich"\)/);
 assert.match(actions,/netcov2_operator_batch_stage/);
 assert.match(actions,/row\.split\("\\t"\)/);
 assert.match(ui,/stageIndustrialCampaign/);
 assert.match(ui,/netcov2_campaign_metrics/);
 assert.match(ui,/Importazione da Excel/);
 assert.match(ui,/Nessuna scansione|nessun crawler|nessuna azienda/i);
});
