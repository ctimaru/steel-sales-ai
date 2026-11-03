import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const page=readFileSync(new URL("../app/(italian)/(platform)/platform/company-discovery/italian-identities/page.tsx",import.meta.url),"utf8");
const migration=readFileSync(new URL("../../../supabase/migrations/20261020214000_netit_identity2d1_profile_crosswalk.sql",import.meta.url),"utf8");

test("IDENTITY2D.1 keeps Platform access and optionally opens Company Claims only by permission",()=>{
 assert.match(page,/requirePlatformPermission\("discovery\.read"\)/);
 assert.match(page,/canReadClaims=platformAccess\?\.permissions\?\.includes\("claims\.read"\)===true/);
 assert.match(page,/canReadClaims\?<Link href="\/platform\/company-claims"/);
 assert.doesNotMatch(page,/\.from\("netit_identity_link_proposals"\)/);
});

test("IDENTITY2D.1 exact discovered IDs bridge to Network without claiming ownership",()=>{
 assert.match(migration,/a\.id as entity_a_id/);
 assert.match(migration,/b\.id as entity_b_id/);
 assert.match(migration,/'entity_a_id',entity_a_id,'entity_b_id',entity_b_id/);
 assert.match(page,/UUID\.test\(item\.entity_a_id\)/);
 assert.match(page,/UUID\.test\(item\.entity_b_id\)/);
 assert.match(page,/item\.entity_a_id!==item\.entity_b_id/);
 assert.match(page,/encodeURIComponent\(item\.entity_a_id\)/);
 assert.match(page,/encodeURIComponent\(item\.entity_b_id\)/);
 assert.match(page,/discovered non sono rivendicabili direttamente/);
 assert.doesNotMatch(page,/\/claim\?company=/);
});

test("IDENTITY2D.1 does not relax DB security or mutate identities",()=>{
 assert.match(migration,/private\.require_platform_permission\('discovery\.read'\)/);
 assert.match(migration,/security definer/i);
 assert.match(migration,/set search_path=''/);
 assert.match(migration,/revoke all on function public\.netit_identity2c_review_queue/);
 assert.match(migration,/to authenticated,service_role/);
 assert.doesNotMatch(migration,/\b(update|delete|insert)\s+(into|from)?\s*private\.netfast_discovered_records/i);
 assert.doesNotMatch(migration,/\bupdate\s+public\.network_company_claims/i);
 assert.match(page,/legal_identity_verified===false/);
 assert.match(page,/merge_performed===false/);
 assert.match(page,/safeNetworkWebsiteUrl\(item\.source_url\)/);
});
