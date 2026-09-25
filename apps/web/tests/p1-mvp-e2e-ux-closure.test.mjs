import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const globalSearch = fs.readFileSync(
  new URL("../components/global-search.tsx", import.meta.url),
  "utf8",
);
const reviewActions = fs.readFileSync(
  new URL("../app/(workspace)/review/actions.ts", import.meta.url),
  "utf8",
);
const correctionForm = fs.readFileSync(
  new URL("../components/review-correct-form.tsx", import.meta.url),
  "utf8",
);

test("PA2.32 Search links normalized commercial entities into the daily workflow", () => {
  assert.match(globalSearch, /canonical_product_id/);
  assert.match(globalSearch, /\/products\/\$\{canonicalProductId\}/);
  assert.match(globalSearch, /normalized_entity_id/);
  assert.match(globalSearch, /\/rfqs\/\$\{normalizedEntityId\}/);
  assert.match(globalSearch, /\/offers\/\$\{normalizedEntityId\}/);
  assert.match(globalSearch, /\/orders\/\$\{normalizedEntityId\}/);
  assert.match(globalSearch, /Apri prodotto/);
});

test("PA2.32 correction loop exposes sales-critical geometry and price fields", () => {
  for (const field of [
    "outer_diameter_mm",
    "width_mm",
    "height_mm",
    "thickness_mm",
    "length_mm",
    "price_value",
    "price_unit",
    "currency",
    "discount_percentage",
  ]) {
    assert.match(reviewActions, new RegExp(`\\["${field}"`));
    assert.match(correctionForm, new RegExp(`name="${field}"`));
  }
});

test("PA2.32 correction remains routed through the controlled correction RPC", () => {
  assert.match(reviewActions, /p1_apply_commercial_review_correction/);
  assert.match(reviewActions, /revalidatePath\("\/search"\)/);
  assert.match(reviewActions, /revalidatePath\("\/products"\)/);
});
