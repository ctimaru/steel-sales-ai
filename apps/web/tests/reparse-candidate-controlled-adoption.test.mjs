import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const actions = fs.readFileSync(
  new URL("../app/(workspace)/review/offer-reparse/actions.ts", import.meta.url),
  "utf8",
);
const card = fs.readFileSync(
  new URL("../app/(workspace)/review/offer-reparse/reparse-candidate-review-card.tsx", import.meta.url),
  "utf8",
);
const page = fs.readFileSync(
  new URL("../app/(workspace)/review/offer-reparse/page.tsx", import.meta.url),
  "utf8",
);

test("PA2.29 candidate review uses controlled adoption RPCs", () => {
  assert.ok(actions.includes("p1_offer_reparse_candidate_review"));
  assert.ok(actions.includes("p1_adopt_offer_reparse_candidate"));
  assert.ok(actions.includes("p1_reject_offer_reparse_candidate"));
});

test("PA2.29 never preselects a target or fields", () => {
  assert.ok(card.includes('useState("")'));
  assert.ok(card.includes("useState<string[]>([])"));
  assert.ok(card.includes("Seleziona observation target"));
  assert.ok(card.includes("selectedFields.length"));
});

test("PA2.29 makes conflict and overwrite policy visible", () => {
  assert.ok(card.includes("Conflitti non adottabili in PA2.29"));
  assert.ok(page.includes("Nessun target viene"));
  assert.ok(page.includes("soltanto campi oggi mancanti"));
  assert.ok(page.includes("no overwrite"));
  assert.ok(page.includes("no auto-resolution"));
});
