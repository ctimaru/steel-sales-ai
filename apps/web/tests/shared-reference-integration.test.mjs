import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const search = fs.readFileSync(
  new URL("../components/global-search.tsx", import.meta.url),
  "utf8",
);
const product = fs.readFileSync(
  new URL("../app/(workspace)/products/[productId]/page.tsx", import.meta.url),
  "utf8",
);
const prices = fs.readFileSync(
  new URL("../app/(workspace)/products/[productId]/prices/page.tsx", import.meta.url),
  "utf8",
);
const actions = fs.readFileSync(
  new URL("../app/(workspace)/products/actions.ts", import.meta.url),
  "utf8",
);

test("Search surfaces Shared Steel Knowledge resolution", () => {
  assert.match(search, /shared_reference/);
  assert.match(search, /Riferimento verificato/);
  assert.match(search, /Riferimento · peso da completare/);
});

test("Product 360 exposes canonical reference identity and weight", () => {
  assert.match(actions, /SharedSteelReference/);
  assert.match(product, /Riferimento tecnico/);
  assert.match(product, /Peso di riferimento/);
  assert.match(product, /effective_weight_kg_m/);
  assert.match(product, /effective_source_key/);
});

test("Price History keeps historical normalization semantics while showing canonical reference", () => {
  assert.match(prices, /Peso teorico \/ reference/);
  assert.match(prices, /Riferimento verificato/);
  assert.match(prices, /non vengono riscritte retroattivamente/);
  assert.match(prices, /Peso teorico della sezione/);
});
