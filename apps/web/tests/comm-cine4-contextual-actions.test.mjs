import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const actions = readFileSync(new URL("../components/commercial-deal-quick-actions.tsx", import.meta.url), "utf8");
const calc = readFileSync(new URL("../components/commercial-calculator-quick-access.tsx", import.meta.url), "utf8");
const worklist = readFileSync(new URL("../components/commercial-unified-worklist.tsx", import.meta.url), "utf8");

test("COMM-CINE4 reuses existing calculator modal from the selected deal", () => {
  assert.match(actions, /data-testid="comm-cine4-quick-actions"/);
  assert.match(actions, /dispatchEvent\(new Event\("sss:open-commercial-calculator"\)\)/);
  assert.match(calc, /addEventListener\("sss:open-commercial-calculator", onOpen\)/);
  assert.match(calc, /removeEventListener\("sss:open-commercial-calculator", onOpen\)/);
  assert.match(worklist, /<CommercialDealQuickActions canWrite=\{canWrite\}/);
});

test("COMM-CINE4 preserves read-only roles and original source", () => {
  assert.match(actions, /\{canWrite \? \(/);
  assert.match(actions, /RFQ · sola lettura/);
  assert.match(actions, /originalHref/);
  assert.match(actions, /richiedono conferma esplicita/);
});
