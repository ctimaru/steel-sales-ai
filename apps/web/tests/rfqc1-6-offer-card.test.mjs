import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const source = readFileSync(join(root, "components/rfqc1-offer-card.tsx"), "utf8");
const shell = readFileSync(join(root, "components/rfqc1-chat-workspace.tsx"), "utf8");
test("RFQC1.6 renders per-line offer €/t and €/m, not buyer targets", () => {
  assert.match(source, /offer\.lines\.map/);
  assert.match(source, /priceEurT/);
  assert.match(source, /priceEurM/);
  assert.match(source, /paymentTerms/);
  assert.match(source, /validityUntil/);
  assert.match(source, /deliveryDate/);
  assert.doesNotMatch(source, /targetEur|target_eur|buyerTarget/);
  assert.match(shell, /<Rfqc1OfferCard/);
});
