import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const actions = fs.readFileSync(
  new URL("../app/(workspace)/review/actions.ts", import.meta.url),
  "utf8",
);
const form = fs.readFileSync(
  new URL("../components/review-correct-form.tsx", import.meta.url),
  "utf8",
);

test("review correction promotes through internal worker instead of direct observation writes", () => {
  assert.match(actions, /\/v1\/reviews\/\$\{encodeURIComponent\(rawId\)\}\/correct/);
  assert.match(actions, /actor_user_id: auth\.user\.id/);
  assert.match(actions, /corrected_values: values/);
  assert.match(actions, /revalidatePath\("\/search"\)/);
  assert.match(actions, /revalidatePath\("\/products"\)/);

  const correctionBlock = actions.slice(actions.indexOf("export async function correctReviewItem"));
  assert.doesNotMatch(correctionBlock, /\.from\("commercial_review_queue"\)\.update/);
  assert.doesNotMatch(correctionBlock, /\.from\("commercial_observations"\)/);
});

test("review correction form supports identity geometry and price corrections", () => {
  for (const field of [
    "grade",
    "standard",
    "material_number",
    "outer_diameter_mm",
    "width_mm",
    "height_mm",
    "thickness_mm",
    "length_mm",
    "quantity",
    "quantity_unit",
    "price_value",
    "price_unit",
    "currency",
    "availability_status",
    "note",
  ]) {
    assert.match(form, new RegExp(`name="${field}"`));
    assert.match(actions, new RegExp(`\\["${field}",`));
  }
});
