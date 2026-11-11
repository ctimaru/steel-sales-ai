/**
 * LOCAL CI ONLY. Preload AFTER product-flow1-local-provider.cjs into the
 * disposable Next.js process. Intercepts only the exact ten-line QA fixture.
 * Any other upstream remains blocked by the existing provider allowlist.
 */
"use strict";
const fixture = require("./comm-rfq-ux3a-local-fixture.cjs");
const fixtureB = require("./comm-rfq-ux3b-local-fixture.cjs");
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
  // COMM-AI-NATIVE1.C synthetic response, local-only and never sent to a provider.
  const last = Array.isArray(body?.messages) ? body.messages.at(-1) : null;
  if (last?.role === "user" &&
      body?.response_format?.json_schema?.name === "commercial_ai_native1c_answer") {
    const question = last.content;
    if (question === "Che cosa significa ASTM A500?") {
      return new Response(JSON.stringify({ error: "synthetic_provider_unavailable" }),
        { status: 503, headers: { "content-type": "application/json" } });
    }
    required(question === "Qual è la differenza tra EN 10219 ed EN 10210?");
    required(body.stream === false && body.messages[0]?.role === "system");
    const answer = {
      intent: "technical_question",
      answer: "EN 10219 riguarda profili strutturali cavi formati a freddo, EN 10210 riguarda profili strutturali cavi finiti a caldo. Questa è una spiegazione orientativa: verifica la versione applicabile e le specifiche ufficiali.",
      followUp: "",
    };
    return new Response(JSON.stringify({
      id: "comm-ai-native1c-synthetic",
      choices: [{ finish_reason: "stop", message: { content: JSON.stringify(answer) } }],
    }), { status: 200, headers: { "content-type": "application/json" } });
  }
  required(body?.messages?.[1]?.role === "user");
  const isUx3a = body.messages[1].content === fixture.text;
  const isUx3b = body.messages[1].content === fixtureB.text;
  required(isUx3a || isUx3b);
  required(body?.response_format?.json_schema?.name === "rfqai3_tube_candidates");
  required(body.stream === false && Array.isArray(body.messages) && body.messages.length === 2);
  const result = { intent: "buyer_request", lines: isUx3b ? fixtureB.lines : fixture.lines };
  return new Response(JSON.stringify({
    id: "flow1-ux3a-synthetic",
    choices: [{ finish_reason: "stop", message: { content: JSON.stringify(result) } }],
  }), {
    status:200,
    headers: { "content-type":"application/json", "x-ux3a-local-only":"true" },
  });
};
