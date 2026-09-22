import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const actions = fs.readFileSync(new URL("../app/(workspace)/review/offer-remediation/actions.ts", import.meta.url), "utf8");
const page = fs.readFileSync(new URL("../app/(workspace)/review/offer-remediation/page.tsx", import.meta.url), "utf8");
const button = fs.readFileSync(new URL("../app/(workspace)/review/offer-remediation/offer-remediation-button.tsx", import.meta.url), "utf8");
const recovery = fs.readFileSync(new URL("../app/(workspace)/review/offer-recovery/page.tsx", import.meta.url), "utf8");

test("PA2.26 loads Offer evidence remediation readiness", () => {
  assert.match(actions, /p1_offer_evidence_remediation_readiness/);
  assert.match(page, /Direction conflict/);
  assert.match(page, /Mixed scope/);
  assert.match(page, /Product identity/);
  assert.match(page, /Source reparse/);
});

test("Offer remediation enrollment is explicit and non-mutating", () => {
  assert.match(actions, /p1_enqueue_offer_remediation_thread/);
  assert.match(button, /Aggiungi alla queue/);
  assert.match(page, /nessun prezzo, quantità, direzione o identità prodotto viene corretto automaticamente/i);
});

test("PA2.26 links from Offer recovery", () => {
  assert.match(recovery, /review\/offer-remediation/);
});
