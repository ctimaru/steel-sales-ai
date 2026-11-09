import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const compiled = ts.transpileModule(read("../lib/rfqc1-supplier-suggestions.ts"), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { rankSupplierSuggestions } = await import("data:text/javascript;base64," + Buffer.from(compiled).toString("base64"));

const c = (key, source, extra = {}) => ({
  identity_key: key, source, company_name: key, email: key + "@x.it", preferred: false, last_used_at: null, ...extra,
});
const none = { emails: [], names: [] };

test("Chat RFQ passo 2: preferiti, poi già usati, contatti privati, Network, piattaforma", () => {
  const out = rankSupplierSuggestions([
    c("net", "network_company"), c("plat", "platform_organization"), c("priv", "private_contact"),
    c("rec", "recent"), c("pref", "network_company", { preferred: true }),
  ], none);
  assert.deepEqual(out.map((s) => s.candidate.identity_key), ["pref", "rec", "priv", "net", "plat"]);
  assert.equal(out[0].reason, "Fornitore preferito");
  assert.equal(out[1].reason, "Già usato in precedenti richieste");
});

test("Chat RFQ passo 2: esclude i fornitori già presenti (email o nome) e i duplicati", () => {
  const out = rankSupplierSuggestions([
    c("a", "recent"), c("b", "recent", { email: "B@x.it" }), c("a", "recent"), c("d", "recent", { company_name: "Rossi Tubi" }),
  ], { emails: ["b@X.it"], names: ["rossi tubi"] });
  assert.deepEqual(out.map((s) => s.candidate.identity_key), ["a"]);
});

test("Chat RFQ passo 2: scarta chi non ha un canale utilizzabile e rispetta il limite", () => {
  const out = rankSupplierSuggestions([
    c("noemail", "private_contact", { email: null }),
    ...Array.from({ length: 10 }, (_, i) => c("n" + i, "network_company")),
  ], none, 3);
  assert.equal(out.length, 3);
  assert.ok(out.every((s) => s.candidate.identity_key !== "noemail"));
});

test("Chat RFQ passo 2: il componente non invia nulla da solo e rispetta il profilo", () => {
  const ui = read("../components/rfqc1-supplier-suggestions.tsx");
  assert.match(ui, /addSupplierToBuyerRfq/);
  assert.doesNotMatch(ui, /launchBuyerRfq|sendBuyerRfqReminders/);
  assert.match(ui, /Nessuna richiesta è stata inviata/);
  const chat = read("../components/rfqc1-chat-workspace.tsx");
  assert.match(chat, /<Rfqc1SupplierSuggestions[\s\S]{0,200}canAdd=\{Boolean\(props\.canStartRequest\) && !props\.readOnlyByProfile\}/);
});
