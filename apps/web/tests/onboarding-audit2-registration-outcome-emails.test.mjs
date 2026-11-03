import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import ts from "typescript";

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), "utf8");
const transpile = (source) => ts.transpileModule(source, { compilerOptions: {
  target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext,
}}).outputText;
const toUri = (code) => "data:text/javascript;base64," + Buffer.from(code).toString("base64");

const legalUri = toUri(transpile(read("../lib/legal.ts")));
const siteUri = toUri(transpile(read("../lib/site.ts")));
const email = await import(toUri(
  transpile(read("../lib/registration-outcome-email.ts"))
    .replace('from "@/lib/legal"', `from "${legalUri}"`)
    .replace('from "@/lib/site"', `from "${siteUri}"`),
));

const sender = read("../lib/registration-outcome-email.server.ts");
const actions = read("../app/(italian)/(workspace)/admin/registrations/actions.ts");

function body(name) {
  const start = actions.indexOf(`export async function ${name}(`);
  assert.ok(start >= 0, name + " exists");
  const next = actions.indexOf("export async function", start + 10);
  return actions.slice(start, next < 0 ? undefined : next);
}

test("F2 builds one email per outcome, in Italian and English, with the right call to action", () => {
  for (const [kind, it, en] of [
    ["needs_information", "Serve un aggiornamento", "Update needed"],
    ["rejected", "Esito della richiesta", "Outcome of the"],
    ["activated", "è attivo", "workspace is active"],
  ]) {
    const itMail = email.buildRegistrationOutcomeEmail({ kind, locale: "it", legalName: "Acciai Rossi S.r.l." });
    const enMail = email.buildRegistrationOutcomeEmail({ kind, locale: "en", legalName: "Acme Steel Ltd" });
    assert.ok(itMail.subject.includes(it) && itMail.subject.includes("Acciai Rossi S.r.l."), kind + " IT subject");
    assert.ok(enMail.subject.includes(en) && enMail.subject.includes("Acme Steel Ltd"), kind + " EN subject");
    assert.match(itMail.html, /<html lang="it">/);
    assert.match(enMail.html, /<html lang="en">/);
    assert.ok(itMail.text.includes("hello@smartsteelsales.com"));
  }
  const info = email.buildRegistrationOutcomeEmail({ kind: "needs_information", locale: "it", legalName: "X" });
  assert.match(info.html, /\/login\?next=%2Fregistration%2Fstatus/);
  const infoEn = email.buildRegistrationOutcomeEmail({ kind: "rejected", locale: "en", legalName: "X" });
  assert.match(infoEn.html, /\/en\/login\?next=%2Fen%2Fregistration%2Fstatus/);
  const active = email.buildRegistrationOutcomeEmail({ kind: "activated", locale: "it", legalName: "X" });
  assert.match(active.html, /href="https:\/\/[^"]+\/login"/);
});

test("F2 escapes the company name and carries no review notes", () => {
  const mail = email.buildRegistrationOutcomeEmail({
    kind: "rejected",
    locale: "it",
    legalName: `<script>alert("x")</script> & Figli`,
  });
  assert.doesNotMatch(mail.html, /<script>/);
  assert.match(mail.html, /&lt;script&gt;alert\(&quot;x&quot;\)&lt;\/script&gt; &amp; Figli/);
  const source = read("../lib/registration-outcome-email.ts");
  assert.doesNotMatch(source, /rejection_note|information_request_note|contact_phone|vat_id/);
});

test("F2 chooses the language from the company country and keys each decision once", () => {
  assert.equal(email.outcomeLocale("IT"), "it");
  assert.equal(email.outcomeLocale(" it "), "it");
  assert.equal(email.outcomeLocale("DE"), "en");
  assert.equal(email.outcomeLocale(null), "en");
  const key = email.outcomeIdempotencyKey("app-1", "activated", "2026-11-03T10:00:00Z");
  assert.equal(key, "registration-outcome/app-1/activated/2026-11-03T10:00:00Z");
  assert.ok(email.outcomeIdempotencyKey("a".repeat(300), "rejected", "t").length <= 256);
});

test("F2 sends only when the application is really in the matching state", () => {
  assert.equal(email.outcomeMatchesStatus("activated", "activated"), true);
  assert.equal(email.outcomeMatchesStatus("activated", "approved"), false);
  assert.equal(email.outcomeMatchesStatus("rejected", "pending_review"), false);
  assert.equal(email.outcomeMatchesStatus("needs_information", "needs_information"), true);
});

test("F2 sender is server-only, idempotent, permission-checked and never logs the recipient", () => {
  assert.match(sender, /^import "server-only";/m);
  assert.match(sender, /"Idempotency-Key": outcomeIdempotencyKey\(/);
  assert.match(sender, /rpc\("p0a_admin_registration_detail"/);
  assert.match(sender, /outcomeMatchesStatus\(kind, application\.application_status\)/);
  assert.doesNotMatch(sender, /console\.[a-z]+\([^)]*applicant_email_snapshot/);
  assert.match(sender, /if \(!apiKey\) return \{ sent: false, reason: "not_configured" \}/);
});

test("F2 staff decisions email the applicant only after the decision RPC succeeded", () => {
  for (const [name, rpc, kind] of [
    ["requestRegistrationInformation", "p0a_request_registration_information", "needs_information"],
    ["rejectRegistrationApplication", "p0a_reject_registration_application", "rejected"],
    ["approveAndActivateRegistration", "hp6_approve_and_activate_registration", "activated"],
    ["activateRegistrationApplication", "p0a_activate_registration_application", "activated"],
  ]) {
    const fn = body(name);
    const decided = fn.indexOf(rpc);
    const failed = fn.indexOf("if (error)");
    const send = fn.indexOf(`sendRegistrationOutcomeEmail(id, "${kind}")`);
    assert.ok(decided > 0 && failed > decided && send > failed, name + " sends after the error check");
    assert.match(fn, /outcomeEmailOperatorNote\(emailResult\)/);
  }
  assert.doesNotMatch(body("approveRegistrationApplication"), /sendRegistrationOutcomeEmail/);
});
