import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), "utf8");
const helper = read("../lib/auth-next.ts");
const js = ts.transpileModule(helper, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const exports = {};
vm.runInNewContext(js, { exports, URL, encodeURIComponent });

const { safeCommercialReturnTo, registrationEntryForNext, withCommercialReturnTo } = exports;

test("UX1 accepts only local commercial destinations and does not leak query data", () => {
  assert.equal(safeCommercialReturnTo("/rfq-hub/distinta?email=private@example.com#secret"), "/rfq-hub/distinta");
  assert.equal(safeCommercialReturnTo("/commercial/rfqs/abc"), "/commercial/rfqs/abc");
  assert.equal(safeCommercialReturnTo("/distinta"), "/distinta");
  assert.equal(safeCommercialReturnTo("/en/distinta?company=secret"), "/en/distinta");
  assert.equal(safeCommercialReturnTo("/en/network/abc/claim"), "/en/network/abc/claim");
  assert.equal(safeCommercialReturnTo("/en/marketplace/new"), "/en/marketplace/new");
  assert.equal(safeCommercialReturnTo("/en/login"), null);
  assert.equal(safeCommercialReturnTo("/network/example/claim"), "/network/example/claim");
  for (const rejected of ["https://evil.example/steal", "//evil.example", "/login", "/register", "/platform", "/auth/finish", "/\u005cevil.example", "not-a-path", "/rfq-hub-evil", "/" + "x".repeat(520)]) {
    assert.equal(safeCommercialReturnTo(rejected), null, rejected);
  }
});

test("UX1 preserves the commercial destination across IT/EN login-to-registration", () => {
  assert.equal(registrationEntryForNext("/rfq-hub/distinta", "it"), "/register?return_to=%2Frfq-hub%2Fdistinta");
  assert.equal(registrationEntryForNext("/rfq-hub/distinta", "en"), "/en/register?return_to=%2Frfq-hub%2Fdistinta");
  assert.equal(registrationEntryForNext("/en/distinta", "en"), "/en/register?return_to=%2Fen%2Fdistinta");
  assert.equal(registrationEntryForNext("/en/register?claim_ref=abc", "en"), "/en/register?claim_ref=abc");
  assert.equal(registrationEntryForNext("/dashboard", "it"), "/register");
  assert.equal(
    withCommercialReturnTo("/register?claim_ref=abc", "/rfq-hub/distinta"),
    "/register?claim_ref=abc&return_to=%2Frfq-hub%2Fdistinta",
  );
});

test("UX1 registration email and status continuation keep legal and activation gates", () => {
  const login = read("../app/(italian)/login/actions.ts");
  const registerAction = read("../app/(italian)/register/actions.ts");
  const confirm = read("../app/auth/confirm/route.ts");
  const it = read("../app/(italian)/register/page.tsx");
  const en = read("../app/(english)/en/register/page.tsx");
  const status = read("../app/(italian)/registration/status/page.tsx");
  const enStatus = read("../app/(english)/en/registration/status/page.tsx");
  const lookup = read("../components/public-company-lookup.tsx");
  assert.match(login, /registrationEntryForNext/);
  assert.match(login, /safeCommercialReturnTo\(nextPath\)/);
  assert.match(login, /lr5_current_legal_acceptance_state/);
  assert.match(registerAction, /safeCommercialReturnTo\(formData\.get\("return_to"\)\)/);
  assert.match(registerAction, /p0a_submit_registration_application/);
  assert.match(confirm, /verifyOtp/);
  for (const page of [it, en, status, enStatus]) assert.match(page, /safeCommercialReturnTo/);
  assert.match(lookup, /returnTo=\{registrationContext \? returnTo : null\}/);
  assert.match(status, /application\.application_status === "activated" && returnTo/);
  assert.match(enStatus, /application\.status === "activated" && returnTo/);
});

test("UX1 keeps tab-scoped guest Distinta separate from private tenant data", () => {
  const draft = read("../lib/buyer-distinta-session-draft.ts");
  const builder = read("../components/buyer-distinta-builder.tsx");
  assert.match(draft, /PREFIX \+ "guest"/);
  assert.match(draft, /"organization:" \+ cleanOrg \+ ":user:"/);
  assert.match(builder, /window\.sessionStorage/);
  assert.match(builder, /buyerDraftKey\(null\)/);
});
