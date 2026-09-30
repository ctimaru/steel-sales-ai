import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const registerPage = fs.readFileSync(
  new URL("../app/register/page.tsx", import.meta.url),
  "utf8",
);
const registrationForm = fs.readFileSync(
  new URL("../app/register/registration-form.tsx", import.meta.url),
  "utf8",
);
const registrationActions = fs.readFileSync(
  new URL("../app/register/actions.ts", import.meta.url),
  "utf8",
);
const registrationStatus = fs.readFileSync(
  new URL("../app/registration/status/page.tsx", import.meta.url),
  "utf8",
);
const loginPage = fs.readFileSync(
  new URL("../app/login/page.tsx", import.meta.url),
  "utf8",
);
const loginActions = fs.readFileSync(
  new URL("../app/login/actions.ts", import.meta.url),
  "utf8",
);
const authFinish = fs.readFileSync(
  new URL("../app/auth/finish/page.tsx", import.meta.url),
  "utf8",
);
const journey = fs.readFileSync(
  new URL("../components/registration-journey.tsx", import.meta.url),
  "utf8",
);

test("HP2 uses one macro registration journey across the applicant flow", () => {
  for (const label of ["Account", "Azienda", "Revisione", "Attivazione"]) {
    assert.match(journey, new RegExp(label));
  }

  assert.match(registerPage, /RegistrationJourney current=\{1\}/);
  assert.match(registerPage, /RegistrationJourney current=\{2\}/);
  assert.match(registrationStatus, /RegistrationJourney current=\{copy\.journeyStep\}/);
  assert.doesNotMatch(registerPage, /Passaggio 1 di 2/);
});

test("HP2 simplifies the company form and validates each visible step", () => {
  assert.match(registrationForm, /Azienda/);
  assert.match(registrationForm, /Attività e referente/);
  assert.match(registrationForm, /Controlla e invia/);
  assert.doesNotMatch(registrationForm, /Tipo di attività[\s\S]*Contatti[\s\S]*Conferma/);

  assert.match(registrationForm, /validateCurrentStep/);
  assert.match(registrationForm, /checkValidity\(\)/);
  assert.match(registrationForm, /reportValidity\(\)/);
  assert.match(registrationForm, /required=\{step === 1\}/);
  assert.match(registrationForm, /required=\{step === 2\}/);
  assert.match(registrationForm, /handleSubmit/);
});

test("HP2 keeps the registration surface forest-neutral instead of legacy steel blue", () => {
  for (const source of [registerPage, loginPage, registrationStatus, authFinish]) {
    assert.doesNotMatch(source, /#2f6fed|#245ed1|#eef5ff|#f8fbff/);
  }

  assert.match(registerPage, /#123d34/);
  assert.match(loginPage, /#123d34/);
  assert.match(registrationStatus, /#edf5f2/);
});

test("HP2 registration exit performs a real sign-out", () => {
  assert.match(registrationActions, /export async function logoutRegistration/);
  assert.match(registrationActions, /supabase\.auth\.signOut\(\)/);
  assert.match(registerPage, /action=\{logoutRegistration\}/);
  assert.match(registrationStatus, /action=\{logoutRegistration\}/);
});

test("HP2 maps signup failures to human-safe copy", () => {
  assert.match(loginActions, /function signupErrorMessage/);
  assert.match(loginActions, /Esiste già un account con questa email/);
  assert.match(loginActions, /Non è stato possibile creare l’account/);
  assert.doesNotMatch(
    loginActions,
    /redirect\(\x60\/register\?error=\$\{encodeURIComponent\(error\.message\)\}\x60\)/,
  );
});

test("HP2 applicant status uses human labels rather than rendering raw state values", () => {
  assert.match(registrationStatus, /label: "In revisione"/);
  assert.match(registrationStatus, /label: "Approvata"/);
  assert.match(registrationStatus, /label: "Attivata"/);
  assert.match(registrationStatus, /\{copy\.label\}/);
  assert.doesNotMatch(
    registrationStatus,
    />\{application\.application_status\}</,
  );
});
