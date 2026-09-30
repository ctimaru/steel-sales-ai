import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const onboardingPage = fs.readFileSync(
  new URL("../app/onboarding/page.tsx", import.meta.url),
  "utf8",
);
const onboardingActions = fs.readFileSync(
  new URL("../app/onboarding/actions.ts", import.meta.url),
  "utf8",
);
const registrationDetail = fs.readFileSync(
  new URL("../app/(platform)/platform/registrations/[id]/page.tsx", import.meta.url),
  "utf8",
);
const registrationActions = fs.readFileSync(
  new URL("../app/(workspace)/admin/registrations/actions.ts", import.meta.url),
  "utf8",
);
const migration = fs.readFileSync(
  new URL(
    "../../../supabase/migrations/20260930090000_hp1_1_registration_gate_integrity.sql",
    import.meta.url,
  ),
  "utf8",
);

test("HP1.1 removes self-service Organization creation from onboarding", () => {
  assert.doesNotMatch(onboardingPage, /createOrganization/);
  assert.doesNotMatch(onboardingActions, /create_organization_for_current_user/);
  assert.match(onboardingPage, /redirect\(application \? "\/registration\/status" : "\/register"\)/);
});

test("HP1.1 revokes the legacy tenant-creation RPC from normal users", () => {
  assert.match(
    migration,
    /revoke execute on function public\.create_organization_for_current_user\(text,text,text\)[\s\S]*?from public, anon, authenticated/,
  );
  assert.match(
    migration,
    /revoke execute on function private\.create_organization_for_current_user_impl\(text,text,text\)[\s\S]*?from public, anon, authenticated/,
  );
});

test("HP1.1 enforces one open registration application per applicant", () => {
  assert.match(
    migration,
    /create unique index company_registration_applications_one_open_per_applicant_uidx/,
  );
  for (const status of [
    "draft",
    "submitted",
    "email_verification_pending",
    "pending_review",
    "needs_information",
    "approved",
  ]) {
    assert.match(migration, new RegExp("'" + status + "'"));
  }
});

test("HP1.1 makes activation and Network bridge one atomic database operation", () => {
  assert.match(migration, /hp1_1_activate_registration_application_impl/);
  assert.match(migration, /private\.m7_bridge_registration_impl\(/);
  assert.match(
    migration,
    /identity candidates exist; explicit network company selection required before activation/,
  );
  assert.match(
    migration,
    /selected network company is not an identity candidate for this application/,
  );
  assert.match(
    migration,
    /p0a_activate_registration_application_with_network/,
  );
});

test("HP1.1 Platform activation requires bridge authority and explicit candidate selection", () => {
  assert.match(
    registrationDetail,
    /permissions\.includes\("registrations\.activate"\)[\s\S]*?permissions\.includes\("registrations\.bridge_network"\)/,
  );
  assert.match(
    registrationDetail,
    /canActivate \|\| canBridge[\s\S]*?getRegistrationNetworkCandidates/,
  );
  assert.match(registrationDetail, /Seleziona e attiva/);
  assert.match(registrationDetail, /Attiva workspace e profilo Network/);

  assert.match(
    registrationActions,
    /requirePlatformPermission\("registrations\.activate"\)[\s\S]*?requirePlatformPermission\("registrations\.bridge_network"\)/,
  );
  assert.match(
    registrationActions,
    /p0a_activate_registration_application_with_network/,
  );
});
