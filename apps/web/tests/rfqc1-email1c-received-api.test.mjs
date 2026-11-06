import assert from "node:assert/strict";
import { test } from "node:test";

import { fetchRfqc1ReceivedEmailReadOnly } from "../lib/rfqc1-received-email-api.ts";

const id = "55555555-5555-4555-8555-555555555555";
const secret = "synthetic-only-no-real-provider-key";
const base = {
  id, from: "quotes@factory-a.example",
  to: ["reply+11111111-1111-4111-8111-111111111111.fakefakefakefakefakefake@incoming.example.test"],
  attachments: [], text: "Preventivo 780 €/t",
};
const fake = (payload = base, status = 200, type = "application/json") => async (url, init) => {
  assert.equal(url, "https://api.resend.com/emails/receiving/" + id);
  assert.equal(init.method, "GET");
  assert.equal(init.headers.Authorization, "Bearer " + secret);
  assert.equal(init.cache, "no-store");
  return new Response(JSON.stringify(payload), { status, headers: { "content-type": type } });
};
test("EMAIL1.C GET fetches received body only by canonical provider ID with no mutations", async () => {
  let calls = 0;
  const data = await fetchRfqc1ReceivedEmailReadOnly({
    providerEmailId: id,
    apiKey: secret,
    request: async (...args) => { calls++; return fake()(...args); },
  });
  assert.equal(calls, 1);
  assert.equal(data.text, "Preventivo 780 €/t");
});
test("EMAIL1.C rejects provider ID injection before any HTTP call", async () => {
  let called = false;
  await assert.rejects(fetchRfqc1ReceivedEmailReadOnly({
    providerEmailId: "../keys",
    apiKey: secret,
    request: async () => { called = true; throw new Error("Should not request"); },
  }), /identifier invalid/);
  assert.equal(called, false);
});
test("EMAIL1.C rejects HTTP errors, non-JSON and unbounded responses", async () => {
  await assert.rejects(fetchRfqc1ReceivedEmailReadOnly({
    providerEmailId: id, apiKey: secret, request: fake(base, 503),
  }), /provider read failed/);
  await assert.rejects(fetchRfqc1ReceivedEmailReadOnly({
    providerEmailId: id, apiKey: secret, request: fake(base, 200, "text/html"),
  }), /response type invalid/);
  await assert.rejects(fetchRfqc1ReceivedEmailReadOnly({
    providerEmailId: id, apiKey: secret, request: fake({ data: "X".repeat(270000) }),
  }), /response oversized/);
});
test("EMAIL1.C requires server-side credentials and does not touch live Resend", async () => {
  await assert.rejects(fetchRfqc1ReceivedEmailReadOnly({
    providerEmailId: id, apiKey: "", request: fake(),
  }), /provider key missing/);
});
