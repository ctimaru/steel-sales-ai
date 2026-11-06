import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

import {
  verifyRfqc1InboundSvix,
  readRfqc1BoundedRawBody,
  RFQC1_MAX_WEBHOOK_BYTES,
} from "../lib/rfqc1-inbound-svix.ts";
import {
  isRfqc1SenderAuthenticated,
  isRfqc1TrustedSenderVerifierAvailable,
} from "../lib/rfqc1-inbound-transport-auth.ts";

const root = fileURLToPath(new URL("..", import.meta.url));
const routeSource = readFileSync(join(root, "app/api/webhooks/resend-inbound/route.ts"), "utf8");
const outgoingWebhook = readFileSync(join(root, "app/api/webhooks/resend/route.ts"), "utf8");
const replySource = readFileSync(join(root, "lib/rfqc1-inbound-email.ts"), "utf8");

const keyBytes = Buffer.from("synthetic-test-key-only-not-production-0123456789", "utf8");
const secret = "whsec_" + keyBytes.toString("base64");
const rawPayload = '{"type":"email.received","data":{"email_id":"55555555-5555-4555-8555-555555555555"}}';
const id = "msg_local_fake_001";
const timestamp = "1793970000";
const sig = (body = rawPayload) => "v1," + createHmac("sha256", keyBytes)
  .update(id + "." + timestamp + "." + body).digest("base64");
const good = {
  rawPayload,
  headers: { id, timestamp, signature: sig() },
  secret,
  nowSeconds: Number(timestamp),
};

test("EMAIL1.E Svix accepts only raw signed bytes, correct time and valid secret", () => {
  assert.equal(verifyRfqc1InboundSvix(good), true);
  assert.equal(verifyRfqc1InboundSvix({
    ...good, rawPayload: rawPayload.replace("email.received", "email.sent"),
  }), false);
  assert.equal(verifyRfqc1InboundSvix({
    ...good, secret: "whsec_" + Buffer.from("another secret that is longer than 24 bytes").toString("base64"),
  }), false);
  assert.equal(verifyRfqc1InboundSvix({
    ...good, nowSeconds: Number(timestamp) + 301,
  }), false);
  assert.equal(verifyRfqc1InboundSvix({
    ...good, headers: { ...good.headers, id: "bad\nheader" },
  }), false);
  assert.equal(verifyRfqc1InboundSvix({
    ...good, headers: { ...good.headers, signature: "v1,not-a-verified-signature" },
  }), false);
  assert.equal(verifyRfqc1InboundSvix({
    ...good, headers: { ...good.headers, signature: "v0," + sig().slice(3) + " " + sig() },
  }), true); // accepts a valid signature among multiple versions
});

test("EMAIL1.E inbound body reader enforces bytes, including no Content-Length", async () => {
  const stream = (data) => new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(data));
      controller.close();
    },
  });
  assert.equal(await readRfqc1BoundedRawBody(stream(rawPayload), null), rawPayload);
  assert.equal(await readRfqc1BoundedRawBody(
    stream("A".repeat(RFQC1_MAX_WEBHOOK_BYTES + 1)), null,
  ), null);
  assert.equal(await readRfqc1BoundedRawBody(stream("{}"), "40000"), null);
  assert.equal(await readRfqc1BoundedRawBody(stream("{}"), "-1"), null);
});

test("EMAIL1.E spoofed From, Authentication-Results or DKIM text cannot unlock supplier writes", () => {
  assert.equal(isRfqc1TrustedSenderVerifierAvailable(), false);
  assert.equal(isRfqc1SenderAuthenticated({
    from: "quotes@factory.example",
    headers: {
      "Authentication-Results": "spf=pass dkim=pass dmarc=pass",
      "DKIM-Signature": "v=1; d=factory.example; b=forged",
    },
  }), false);
  assert.equal(isRfqc1SenderAuthenticated(null), false);
});

test("EMAIL1.E endpoint is isolated and missing any safety gate stays closed", () => {
  for (const gate of [
    "RFQC1_INBOUND_EMAIL_ENABLED",
    "RFQC1_INBOUND_RECEIVER_READY",
    "RFQC1_INBOUND_ATOMIC_LEDGER_READY",
    "RFQC1_INBOUND_TRUSTED_SENDER_PROOF_READY",
    "RFQC1_INBOUND_WEBHOOK_SECRET",
  ]) assert.ok(routeSource.includes(gate), gate + " not checked by inbound route");
  assert.match(routeSource, /readRfqc1BoundedRawBody/);
  assert.match(routeSource, /verifyRfqc1InboundSvix/);
  assert.match(routeSource, /rfqc1_received_dispatch_context/);
  assert.match(routeSource, /inspectRfqc1ReceivedContent/);
  assert.match(routeSource, /evaluateRfqc1InboundReply/);
  assert.match(routeSource, /if \(!senderAuthenticationPassed\) return unavailable\(\)/);
  assert.match(routeSource, /"rfqc1_ingest_received_email"/);
  assert.match(replySource, /isRfqc1TrustedSenderVerifierAvailable\(\)/);
  assert.match(replySource, /RFQC1_INBOUND_TRUSTED_SENDER_PROOF_READY/);
  assert.doesNotMatch(outgoingWebhook, /"email\.received"/);
  assert.doesNotMatch(routeSource, /\bemail\.send\s*\(/);
});
