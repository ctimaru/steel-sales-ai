import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const migration = fs.readFileSync(
  new URL(
    "../../../supabase/migrations/20261001115740_hp5_claim_company_profile_experience.sql",
    import.meta.url,
  ),
  "utf8",
);
const claimPage = fs.readFileSync(
  new URL("../app/(workspace)/network/[id]/claim/page.tsx", import.meta.url),
  "utf8",
);
const profilePage = fs.readFileSync(
  new URL("../app/(workspace)/network/[id]/page.tsx", import.meta.url),
  "utf8",
);
const networkActions = fs.readFileSync(
  new URL("../app/(workspace)/network/actions.ts", import.meta.url),
  "utf8",
);
const companyClaims = fs.readFileSync(
  new URL("../lib/company-claims.ts", import.meta.url),
  "utf8",
);
const platformClaims = fs.readFileSync(
  new URL("../app/(platform)/platform/company-claims/page.tsx", import.meta.url),
  "utf8",
);

test("HP5 blocks duplicate active claims for the same organization and company", () => {
  assert.match(
    migration,
    /network_company_claims_one_active_org_company_uidx/,
  );
  assert.match(
    migration,
    /where status in \('requested','under_review','approved'\)/,
  );
});

test("HP5 only auto-verifies corporate email when the company domain is unique", () => {
  assert.match(migration, /v_domain_company_count=1/);
  assert.match(migration, /company_domain_shared/);
  assert.match(migration, /shared_company_domain:/);
  assert.match(migration, /automatic_ownership_proof_available/);
});

test("HP5 exposes a dedicated governed claim preflight", () => {
  assert.match(migration, /hp5_company_claim_experience_impl/);
  assert.match(migration, /claim_is_separate_from_network_verification/);
  assert.match(migration, /security invoker/);
  assert.match(
    migration,
    /revoke all on function public\.hp5_company_claim_experience\(uuid,uuid\)[\s\S]*?from public,anon/,
  );
  assert.match(companyClaims, /getCompanyClaimExperience/);
});

test("HP5 derives Organization from the active workspace instead of trusting form input", () => {
  assert.match(networkActions, /const context = await requireWorkspaceAdmin\(\)/);
  assert.match(networkActions, /p_organization_id: context\.organizationId/);
  assert.doesNotMatch(networkActions, /textValue\(formData, "organization_id"\)/);
  assert.match(networkActions, /authority_confirmed/);
});

test("HP5 routes public profile claim CTA through a guided experience", () => {
  assert.match(profilePage, /\/claim"/);
  assert.match(profilePage, /Rivendica questo profilo/);
  assert.doesNotMatch(profilePage, /form action=\{requestNetworkClaim\}/);
  assert.match(claimPage, /HP5 · Claim Company Profile/);
  assert.match(claimPage, /Step 1 · Ownership proof/);
  assert.match(claimPage, /Step 2 · Conferma richiesta/);
  assert.match(claimPage, /claim.*non equivale.*verifica/is);
});

test("HP5 makes shared-domain evidence visible to Platform review", () => {
  assert.match(platformClaims, /shared_company_domain:/);
  assert.match(platformClaims, /Dominio condiviso:/);
});
