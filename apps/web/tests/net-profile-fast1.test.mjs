import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,existsSync} from "node:fs";

const read=path=>readFileSync(new URL(path,import.meta.url),"utf8");
const page=read("../app/(italian)/(workspace)/network/[id]/page.tsx");
const free=read("../components/free-network-profile.tsx");
const access=read("../lib/network-access.ts");
const loading=read("../app/(italian)/(workspace)/network/[id]/loading.tsx");

test("NET-PROFILE-FAST1 access state is memoized per request",()=>{
  assert.match(access,/export const getNetworkAccessState = cache\(async function getNetworkAccessState\(/);
  assert.match(access,/import \{ cache \} from "react";/);
});

test("NET-PROFILE-FAST1 Pro profile: one parallel batch, viewer from the workspace context",()=>{
  assert.doesNotMatch(page,/auth\.getUser\(\)|from\("organization_memberships"\)|createClient/);
  assert.match(page,/const \[candidateResult, profileResult, claimResult, eligibility, savedResult, inventoryResult, reviewedEvidence, officialProductPages, query, vatId\] = await Promise\.all\(\[/);
  assert.match(page,/getNetworkProducerOfficialPages\(context\.organizationId, id, "pro"\)/);
  assert.match(page,/if \(!COMPANY_ID\.test\(id\)\) notFound\(\);/);
  // Discoveries still open in the Free reader, reusing the profile already read.
  assert.match(page,/candidateResult\?\.company\.discovery_status === "unconfirmed"/);
  assert.match(page,/preloadedProfile=\{candidateResult\}/);
  // Loaders that used to throw still throw when their value is needed.
  assert.match(page,/const profile = unwrap\(profileResult\);/);
  assert.match(page,/const publishedInventory = unwrap\(inventoryResult\);/);
  assert.match(page,/const isSaved = unwrap\(savedResult\)\.includes\(profile\.company\.id\);/);
});

test("NET-PROFILE-FAST1 discovery profile: no second read, remaining reads in parallel",()=>{
  assert.match(free,/profile = preloadedProfile \? preloadedProfile :/);
  assert.match(free,/const \[reviewedEvidence, officialProductPages, readiness, savedIds, inventory, vatId\] = await Promise\.all\(\[/);
  assert.match(free,/getNetworkProducerOfficialPages\(organizationId,companyId,accessMode\)/);
});

test("NET-PROFILE-FAST1 instant profile-shaped skeleton; sub-pages keep a generic loader",()=>{
  assert.match(loading,/data-testid="network-profile-loading"/);
  assert.match(loading,/<NetworkProfileTopBar \/>/);
  assert.match(loading,/motion-safe:animate-pulse/);
  for(const sub of ["connect","claim","inquiry"])
    assert.ok(existsSync(new URL("../app/(italian)/(workspace)/network/[id]/"+sub+"/loading.tsx",import.meta.url)),sub);
});
