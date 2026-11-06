// RFQC1.EMAIL1.E — REAL local Next.js HTTP smoke with ZERO mail and zero writes.
// Only run against the throwaway Chrome GitHub Actions server, never production.
import assert from "node:assert/strict";

const origin = process.env.DEMOTEST23_WEB_URL ?? "http://127.0.0.1:3000";
const url = new URL("/api/webhooks/resend-inbound", origin);
assert.equal(url.hostname, "127.0.0.1", "EMAIL1.E refuses remote or production URLs");
const response = await fetch(url, {
  method: "POST",
  redirect: "manual",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    type: "email.received",
    data: {
      email_id: "55555555-5555-4555-8555-555555555555",
      from: "spoofed@factory.example",
      to: ["reply+11111111-1111-4111-8111-111111111111.fakefakefakefakefakefake@inbound.example.test"],
    },
  }),
  signal: AbortSignal.timeout(20000),
});
assert.equal(response.status, 503, "EMAIL1.E must be INERT without sender proof");
assert.equal(response.headers.get("retry-after"), "300");
const body = await response.json();
assert.deepEqual(body, { ok: false }, "EMAIL1.E must not reveal headers/IDs/secrets");
const get = await fetch(url, { method: "GET", redirect: "manual" });
assert.equal(get.status, 405, "EMAIL1.E must be POST-only");
console.log("RFQC1.EMAIL1.E LOCAL: disabled by default, no SMTP writes and POST-only — PASS");
