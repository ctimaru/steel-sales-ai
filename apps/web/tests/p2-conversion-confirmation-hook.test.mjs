import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const actions = fs.readFileSync(
  new URL("../app/(workspace)/review/identities/actions.ts", import.meta.url),
  "utf8",
);
const migration = fs.readFileSync(
  new URL("../../../supabase/migrations/20260926203800_p2_conversion_confirmation_hook.sql", import.meta.url),
  "utf8",
);

test("P2.5 confirmation synchronously reconciles commercial outcomes", () => {
  assert.match(migration, /p2_reconcile_commercial_outcome_attribution_impl/);
  assert.match(migration, /outcome_offers_attributed/);
  assert.match(migration, /outcome_orders_attributed/);
  assert.match(migration, /outcome_activation_phase','P2\.5'/);
});

test("P2.5 identity UI reports Offer and Order activation", () => {
  assert.match(actions, /outcome_offers_attributed/);
  assert.match(actions, /outcome_orders_attributed/);
  assert.match(actions, /offerte/);
  assert.match(actions, /ordini attivati/);
});
