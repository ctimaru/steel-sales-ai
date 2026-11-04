/**
 * LOCAL CI ONLY. Preload AFTER product-flow1-local-provider.cjs into the
 * disposable Next.js process. Intercepts only the exact ten-line QA fixture.
 * Any other upstream remains blocked by the existing provider allowlist.
 */
"use strict";
const fixture = require("./comm-rfq-ux3a-local-fixture.cjs");
const originalFetch = globalThis.fetch;
const required = condition => {
  if (!condition) throw new Error("COMM-RFQ-UX3A local-only gateway denied");
};
required(process.env.CI === "true");
required(process.env.FLOW1_LOCAL_PROVIDER === "true");
required(process.env.DEMOTEST23_WEB_URL === "http://127.0.0.1:3000");
required(process.env.NEXT_PUBLIC_SUPABASE_URL === "http://127.0.0.1:54321");
required(process.env.AI_GATEWAY_API_KEY === "flow1-rfq-ux3a-synthetic");
required(typeof originalFetch === "function");

globalThis.fetch = async function commUx3aGatewayMock(input, init) {
  const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
  if (url.origin !== "https://ai-gateway.vercel.sh") {
    return originalFetch.call(globalThis, input, init);
  }
  const request = new Request(input, init);
  required(url.pathname === "/v1/chat/completions" && !url.search && request.method === "POST");
  required(request.headers.get("authorization") === "Bearer flow1-rfq-ux3a-synthetic");
  const body = await request.json();
  required(body?.messages?.[1]?.role === "user");
  required(body.messages[1].content === fixture.text);
  required(body?.response_format?.json_schema?.name === "rfqai3_tube_candidates");
  required(body.stream === false && Array.isArray(body.messages) && body.messages.length === 2);
  const result = { intent: "buyer_request", lines: fixture.lines };
  return new Response(JSON.stringify({
    id: "flow1-ux3a-synthetic",
    choices: [{ finish_reason: "stop", message: { content: JSON.stringify(result) } }],
  }), {
    status:200,
    headers: { "content-type":"application/json", "x-ux3a-local-only":"true" },
  });
};
