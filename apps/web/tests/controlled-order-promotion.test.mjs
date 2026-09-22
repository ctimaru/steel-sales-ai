import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const actions = fs.readFileSync(new URL("../app/(workspace)/review/coverage/actions.ts", import.meta.url), "utf8");
const page = fs.readFileSync(new URL("../app/(workspace)/review/coverage/page.tsx", import.meta.url), "utf8");
const button = fs.readFileSync(new URL("../app/(workspace)/review/coverage/order-promotion-button.tsx", import.meta.url), "utf8");

test("PA2.18 loads tenant-scoped Order readiness", () => {
  assert.match(actions, /p1_order_promotion_readiness/);
  assert.match(actions, /p_organization_id/);
});

test("Order promotion uses the explicit whole-thread RPC", () => {
  assert.match(actions, /p1_promote_ready_order_thread/);
  assert.match(actions, /p_thread_id/);
  assert.match(button, /Promuovi questo Order/);
  assert.match(button, /prezzo opzionale/);
});

test("Order UI makes conservative policy explicit", () => {
  assert.match(page, /Company inference: disabilitata/);
  assert.match(page, /RFQ inference: disabilitata/);
  assert.match(page, /Offer inference: disabilitata/);
  assert.match(page, /prezzo non richiesto/);
  assert.match(page, /Bulk auto-promotion: disabilitata/);
});
