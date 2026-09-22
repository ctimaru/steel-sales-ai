import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const actions = fs.readFileSync(
  new URL("../app/(workspace)/review/offer-reparse/actions.ts", import.meta.url),
  "utf8",
);
const page = fs.readFileSync(
  new URL("../app/(workspace)/review/offer-reparse/page.tsx", import.meta.url),
  "utf8",
);
const card = fs.readFileSync(
  new URL("../app/(workspace)/review/offer-reparse/reparse-remediation-closure-card.tsx", import.meta.url),
  "utf8",
);

test("PA2.30 exposes explicit remediation closure RPCs", () => {
  assert.ok(actions.includes("p1_offer_reparse_remediation_closure_readiness"));
  assert.ok(actions.includes("p1_close_offer_reparse_remediation"));
  assert.ok(actions.includes("revalidatePath(\"/review/offer-remediation\")"));
});

test("PA2.30 keeps closure explicit and conflict-aware", () => {
  assert.ok(page.includes("Nessuna chiusura è automatica"));
  assert.ok(page.includes("conflicts block closure"));
  assert.ok(card.includes("Conflitto non-null da gestire"));
  assert.ok(card.includes("La remediation resta aperta"));
});

test("PA2.30 requires a note for dismissals", () => {
  assert.ok(card.includes("const noteRequired = dismissal"));
  assert.ok(card.includes("Motivazione obbligatoria per archiviare la remediation"));
  assert.ok(card.includes("noteRequired && !note.trim()"));
});
