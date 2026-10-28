import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const form = readFileSync(new URL("../components/rfq-supplier-response-form.tsx", import.meta.url), "utf8");
const browser = readFileSync(new URL("./rfqh14-2-chrome-procurement.mjs", import.meta.url), "utf8");

test("RFQH14.2 saving a guest draft must not refresh away the current priced lines", () => {
  const save = form.slice(form.indexOf("  function saveDraft("), form.indexOf("  function submit()"));
  const submit = form.slice(form.indexOf("  function submit()"), form.indexOf("  function decline()"));
  assert.ok(save.includes("setFeedback(\"Bozza salvata.\")"));
  assert.doesNotMatch(save, /router\.refresh\(\)/);
  assert.match(submit, /saveDraft\(async \(\) =>/);
  assert.match(submit, /submitSupplierQuote\(token\)/);
  assert.match(submit, /router\.refresh\(\)/);
});

test("RFQH14.2 browser verifies both prices survive draft save before attempting submit", () => {
  assert.match(browser, /First quoted price must survive draft save/);
  assert.match(browser, /Second quoted price must survive draft save/);
  assert.match(browser, /inputValue\(\)/);
  assert.match(browser, /Offerta inviata\|submitted/);
});
