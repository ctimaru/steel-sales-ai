import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const root = new URL("../", import.meta.url);
const read = p => readFileSync(new URL(p,root),"utf8");

test("NETG1 account creation explicitly preserves manual company activation", () => {
  const page=read("app/register/page.tsx");
  assert.match(page,/non attiva automaticamente l&apos;azienda/);
  assert.match(page,/verifica email/);
  assert.match(page,/soggetta a revisione/);
});
test("NETG1 pending company has a status route instead of silent automatic activation", () => {
  const status=read("app/registration/status/page.tsx");
  assert.match(status,/pending_review/);
  assert.match(status,/approved/);
  assert.match(status,/activated/);
  assert.match(status,/Workspace attivato/);
  const form=read("app/register/registration-form.tsx");
  assert.match(form,/saveAndSubmitCompanyRegistration/);
});
test("NETG1 email verification keeps its resend recovery action", () => {
  const verify=read("app/verify-email/actions.ts");
  assert.match(verify,/resend/);
  assert.match(verify,/emailRedirectTo/);
  assert.match(verify,/PENDING_SIGNUP_EMAIL_COOKIE/);
});
