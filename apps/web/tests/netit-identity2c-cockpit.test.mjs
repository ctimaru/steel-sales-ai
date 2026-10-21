import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const page=readFileSync(new URL("../app/(italian)/(platform)/platform/company-discovery/italian-identities/page.tsx",import.meta.url),"utf8");
const migration=readFileSync(new URL("../../../supabase/migrations/20261020213000_netit_identity2c_review_queue.sql",import.meta.url),"utf8");
test("Platform identity view requires permission, read-only and safe links",()=>{
 assert.match(page,/requirePlatformPermission\("discovery\.read"\)/);
 assert.match(page,/netit_identity2c_review_queue/);
 assert.match(page,/safeNetworkWebsiteUrl\(item\.source_url\)/);
 assert.match(page,/ui-action-secondary/);
 assert.match(page,/legal_identity_verified===false/);
 assert.doesNotMatch(page,/\.from\("netit_identity_link_proposals"\)/);
 assert.match(migration,/private\.require_platform_permission\('discovery\.read'\)/);
 assert.match(migration,/revoke all on function public\.netit_identity2c_review_queue/);
 assert.match(migration,/to authenticated,service_role/);
 assert.doesNotMatch(migration,/\bdelete\s+from\b|\bupdate\s+private\.netfast_discovered_records\b/i);
});
