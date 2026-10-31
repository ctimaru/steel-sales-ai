import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const root=new URL("../",import.meta.url);
const page=readFileSync(new URL("app/(italian)/(platform)/platform/company-discovery/identity-recovery/page.tsx",root),"utf8");
const parent=readFileSync(new URL("app/(italian)/(platform)/platform/company-discovery/italian-identities/page.tsx",root),"utf8");
const ia=readFileSync(new URL("lib/platform-ia-contract.ts",root),"utf8");
const sql=readFileSync(new URL("../../../supabase/migrations/20261031172700_netgrowth2c1_identity_evidence_queue.sql",import.meta.url),"utf8");
const acceptance=readFileSync(new URL("../../../supabase/tests/netgrowth2c1_identity_evidence_queue.sql",import.meta.url),"utf8");

test("Identity recovery stays Platform-only, bounded and source-linked",()=>{
 assert.match(page,/requirePlatformPermission\("discovery\.read"\)/);
 assert.match(page,/netgrowth2c1_identity_recovery_page/);
 assert.match(page,/p_limit:SIZE/);
 assert.match(page,/const SIZE=25/);
 assert.match(page,/safeNetworkWebsiteUrl\(item\.source_url\)/);
 assert.match(page,/Nessuna fusione o promozione/);
 assert.match(page,/identity_verified_by_this_process===0/);
 assert.match(parent,/company-discovery\/identity-recovery/);
 assert.match(ia,/company-discovery\/identity-recovery/);
 assert.match(sql,/private\.require_platform_permission\('discovery\.read'\)/);
 assert.match(sql,/revoke all on function public\.netgrowth2c1_identity_recovery_page/);
 assert.match(sql,/to authenticated,service_role/);
 assert.match(sql,/alter table private\.netgrowth2c1_identity_evidence enable row level security/);
 assert.match(sql,/before update or delete on private\.netgrowth2c1_identity_evidence/);
 assert.match(acceptance,/Append-only evidence update unexpectedly accepted/);
 assert.doesNotMatch(page,/\.from\("netgrowth2c1_identity_evidence"\)/);
 assert.doesNotMatch(sql,/(?:insert\s+into|update|delete\s+from)\s+public\.network_companies/i);
});
