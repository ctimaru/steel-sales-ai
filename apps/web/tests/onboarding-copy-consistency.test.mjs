import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), "utf8");

const itRegister = read("../app/(italian)/register/page.tsx");
const itForm = read("../app/(italian)/register/registration-form.tsx");
const enRegister = read("../app/(english)/en/register/page.tsx");
const enForm = read("../components/english-company-registration-form.tsx");
const onboarding = read("../app/(italian)/onboarding/page.tsx");
const footer = read("../components/public-legal-footer.tsx");

test("registration step labels use one 4-step model, in the page language", () => {
  assert.match(itRegister, /Passo 1 di 4 · Account/);
  assert.match(itRegister, /Passo 2 di 4 · Azienda/);
  assert.doesNotMatch(itRegister, /Step 2 · Azienda/);
  assert.match(enRegister, /Step 1 of 4 · Your account/);
  assert.match(enRegister, /Step 2 of 4 · Company/);
  assert.doesNotMatch(enRegister, /Step 3 — Company application/);
});

test("company form sub-steps read as 2a/2b/2c, not as a second journey", () => {
  for (const badge of ["2a", "2b", "2c"]) assert.ok(itForm.includes(`badge: "${badge}"`));
  assert.match(itForm, /completed \? "✓" : item\.badge/);
  assert.match(enForm, /"2" \+ "abc"\.charAt\(index\)/);
});

test("customer-facing onboarding and legal chrome carry no internal ticket codes", () => {
  assert.doesNotMatch(onboarding, /app-kicker[^>]*>\s*[A-Z]{1,4}\d/);
  assert.doesNotMatch(footer, /Readiness WIP/);
  assert.match(footer, /Documenti legali in versione provvisoria/);
});
