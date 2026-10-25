/**
 * LOCAL TEST ONLY. Preload into a dedicated Next process with NODE_OPTIONS.
 * Exercises the production Resend transport without making a provider request.
 * Capability links stay in a mode-0600 file in the ephemeral runner directory.
 */
"use strict";

const { createHash } = require("node:crypto");
const { appendFileSync, chmodSync, existsSync, readFileSync, statSync } = require("node:fs");
const path = require("node:path");

function requireLocal(condition) {
  if (!condition) throw new Error("FLOW1 local provider refused unsafe configuration");
}

requireLocal(process.env.FLOW1_LOCAL_PROVIDER === "true" && process.env.CI === "true");
requireLocal(process.env.DEMOTEST23_WEB_URL === "http://127.0.0.1:3000");
requireLocal(process.env.NEXT_PUBLIC_SITE_URL === "http://127.0.0.1:3000");
requireLocal(process.env.NEXT_PUBLIC_SUPABASE_URL === "http://127.0.0.1:54321");
requireLocal(process.env.RESEND_API_KEY === "flow1-local-synthetic");
const temp = process.env.RUNNER_TEMP;
requireLocal(typeof temp === "string" && path.isAbsolute(temp) && statSync(temp).isDirectory());
const capturePath = path.join(temp, "product-flow1-provider.jsonl");
const allowedRecipients = new Set(["rfqh14-producer@example.test", "rfqh14-trader@example.test"]);
const originalFetch = globalThis.fetch;
requireLocal(typeof originalFetch === "function");

globalThis.fetch = async function flow1LocalFetch(input, init) {
  const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
  if (url.origin !== "https://api.resend.com") {
    // This dedicated test process needs only Next, the Worker and local Supabase.
    requireLocal(["127.0.0.1", "localhost", "[::1]"].includes(url.hostname));
    // A local endpoint must not redirect this process to an external provider.
    return originalFetch.call(globalThis, input, { ...init, redirect: "error" });
  }

  const request = new Request(input, init);
  requireLocal(url.pathname === "/emails" && !url.search && request.method === "POST");
  requireLocal(request.headers.get("authorization") === "Bearer flow1-local-synthetic");
  const idempotencyKey = request.headers.get("idempotency-key");
  requireLocal(typeof idempotencyKey === "string" && /^rfqh3-[0-9a-f-]{36}-invite-v1$/.test(idempotencyKey));
  const body = await request.json();
  requireLocal(Array.isArray(body.to) && body.to.length === 1 && allowedRecipients.has(body.to[0]));
  requireLocal(typeof body.subject === "string" && body.subject.includes("FLOW1 E2E LOCAL "));
  requireLocal(typeof body.text === "string" && typeof body.html === "string");
  const links = body.text.match(/https?:\/\/[^\s<>"']+\/rfq\/respond\/[A-Za-z0-9_-]+/g) ?? [];
  requireLocal(links.length === 1);
  const invite = new URL(links[0]);
  requireLocal(invite.origin === "http://127.0.0.1:3000" && /^\/rfq\/respond\/[A-Za-z0-9_-]{43}$/.test(invite.pathname));
  requireLocal(!invite.search && !invite.hash);

  const providerId = "flow1-local-" + createHash("sha256").update(idempotencyKey).digest("hex").slice(0, 32);
  const previous = existsSync(capturePath)
    ? readFileSync(capturePath, "utf8").trim().split("\n").filter(Boolean).map(line => JSON.parse(line))
    : [];
  const existing = previous.find(row => row.idempotencyKey === idempotencyKey);
  if (existing) {
    requireLocal(existing.recipient === body.to[0] && existing.invitePath === invite.pathname && existing.subject === body.subject);
  } else {
    appendFileSync(capturePath, JSON.stringify({ recipient: body.to[0], subject: body.subject,
      invitePath: invite.pathname, idempotencyKey, providerId }) + "\n", { mode: 0o600 });
    chmodSync(capturePath, 0o600);
  }
  return new Response(JSON.stringify({ id: providerId }), { status: 200,
    headers: { "content-type": "application/json", "x-flow1-local-provider": "true" } });
};
