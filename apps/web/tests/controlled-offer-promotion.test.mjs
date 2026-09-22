import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const actions = fs.readFileSync(new URL("../app/(workspace)/review/coverage/actions.ts", import.meta.url), "utf8");
const page = fs.readFileSync(new URL("../app/(workspace)/review/coverage/page.tsx", import.meta.url), "utf8");
const button = fs.readFileSync(new URL("../app/(workspace)/review/coverage/offer-promotion-button.tsx", import.meta.url), "utf8");

test("PA2.17 loads tenant-scoped Offer readiness", () => {
  assert.match(actions, /p1_offer_promotion_readiness/);
  assert.match(actions, /p_organization_id/);
});

test("Offer promotion uses the explicit whole-thread RPC", () => {
  assert.match(actions, /p1_promote_ready_offer_thread/);
  assert.match(actions, /p_thread_id/);
  assert.match(button, /Promuovi questa Offer/);
  assert.match(button, /Intero thread/);
});

test("Offer UI makes conservative policy explicit", () => {
  assert.match(page, /Company inference: disabilitata/);
  assert.match(page, /RFQ inference: disabilitata/);
  assert.match(page, /promozione parziale: vietata/);
  assert.match(page, /Bulk auto-promotion: disabilitata/);
});
