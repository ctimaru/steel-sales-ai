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
  assert.match(actions, /p1_offer_reparse_candidate_review/);
  assert.match(actions, /p1_adopt_offer_reparse_candidate/);
  assert.match(actions, /p1_reject_offer_reparse_candidate/);
});

test("PA2.29 never preselects a target or fields", () => {
  assert.match(card, /useState\("")/);
  assert.match(card, /useState<string\[\]>\(\[\]\)/);
  assert.match(card, /Seleziona observation target/);
  assert.match(card, /selectedFields\.length/);
});

test("PA2.29 makes conflict and overwrite policy visible", () => {
  assert.match(card, /Conflitti non adottabili in PA2\.29/);
  assert.match(page, /Nessun target viene/);
  assert.match(page, /soltanto campi oggi mancanti/);
  assert.match(page, /no overwrite/);
  assert.match(page, /no auto-resolution/);
});
