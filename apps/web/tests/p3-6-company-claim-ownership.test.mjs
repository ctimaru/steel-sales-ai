import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
const platformIa = fs.readFileSync(new URL("../lib/platform-ia-contract.ts", import.meta.url), "utf8");

const migration = fs.readFileSync(
  new URL("../../../supabase/migrations/20260927190000_p3_6_company_claim_ownership_verification.sql", import.meta.url),
  "utf8",
);
const profile = fs.readFileSync(
  new URL("../app/(workspace)/network/[id]/page.tsx", import.meta.url),
  "utf8",
);
const networkActions = fs.readFileSync(
  new URL("../app/(workspace)/network/actions.ts", import.meta.url),
  "utf8",
);
const platformClaims = fs.readFileSync(
  new URL("../app/(platform)/platform/company-claims/page.tsx", import.meta.url),
  "utf8",
);
const platformClaimActions = fs.readFileSync(
  new URL("../app/(platform)/platform/company-claims/actions.ts", import.meta.url),
  "utf8",
);
const platformNavigation = fs.readFileSync(
  new URL("../components/platform-navigation.tsx", import.meta.url),
  "utf8",
);

test("P3.6 requires verified ownership proof before claim approval", () => {
  assert.match(migration, /proof_status<>'verified'/);
  assert.match(migration, /verified ownership proof required before claim approval/);
  assert.match(migration, /approved company claim requires verified ownership proof/);
  assert.match(migration, /authenticated_corporate_email/);
  assert.match(migration, /email_confirmed_at/);
});

test("P3.6 approved direct claim creates a control link without changing verification", () => {
  assert.match(migration, /add column claim_id uuid/);
  assert.match(migration, /application_id is null and claim_id is not null/);
  assert.match(migration, /organization_network_company_links/);
  assert.match(migration, /set claimed_status='claimed'/);
  assert.match(migration, /verification_status/);
  assert.doesNotMatch(migration, /set verification_status='verified'/);
});

test("P3.6 claim workflow is available to company admins and Platform Superadmin", () => {
  assert.match(networkActions, /p3_6_request_company_claim/);
  assert.match(profile, /Rivendica questo profilo/);
  assert.match(profile, /Ownership verificata/);
  assert.match(platformIa, /appRoutes\.platform\.claims/);
  assert.match(platformClaims, /Company Claims/);
  assert.match(platformClaims, /Approva claim/);
  assert.match(platformClaimActions, /p3_6_review_claim_proof/);
  assert.match(platformClaimActions, /m4_review_company_claim/);
});

test("P3.6 preserves governance-table isolation behind controlled RPCs", () => {
  assert.match(migration, /security invoker/);
  assert.match(migration, /private\.is_platform_superadmin/);
  assert.match(migration, /active organization admin membership required/);
  assert.match(migration, /revoke all on function public\.p3_6_request_company_claim/);
  assert.match(migration, /revoke all on function public\.p3_6_admin_claim_queue/);
});
