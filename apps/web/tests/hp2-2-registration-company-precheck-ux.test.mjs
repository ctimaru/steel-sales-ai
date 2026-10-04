import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const register = fs.readFileSync(new URL("../app/register/page.tsx", import.meta.url), "utf8");
const lookup = fs.readFileSync(new URL("../components/public-company-lookup.tsx", import.meta.url), "utf8");
const registrationJourney = fs.readFileSync(
  new URL("../components/registration-journey.tsx", import.meta.url),
  "utf8",
);
const registrationForm = fs.readFileSync(
  new URL("../app/register/registration-form.tsx", import.meta.url),
  "utf8",
);
const registerActions = fs.readFileSync(new URL("../app/register/actions.ts", import.meta.url), "utf8");
const productBrand = fs.readFileSync(new URL("../components/product-brand.tsx", import.meta.url), "utf8");

test("HP2.2 puts the governed company lookup before anonymous account creation", () => {
  assert.match(register, /id="company-check"/);
  assert.match(register, /<PublicCompanyLookup/);
  assert.match(register, /context="registration"/);
  assert.match(register, /notFoundHref="#account"/);
  assert.match(register, /id="account"/);
  assert.match(register, /Prima verifica se la tua azienda è già presente/);
});

test("HP2.2 keeps claimable results on the existing PA1.4 registration handoff", () => {
  assert.match(lookup, /\/register\?claim_ref=/);
  assert.match(register, /registrationPath = claimRef/);
  assert.match(registerActions, /pa1_4_company_claim_context/);
  assert.match(registerActions, /pa1_4_bind_registration_claim/);
  assert.match(registerActions, /p0a_submit_registration_application/);
});

test("HP2.2 gives a not-found company a non-looping path into account creation", () => {
  assert.match(lookup, /notFoundHref/);
  assert.match(lookup, /notFoundLabel/);
  assert.match(register, /notFoundHref="#account"/);
  assert.match(register, /Non è presente: continua con una nuova registrazione/);
});

test("HP2.2 repeats the pre-check after email verification for a fresh unclaimed flow", () => {
  assert.match(register, /!application && !claimRef && !activeClaim/);
  assert.match(register, /notFoundHref="#company-form"/);
  assert.match(register, /id="company-form"/);
});

test("HP2.2 clarifies selected claim state without leaking extra company identity", () => {
  assert.match(register, /Profilo selezionato/);
  assert.match(register, /Claim collegato alla registrazione/);
  assert.match(register, /href="\/register#company-check"/);
  assert.doesNotMatch(register, /claim_target_network_company_id.*legal_name/);
});

test("HP2.2 tightens registration visual hierarchy and contrast", () => {
  assert.match(register, /showDescriptor=\{false\}/);
  assert.match(productBrand, /showDescriptor = true/);
  assert.match(register, /app-secondary inline-flex min-h-10/);
  assert.match(register, /text-\[#5d6a65\]/);
  assert.match(registrationJourney, /bg-\[#e7ece9\] text-\[#52615b\]/);
  assert.match(registrationJourney, /text-\[#5d6a65\]/);
  assert.match(registrationForm, /text-\[#5d6a65\]/);
});

test("HP2.2 keeps the lookup minimal and does not expose Network data", () => {
  assert.match(lookup, /showNetworkNote/);
  assert.doesNotMatch(register + lookup, /private_email|private_phone|relationship_score|commercial_memory/);
});
