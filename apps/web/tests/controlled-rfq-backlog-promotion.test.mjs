import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const actions = fs.readFileSync(new URL("../app/(workspace)/review/coverage/actions.ts", import.meta.url), "utf8");
const page = fs.readFileSync(new URL("../app/(workspace)/review/coverage/page.tsx", import.meta.url), "utf8");
const button = fs.readFileSync(new URL("../app/(workspace)/review/coverage/promotion-button.tsx", import.meta.url), "utf8");

test("PA2.16 uses the strict single-observation promotion RPC", () => {
  assert.match(actions, /p1_promote_ready_rfq_observation/);
  assert.match(actions, /p_observation_id/);
  assert.doesNotMatch(actions, /promote.*bulk/i);
});

test("only ready requested backlog rows expose promotion", () => {
  assert.match(page, /row\.item_role === "requested"/);
  assert.match(page, /row\.backlog_status === "ready"/);
  assert.match(page, /PromotionButton/);
});

test("promotion control is explicit and refreshes coverage after success", () => {
  assert.match(button, /Promuovi questa RFQ/);
  assert.match(button, /Azione singola esplicita/);
  assert.match(button, /router\.refresh\(\)/);
});
