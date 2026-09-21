import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const actions = fs.readFileSync(
  new URL("../app/(workspace)/review/actions.ts", import.meta.url),
  "utf8",
);

test("human correction uses the controlled promotion RPC", () => {
  assert.match(actions, /p1_apply_commercial_review_correction/);
  assert.match(actions, /p_review_id/);
  assert.match(actions, /p_corrected_values/);
  assert.doesNotMatch(
    actions,
    /function correctReviewItem[\s\S]*?\.from\("commercial_review_queue"\)[\s\S]*?\.update\(/,
  );
});

test("successful correction refreshes commercial discovery surfaces", () => {
  assert.match(actions, /revalidatePath\("\/review"\)/);
  assert.match(actions, /revalidatePath\("\/dashboard"\)/);
  assert.match(actions, /revalidatePath\("\/search"\)/);
  assert.match(actions, /revalidatePath\("\/products"\)/);
  assert.match(
    actions,
    /Search e Product History useranno subito il dato aggiornato/,
  );
});
