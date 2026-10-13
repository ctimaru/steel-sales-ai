import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const boundaries = read("../lib/review-boundaries.ts");
const platformReview = read("../app/(italian)/(platform)/platform/review/page.tsx");
const platformLayout = read("../app/(italian)/(platform)/platform/layout.tsx");
const platformIa = read("../lib/platform-ia-contract.ts");
const routes = read("../lib/routes.ts");
const companyReview = read("../app/(italian)/(workspace)/review/page.tsx");
const companyLayout = read("../app/(italian)/(workspace)/operations/review/layout.tsx");
const companyActions = read("../app/(italian)/(workspace)/review/actions.ts");
const menu = read("../components/workspace-navigation.tsx");
const dashboard = read("../app/(italian)/(workspace)/dashboard/page.tsx");

test("RQG2 separates Platform governance from private Company Review with independent layouts", () => {
  assert.match(platformReview, /await requirePlatformConsoleContext\(\)/);
  assert.match(platformLayout, /await requirePlatformConsoleContext\(\)/);
  assert.match(companyLayout, /await requireWorkspaceAdmin\(\)/);
  assert.match(companyActions, /await requireWorkspaceAdmin\(\)/);
  assert.doesNotMatch(platformReview + boundaries, /getReviewItems\(|from\("commercial_review_queue"\)|\.rpc\(/);
  assert.doesNotMatch(platformReview, /requireWorkspaceAdmin|organizationId|supabase/);
  assert.match(boundaries, /includesTenantCommercialReview: false/);
});

test("RQG2 only exposes authorized Platform domain links, and no direct decision API", () => {
  assert.match(boundaries, /permissions\.includes\(lane\.readPermission\)/);
  assert.match(platformReview, /visiblePlatformReviewLanes\(context\.permissions\)/);
  assert.match(platformReview, /allowedPlatformReviewDecisions\(lane, context\.permissions\)/);
  for (const permission of ["registrations.read", "claims.read", "discovery.read", "network_trust.read", "knowledge.read_drafts"]) {
    assert.ok(boundaries.includes(permission), permission);
  }
  assert.match(platformIa, /key: "review", href: appRoutes\.platform\.review/);
  assert.match(platformIa, /\{ path: "\/platform\/review", module: "review" \}/);
  assert.match(routes, /review: "\/platform\/review"/);
});

test("RQG2 Company Review is explicitly scoped, accessible only to company admins, not buyer dashboard", () => {
  assert.match(boundaries, /owner: "active_organization"/);
  assert.match(boundaries, /reviewer: "active_organization_admin"/);
  assert.match(companyReview, /Qualità dati aziendali/);
  assert.match(companyReview, /requireWorkspaceAdmin\(\)/);
  assert.match(companyReview, /getReviewItems\(\)/);
  assert.match(menu, /appRoutes\.operations\.review.*label="Qualità dati aziendali"/);
  assert.doesNotMatch(dashboard, /<Link href=\{appRoutes\.operations\.review\}/);
});
