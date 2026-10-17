import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL(p,import.meta.url),"utf8");
const sql=read("../../../supabase/migrations/20261017220000_netconnect2d_company_progress.sql");
const helper=read("../lib/network-company-growth.ts");
const page=read("../app/(italian)/(workspace)/network/start/page.tsx");
const free=read("../components/free-network-directory.tsx");
const paid=read("../app/(italian)/(workspace)/network/page.tsx");
const routes=read("../lib/routes.ts");
const gate=read("../../../.github/workflows/p0-required-gate.yml");
const hp13=read("../../../supabase/tests/hp13_permissions_tenant_isolation.sql");

test("NET-CONNECT2D uses real, separate claim, request and acceptance records",()=>{
 assert.match(sql,/cl\.status='approved'/);
 assert.match(sql,/l\.link_status='active'/);
 assert.match(sql,/c\.publication_status='published'/);
 assert.match(sql,/r\.status='accepted'/);
 assert.match(sql,/claim_requests_pending/);
 assert.match(sql,/requests_received_pending/);
 assert.match(page,/Profilo pubblicato con claim approvato/);
 assert.match(page,/conteggi non sono mostrati come zero/);
 assert.doesNotMatch(sql,/insert into public\.|update public\./);
});
test("NET-CONNECT2D limits reporting to active tenant membership",()=>{
 assert.match(sql,/m\.organization_id=p_organization_id/);
 assert.match(sql,/m\.user_id=\(select auth\.uid\(\)\)/);
 assert.match(sql,/m\.status='active'/);
 assert.match(sql,/revoke all on function private\.netconnect2d_company_progress_impl\(uuid\)/);
 assert.match(sql,/revoke all on function public\.netconnect2d_company_progress\(uuid\) from public,anon/);
 assert.match(helper,/result\.organization_id!==organizationId/);
 assert.match(hp13,/public\.netconnect2d_company_progress/);
 assert.match(gate,/netconnect2d_company_progress\.sql/);
});
test("NET-CONNECT2D exposes admin management, meaningful B2B discovery and no auto-outreach",()=>{
 assert.match(page,/const admin=actor\.role==="admin"/);
 assert.match(page,/admin\?getManagedNetworkCompany\(\)/);
 assert.match(page,/getManagedNetworkProfileState/);
 assert.match(page,/getInquiryPreferences/);
 assert.match(page,/canInteractWithNetwork/);
 assert.match(page,/getFreeNetworkViewerRole/);
 assert.match(page,/quando la controparte accetta/);
 assert.match(routes,/start: "\/network\/start"/);
 assert.match(free,/NetworkCompanyGrowthEntry/);
 assert.match(paid,/NetworkCompanyGrowthEntry/);
 assert.doesNotMatch(page,/followCompany|automaticallyClaim|sendBulkInvitation/);
});
