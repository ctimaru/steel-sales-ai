import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const actions = fs.readFileSync(new URL("../app/(workspace)/review/offer-recovery/actions.ts", import.meta.url), "utf8");
const page = fs.readFileSync(new URL("../app/(workspace)/review/offer-recovery/page.tsx", import.meta.url), "utf8");
const button = fs.readFileSync(new URL("../app/(workspace)/review/offer-recovery/offer-recovery-button.tsx", import.meta.url), "utf8");
const relationships = fs.readFileSync(new URL("../app/(workspace)/review/relationships/page.tsx", import.meta.url), "utf8");

test("PA2.25 loads relationship gap + Offer recovery audit", () => {
  assert.match(actions, /p1_relationship_gap_offer_recovery_audit/);
  assert.match(page, /RFQ↔Order same Conversation/);
  assert.match(page, /Safe recovery ready/);
});

test("Offer recovery is explicit and single-thread", () => {
  assert.match(actions, /p1_recover_shadow_duplicate_offer/);
  assert.match(button, /Recupera Offer/);
  assert.match(page, /PA2\.17 resta invariato/);
});

test("PA2.25 keeps unique incomplete product evidence blocked", () => {
  assert.match(page, /Nessun prodotto\s+unico incompleto può essere escluso automaticamente/);
  assert.match(relationships, /review\/offer-recovery/);
});
