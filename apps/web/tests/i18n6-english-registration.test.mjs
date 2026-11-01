import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const signup = read("../app/login/actions.ts");
const registration = read("../app/register/actions.ts");
const register = read("../app/en/register/page.tsx");
const form = read("../components/english-company-registration-form.tsx");
const lookup = read("../components/public-company-lookup.tsx");
const status = read("../app/en/registration/status/page.tsx");
const verification = read("../app/en/verify-email/page.tsx");
const verifyAction = read("../app/verify-email/actions.ts");
const callback = read("../app/auth/confirm/route.ts");
const login = read("../app/en/login/page.tsx");
const authNext = read("../lib/auth-next.ts");
const handoff = read("../components/english-conversion-handoff.tsx");
const journey = read("../components/registration-journey.tsx");

test("I18N6 English registration retains secure single source of truth for signup, email and company approval", () => {
  assert.match(register, /<PublicCompanyLookup locale="en" context="registration"/);
  assert.match(register, /<form action=\{signup\}/);
  assert.match(register, /<EnglishCompanyRegistrationForm initial=\{initial\} claim=\{activeClaim\}/);
  assert.match(form, /action=\{saveAndSubmitCompanyRegistration\}/);
  assert.match(form, /name="registration_locale" value="en"/);
  assert.match(form, /name="claim_ref" value=\{claim.claim_ref\}/);
  assert.match(signup, /isRegistrationNext\(requestedNext\)/);
  assert.match(signup, /nextPath.startsWith\("\/en\/register"\)/);
  assert.match(signup, /auth\.signUp/);
  assert.match(verifyAction, /supabase\.auth\.resend/);
  assert.match(verifyAction, /nextPath.startsWith\("\/en\/register"\)/);
  assert.match(verification, /action=\{resendSignupConfirmation\}/);
  assert.match(login, /action=\{login\}/);
});

test("I18N6 redirects and ownership preserve claim reference after email verification", () => {
  assert.match(authNext, /path === "\/en\/register"/);
  assert.match(authNext, /path.startsWith\("\/en\/register\?"\)/);
  assert.match(authNext, /path === "\/en\/registration\/status"/);
  assert.match(callback, /safeInternalNext\(/);
  assert.match(callback, /const successUrl = new URL\(next, redirectOrigin\)/);
  assert.match(callback, /new URL\(redirectParam\)\.origin/);
  assert.match(callback, /target\.origin !== canonicalOrigin/);
  assert.match(register, /pa1_4_registration_claim_context/);
  assert.match(register, /pa1_4_company_claim_context/);
  assert.match(register, /can_start_registration !== true/);
  assert.match(registration, /pa1_4_bind_registration_claim/);
  assert.match(registration, /claimContext\.claim_state !== "claimable"/);
  assert.match(lookup, /\/en\/register\?claim_ref=/);
  assert.match(lookup, /\/register\?claim_ref=/);
});

test("I18N6 submitted status reuses owner-protected recovery and human activation controls", () => {
  assert.match(status, /hp12_registration_recovery_state/);
  assert.match(status, /lr5_account_lifecycle_state/);
  assert.match(register, /lr5_account_lifecycle_state/);
  assert.match(register, /email_confirmed_at/);
  assert.match(registration, /lr5_record_legal_acceptance/);
  assert.match(registration, /p0a_submit_registration_application/);
  assert.match(registration, /p0a_submit_registration_application/);
  assert.match(registration, /\.in\("application_status", \["draft", "needs_information"\]\)/);
  assert.match(registration, /root === "\/en\/register" \? "\/en\/registration\/status"/);
  assert.match(status, /recovery.can_reapply === true/);
  assert.match(status, /action=\{restartRejectedRegistration\}/);
  assert.doesNotMatch(register + form + status + verification + login, /supabase\.auth\.admin|service_role|update\(\{\s*status:\s*"activated"/);
});

test("I18N6 English private onboarding stays noindex, transparent, and consented", () => {
  for (const page of [register, login, verification, status]) {
    assert.match(page, /robots: privateNoIndexRobots/);
    assert.match(page, /lang="en"/);
  }
  assert.match(form, /name="privacy_acknowledged"/);
  assert.match(form, /name="terms_accepted"/);
  assert.match(form, /hrefLang="it"/);
  assert.match(journey, /locale = "it"/);
  assert.match(handoff, /href="\/en\/register"/);
  assert.match(handoff, /private workspace and legal documents currently remain in Italian/);
});
