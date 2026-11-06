import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildRfqc1InboundAlias,
  evaluateRfqc1InboundReply,
  cleanRfqc1InboundPlainText,
} from "../lib/rfqc1-inbound-email.ts";

// Invented data; NEVER connect this test to Resend or Supabase.
const secret = "rfqc1-synthetic-test-secret-not-a-production-key-v1";
const domain = "inbound.example.test";
const a = {
  rfqId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  dispatchId: "11111111-1111-4111-8111-111111111111",
  supplierId: "22222222-2222-4222-8222-222222222222",
  supplierEmail: "sales@factory-a.example",
};
const b = {
  ...a,
  dispatchId: "33333333-3333-4333-8333-333333333333",
  supplierId: "44444444-4444-4444-8444-444444444444",
  supplierEmail: "quotes@factory-b.example",
};
const emailToA = buildRfqc1InboundAlias(a, domain, secret);
const incoming = {
  providerEmailId: "email_test_001",
  from: "Factory A <SALES@factory-a.example>",
  envelopeTo: [emailToA],
  plainText: "Possiamo offrire 790 €/t.\n\nIl giorno 5 novembre ha scritto:\n> Prezzo interno 710 €/t",
  senderAuthenticationPassed: true,
};
const check = (identity, reply) => evaluateRfqc1InboundReply({
  identity, reply, receivingDomain: domain, signingSecret: secret,
});
test("RFQC1.EMAIL1.A signed aliases are deterministic and supplier-isolated", () => {
  assert.equal(emailToA, buildRfqc1InboundAlias(a, domain, secret));
  assert.notEqual(emailToA, buildRfqc1InboundAlias(b, domain, secret));
  const good = check(a, incoming);
  assert.equal(good.kind, "eligible");
  assert.equal(good.body, "Possiamo offrire 790 €/t.");
  assert.ok(!good.body.includes("710"));
  assert.equal(good.idempotencyKey.length, 64);
  assert.deepEqual(good, check(a, incoming)); // key stable; DB uniqueness still needed
});
test("RFQC1.EMAIL1.A rejects wrong supplier, forged alias, other recipient, group message", () => {
  assert.deepEqual(check(b, incoming), { kind: "rejected", reason: "recipient" });
  assert.deepEqual(check(a, { ...incoming, from: b.supplierEmail }), { kind: "rejected", reason: "sender" });
  assert.deepEqual(check(a, { ...incoming, envelopeTo: [emailToA.replace(/([A-Za-z0-9_-])@/, (_, char) => (char === "x" ? "y" : "x") + "@")] }), { kind: "rejected", reason: "recipient" });
  assert.deepEqual(check(a, { ...incoming, envelopeTo: [emailToA, buildRfqc1InboundAlias(b, domain, secret)] }), { kind: "rejected", reason: "recipient" });
});
test("RFQC1.EMAIL1.A quarantines unauthenticated From even when address matches", () => {
  assert.deepEqual(check(a, { ...incoming, senderAuthenticationPassed: false }), {
    kind: "quarantine", reason: "sender_unverified",
  });
});
test("RFQC1.EMAIL1.A strips quoted threads and rejects no-body or oversized email", () => {
  assert.equal(cleanRfqc1InboundPlainText("Grazie, ok.\r\n\r\nOn Monday wrote:\r\n> other user"), "Grazie, ok.");
  assert.deepEqual(check(a, { ...incoming, plainText: "> Citazione" }), { kind: "rejected", reason: "body" });
  assert.deepEqual(check(a, { ...incoming, plainText: null }), { kind: "rejected", reason: "body" });
  assert.deepEqual(check(a, { ...incoming, plainText: "X".repeat(40000) }), { kind: "rejected", reason: "oversize" });
  assert.deepEqual(check(a, { ...incoming, providerEmailId: "bad\nheader" }), { kind: "rejected", reason: "invalid" });
});
