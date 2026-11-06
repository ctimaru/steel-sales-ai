import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const root = fileURLToPath(new URL("..", import.meta.url));
const chat = readFileSync(join(root, "components/rfqc1-chat-workspace.tsx"), "utf8");
const route = readFileSync(join(root, "app/(italian)/(workspace)/marketplace/rfq-hub/[rfqId]/page.tsx"), "utf8");

test("RFQC1.5 shows a real line-by-line RFQH5 comparison alongside chat", () => {
  assert.match(chat, /Confronto offerte<\/h2>/);
  assert.match(chat, /quote\.normalized_eur_t/);
  assert.match(chat, /quote\.supplier_name/);
  assert.match(chat, /props\.comparison\.lines/);
  assert.doesNotMatch(chat, /showComparison \? "block" : "hidden"/);
});
test("RFQC1.5 keeps governed actions visible when PO requires attention", () => {
  assert.match(route, /open=\{isPreparation \|\| Boolean\(awardSnapshot\)/);
  assert.match(route, /<Rfqh13GovernancePanel/);
  assert.match(route, /<Rfqh9PurchaseOrderPanel/);
  assert.match(route, /<RfqDispatchPanel/);
});
test("RFQC1.5 has only one exact RFQ title H1 and no automatic send", () => {
  assert.match(chat, /<h1 className=/);
  assert.doesNotMatch(route, /<h1 className=/);
  assert.doesNotMatch(chat, /postBuyerRfqNegotiation/);
  assert.match(route, /Gestione RFQ/);
});
