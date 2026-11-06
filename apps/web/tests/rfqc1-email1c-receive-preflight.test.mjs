import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

import { buildRfqc1InboundAlias, evaluateRfqc1InboundReply } from "../lib/rfqc1-inbound-email.ts";
import { parseRfqc1ReceivedWebhook, inspectRfqc1ReceivedContent } from "../lib/rfqc1-received-email-preflight.ts";

const root = fileURLToPath(new URL("..", import.meta.url));
const secret = "synthetic-preflight-hmac-key-not-production-123456789";
const domain = "incoming.example.test";
const supplierA = {
  rfqId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  dispatchId: "11111111-1111-4111-8111-111111111111",
  supplierId: "22222222-2222-4222-8222-222222222222",
  supplierEmail: "quotes@factory-a.example",
};
const supplierB = {
  ...supplierA,
  dispatchId: "33333333-3333-4333-8333-333333333333",
  supplierId: "44444444-4444-4444-8444-444444444444",
  supplierEmail: "quotes@factory-b.example",
};
const toA = buildRfqc1InboundAlias(supplierA, domain, secret);
const emailId = "55555555-5555-4555-8555-555555555555";
const event = {
  type: "email.received",
  created_at: "2026-11-06T11:00:00Z",
  data: {
    email_id: emailId, from: "Factory A <QUOTES@factory-a.example>",
    to: [toA], cc: [], bcc: [], attachments: [],
    message_id: "<synthetic@test.example>", subject: "Re: richiesta 123",
  },
};
const content = {
  id: emailId, from: "quotes@factory-a.example", to: [toA],
  cc: [], bcc: [], attachments: [],
  text: "Confermiamo 780 €/t, consegna 14 giorni.\n\nOn Fri wrote:\n> Target buyer 690 €/t",
  html: "<p>Untrusted markup</p>",
};
const parse = e => parseRfqc1ReceivedWebhook(e, domain);

test("RFQC1.EMAIL1.C accepts only one correctly shaped Resend inbound metadata envelope", () => {
  const found = parse(event);
  assert.equal(found.kind, "candidate");
  assert.equal(found.providerEmailId, emailId);
  assert.equal(found.dispatchId, supplierA.dispatchId);
  assert.equal(found.recipient, toA);
  assert.equal(found.from, "quotes@factory-a.example");
  assert.deepEqual(parse({ ...event, type: "email.sent" }), { kind: "ignored" });
  assert.deepEqual(parse({ ...event, data: { ...event.data, email_id: "unknown" } }),
    { kind: "rejected", reason: "identity" });
});
test("RFQC1.EMAIL1.C rejects group recipient, CC/BCC, attachments, alias and sender spoof shape", () => {
  assert.deepEqual(parse({ ...event, data: { ...event.data, to: [toA, "group@example.test"] } }),
    { kind: "rejected", reason: "recipients" });
  assert.deepEqual(parse({ ...event, data: { ...event.data, cc: ["another@factory.example"] } }),
    { kind: "rejected", reason: "recipients" });
  assert.deepEqual(parse({ ...event, data: { ...event.data, bcc: ["secret@factory.example"] } }),
    { kind: "rejected", reason: "recipients" });
  assert.deepEqual(parse({ ...event, data: { ...event.data, attachments: [{filename:"offer.pdf"}] } }),
    { kind: "rejected", reason: "attachments" });
  assert.deepEqual(parse({ ...event, data: { ...event.data, to: ["reply@incoming.example.test"] } }),
    { kind: "rejected", reason: "alias" });
  assert.deepEqual(parseRfqc1ReceivedWebhook(event, "elsewhere.example.test"),
    { kind: "rejected", reason: "alias" });
  assert.deepEqual(parse({ ...event, data: { ...event.data, from: "A <a@example.test>, B <b@example.test>" } }),
    { kind: "rejected", reason: "recipients" });
});
test("RFQC1.EMAIL1.C requires exact provider content match and text-only", () => {
  const envelope = parse(event);
  assert.equal(envelope.kind, "candidate");
  const fetched = inspectRfqc1ReceivedContent(envelope, content);
  assert.equal(fetched.kind, "candidate");
  assert.equal(fetched.senderAuthenticationPassed, false);
  assert.ok(fetched.plainText.includes("780"));
  assert.deepEqual(inspectRfqc1ReceivedContent(envelope, { ...content, id: "different" }),
    { kind: "rejected", reason: "identity" });
  assert.deepEqual(inspectRfqc1ReceivedContent(envelope, { ...content, from: supplierB.supplierEmail }),
    { kind: "rejected", reason: "recipients" });
  assert.deepEqual(inspectRfqc1ReceivedContent(envelope, { ...content, received_for: [toA,"other@test.example"] }),
    { kind: "rejected", reason: "recipients" });
  assert.deepEqual(inspectRfqc1ReceivedContent(envelope, { ...content, text: null }),
    { kind: "rejected", reason: "body" });
  assert.deepEqual(inspectRfqc1ReceivedContent(envelope, { ...content, text: "X".repeat(32769) }),
    { kind: "rejected", reason: "oversize" });
  assert.deepEqual(inspectRfqc1ReceivedContent(envelope, { ...content, attachments:[{id:"synthetic"}] }),
    { kind: "rejected", reason: "attachments" });
});
test("RFQC1.EMAIL1.C never trusts the API From as proof of domain authenticity", () => {
  const envelope = parse(event);
  assert.equal(envelope.kind, "candidate");
  const fetched = inspectRfqc1ReceivedContent(envelope, content);
  assert.equal(fetched.kind, "candidate");
  const unchecked = evaluateRfqc1InboundReply({
    identity: supplierA, receivingDomain: domain, signingSecret: secret,
    reply: { providerEmailId: fetched.providerEmailId, from: fetched.from,
      envelopeTo: [fetched.recipient], plainText: fetched.plainText,
      senderAuthenticationPassed: fetched.senderAuthenticationPassed },
  });
  assert.deepEqual(unchecked, { kind: "quarantine", reason: "sender_unverified" });
  const verifiedByIndependentTrustedTransport = evaluateRfqc1InboundReply({
    identity: supplierA, receivingDomain: domain, signingSecret: secret,
    reply: { providerEmailId: fetched.providerEmailId, from: fetched.from,
      envelopeTo: [fetched.recipient], plainText: fetched.plainText,
      senderAuthenticationPassed: true },
  });
  assert.equal(verifiedByIndependentTrustedTransport.kind, "eligible");
  assert.equal(verifiedByIndependentTrustedTransport.body, "Confermiamo 780 €/t, consegna 14 giorni.");
  assert.deepEqual(evaluateRfqc1InboundReply({
    identity: supplierB, receivingDomain: domain, signingSecret: secret,
    reply: { providerEmailId: fetched.providerEmailId, from: fetched.from,
      envelopeTo: [fetched.recipient], plainText: fetched.plainText,
      senderAuthenticationPassed: true },
  }), { kind: "rejected", reason: "recipient" });
});
test("RFQC1.EMAIL1.C production cannot enable Reply-To before atomic receipt ledger is ready", () => {
  const source = readFileSync(join(root, "lib/rfqc1-inbound-email.ts"), "utf8");
  assert.match(source, /RFQC1_INBOUND_ATOMIC_LEDGER_READY/);
  assert.match(source, /RFQC1_INBOUND_RECEIVER_READY/);
  assert.match(source, /RFQC1_INBOUND_EMAIL_ENABLED/);
  const webhook = readFileSync(join(root, "app/api/webhooks/resend/route.ts"), "utf8");
  assert.ok(webhook.includes("email.received") === false, "The existing outbound-only webhook must not ingest emails until ledger is authorised");
});
