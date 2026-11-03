import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import ts from "typescript";

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), "utf8");
const transpile = (source) => ts.transpileModule(source, { compilerOptions: {
  target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext,
}}).outputText;
const feedback = await import("data:text/javascript;base64," +
  Buffer.from(transpile(read("../lib/url-feedback.ts"))).toString("base64"));

const itRegister = read("../app/(italian)/register/page.tsx");
const enRegister = read("../app/(english)/en/register/page.tsx");
const itStatus = read("../app/(italian)/registration/status/page.tsx");
const enStatus = read("../app/(english)/en/registration/status/page.tsx");
const roles = read("../components/public-network-role-explorer.tsx");
const registerActions = read("../app/(italian)/register/actions.ts");

test("F8 keeps the site's own feedback messages unchanged", () => {
  for (const own of [
    "Usa una password di almeno 8 caratteri",
    "Esiste già un account con questa email. Accedi oppure recupera la password.",
    "Durante la fase pilota la registrazione delle aziende è solo su invito. Usa l’indirizzo email indicato nell’invito oppure scrivi a hello@smartsteelsales.com per richiedere l’accesso.",
    "Inserisci una Partita IVA italiana valida (11 cifre).",
    "Non è stato possibile verificare il profilo selezionato. P.IVA ••••1234",
    "Acciai Rossi S.r.l. non è più disponibile per il claim.",
  ]) assert.equal(feedback.safeUrlFeedback(own, "it"), own);
  assert.equal(feedback.safeUrlFeedback("", "it"), null);
  assert.equal(feedback.safeUrlFeedback(undefined, "it"), null);
});

test("F8 replaces crafted messages with links, foreign domains or emails, phone numbers or markup", () => {
  for (const crafted of [
    "Account sospeso: vai su https://evil.example per riattivarlo",
    "Account sospeso: vai su www.smartsteelsales-support.com",
    "Account sospeso: visita assistenza-smartsteel.it",
    "Scrivi a support@evil.com per sbloccare l’account",
    "Chiama subito il +39 02 1234 5678",
    "Chiama 3331234567",
    "<b>Avviso</b>",
    "x".repeat(401),
  ]) {
    assert.equal(
      feedback.safeUrlFeedback(crafted, "it"),
      "Non è stato possibile completare l’operazione. Riprova.",
      crafted.slice(0, 40),
    );
  }
  assert.equal(
    feedback.safeUrlFeedback("Write to support@evil.com", "en"),
    "The operation could not be completed. Please try again.",
  );
});

test("F8 every registration page filters URL feedback before rendering it", () => {
  assert.match(itRegister, /const error = safeUrlFeedback\(rawError, "it"\)/);
  assert.match(itRegister, /const message = safeUrlFeedback\(rawMessage, "it"\)/);
  assert.match(enRegister, /const error = safeUrlFeedback\(rawError, "en"\)/);
  assert.match(enRegister, /const message = safeUrlFeedback\(rawMessage, "en"\)/);
  assert.match(itStatus, /const pageError = safeUrlFeedback\(rawPageError, "it"\)/);
  assert.match(enStatus, /const error = safeUrlFeedback\(rawError, "en"\)/);
});

test("F10 the role picked on the home page preselects the main activity", () => {
  assert.match(roles, /merchant: "trader_distributor"/);
  assert.match(roles, /user: "end_user"/);
  assert.match(roles, /processor: "processor_service_provider"/);
  assert.match(roles, /producer: "producer"/);
  assert.match(roles, /href=\{"\/register\?company_type=" \+ registerCompanyType\[key\]\}/);
  assert.match(itRegister, /PREFERRED_COMPANY_TYPES\.has\(String\(rawCompanyType/);
  assert.match(itRegister, /"\/register\?company_type=" \+ preferredCompanyType/);
  assert.match(itRegister, /preferredCompanyType && !baseInitial\?\.primary_company_type/);
});

test("F5 registration and status pages show a support contact", () => {
  for (const page of [itRegister, enRegister, itStatus, enStatus]) {
    assert.match(page, /data-testid="registration-support-contact"/);
    assert.match(page, /mailto:hello@smartsteelsales\.com/);
  }
  assert.doesNotMatch(registerActions, /contatta il referente/);
});
