import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

import { selectRfqc1ReplyTo } from "../lib/rfqc1-inbound-reply-to.ts";

const root = fileURLToPath(new URL("..", import.meta.url));
const identity = {
  rfqId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  dispatchId: "11111111-1111-4111-8111-111111111111",
  supplierId: "22222222-2222-4222-8222-222222222222",
  supplierEmail: "quotes@fake-supplier.example",
};
const flags = {
  enabled: true, receiverReady: true, receivingDomain: "inbound.example.test",
  signingSecret: "synthetic-fake-nonproduction-secret-1234567890",
};
const resolve = (id = identity, overrides = {}) => selectRfqc1ReplyTo({
  identity: id,
  buyerReplyTo: "buyer@azienda-test.example",
  flags: { ...flags, ...overrides },
});
test("EMAIL1.B: defaults to existing buyer Reply-To until receiver is explicitly ready", () => {
  assert.equal(resolve(identity, { enabled: false }), "buyer@azienda-test.example");
  assert.equal(resolve(identity, { receiverReady: false }), "buyer@azienda-test.example");
  assert.equal(resolve(identity, { enabled: false, receivingDomain: null }), "buyer@azienda-test.example");
});
test("EMAIL1.B: when enabled, each dispatch gets a different valid isolated Reply-To", () => {
  const a = resolve();
  const b = resolve({ ...identity, dispatchId: "33333333-3333-4333-8333-333333333333" });
  const c = resolve({ ...identity, supplierId: "44444444-4444-4444-8444-444444444444" });
  assert.match(a, /^reply\+/);
  assert.ok(a.endsWith("@inbound.example.test"));
  assert.notEqual(a, b);
  assert.notEqual(a, c);
  assert.equal(a, resolve());
});
test("EMAIL1.B: refuses a partially activated receiving channel", () => {
  assert.throws(() => resolve(identity, { signingSecret: null }), /not fully configured/);
  assert.throws(() => resolve(identity, { receivingDomain: "" }), /not fully configured/);
  assert.throws(() => resolve(identity, { signingSecret: "short" }), /not configured/);
});
test("EMAIL1.B: includes all four outbound RFQ mail paths without modifying delivery loops", () => {
  const base = readFileSync(join(root, "app/(italian)/(workspace)/marketplace/rfq-hub/actions.ts"), "utf8");
  const rfqh6 = readFileSync(join(root, "app/(italian)/(workspace)/marketplace/rfq-hub/[rfqId]/negotiation-actions.ts"), "utf8");
  assert.ok(base.startsWith('"use server";'));
  assert.ok(rfqh6.startsWith('"use server";'));
  assert.equal((base.match(/replyTo: selectRfqc1ReplyToFromServer/g) || []).length, 3);
  assert.equal((rfqh6.match(/replyTo: selectRfqc1ReplyToFromServer/g) || []).length, 1);
  assert.match(base, /idempotencyKey: dispatch\.idempotencyKey/);
  assert.match(base, /p_idempotency_key: idempotencyKey/);
  assert.match(rfqh6, /idempotencyKey: "rfqh6-" \+ input\.messageId/);
});
