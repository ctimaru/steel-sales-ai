import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL(p,import.meta.url),"utf8");
const sql=read("../../../supabase/migrations/20261017230000_netconnect2e_recipient_readiness.sql");
const helper=read("../lib/network-recipient-readiness.ts");
const free=read("../components/free-network-directory.tsx");
const pro=read("../app/(italian)/(workspace)/network/page.tsx");
const profile=read("../components/free-network-profile.tsx");
const send=read("../app/(italian)/(workspace)/network/[id]/connect/page.tsx");
const inbox=read("../app/(italian)/(workspace)/network/connections/page.tsx");
const actions=read("../app/(italian)/(workspace)/network/actions.ts");
const gate=read("../../../.github/workflows/p0-required-gate.yml");
const hp13=read("../../../supabase/tests/hp13_permissions_tenant_isolation.sql");
test("NET-CONNECT2E requires actual ownership, published identity and actor eligibility",()=>{
 assert.match(sql,/private\.netux11_require_active_company\(p_organization_id\)/);
 assert.match(sql,/private\.p4_inquiry_eligibility_impl\(p_organization_id,v_company\)/);
 assert.match(sql,/c\.publication_status='published'/);
 assert.match(sql,/c\.archived_at is null/);
 assert.match(sql,/r\.sender_organization_id=p_organization_id/);
 assert.match(sql,/r\.status='pending'/);
 assert.match(sql,/r\.status='accepted'/);
 assert.match(sql,/array_length\(p_company_ids,1\),0\)>24/);
 assert.doesNotMatch(sql,/insert into public\.|update public\./);
});
test("NET-CONNECT2E defends privacy, authenticated only, fail-closed data",()=>{
 assert.match(sql,/revoke all on function private\.netconnect2e_readiness_impl/);
 assert.match(sql,/revoke all on function public\.netconnect2e_readiness\(uuid,uuid\[\]\) from public,anon/);
 assert.match(helper,/result\.organization_id!==organizationId/);
 assert.match(helper,/network_readiness_incomplete/);
 assert.match(hp13,/'netconnect2e_readiness'/);
 assert.match(hp13,/public\.netconnect2e_readiness/);
 assert.match(gate,/netconnect2e_recipient_readiness\.sql/);
});
test("NET-CONNECT2E shares role-aware discovery but no provisional outreach",()=>{
 for(const view of [free,pro]){
  assert.match(view,/NetworkReadyConnections/);
  assert.match(view,/NetworkReadinessAction/);
  assert.match(view,/getNetworkRecipientReadiness/);
 }
 assert.match(profile,/provisional\?"unavailable"/);
 assert.match(send,/profile\.company\.discovery_status==="unconfirmed"/);
 assert.match(send,/status!=="available"/);
 assert.match(actions,/revalidatePath\("\/network\/start"\)/);
});
test("NET-CONNECT2E prioritizes consentful first response",()=>{
 assert.match(inbox,/sort\(\(a,b\)=>Number\(b\.status==="pending"\)/);
 assert.match(inbox,/getCompanyNetworkGrowth/);
 assert.match(inbox,/decideNetworkConnection/);
 assert.match(inbox,/leggi la proposta prima di rispondere/);
 assert.doesNotMatch(inbox,/followNetworkCompany/);
});
