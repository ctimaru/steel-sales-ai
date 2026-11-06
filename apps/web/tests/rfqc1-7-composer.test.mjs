import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const root = fileURLToPath(new URL("..", import.meta.url));
const composer = readFileSync(join(root, "components/rfqc1-chat-composer.tsx"), "utf8");
const layout = readFileSync(join(root, "components/rfqc1-chat-workspace.tsx"), "utf8");
test("RFQC1.7 posts to existing RFQH6 only after explicit confirmation", () => {
  assert.match(composer, /postBuyerRfqNegotiation/);
  assert.match(composer, /if \(!confirm \|\| !canConfirm/);
  assert.match(composer, /Confermo e invio/);
  assert.match(composer, /supplierId, messageType: type/);
  assert.match(composer, /counterTargets/);
  assert.match(layout, /key=\{supplier\.id\}/);
  assert.match(layout, /<Rfqc1ChatComposer/);
  assert.doesNotMatch(composer, /Promise\.all\(.*supplier/);
});
test("RFQC1.7 blocks mutation on read-only/closed RFQs", () => {
  assert.match(composer, /!disabled && !pending/);
  assert.match(layout, /!props\.canExecute/);
  assert.match(layout, /\["launched", "collecting"\]/);
});
