/**
 * FLOW1: local HTTP adapter to the existing strict email provider fixture.
 * Binds only 127.0.0.1; outgoing email is never sent to Resend in CI.
 * The provider's whitelist, token, link and idempotency checks remain canonical.
 */
"use strict";
const { createServer } = require("node:http");
const { Buffer } = require("node:buffer");
require("./product-flow1-local-provider.cjs");

const PORT = 38081;
if (process.env.CI !== "true" ||
    process.env.FLOW1_LOCAL_PROVIDER !== "true" ||
    process.env.RESEND_API_KEY !== "flow1-local-synthetic" ||
    process.env.FLOW1_EMAIL_LOCAL_URL !== "http://127.0.0.1:38081/emails" ||
    process.env.NEXT_PUBLIC_SITE_URL !== "http://127.0.0.1:3000" ||
    process.env.NEXT_PUBLIC_SUPABASE_URL !== "http://127.0.0.1:54321") {
  throw new Error("FLOW1 local email adapter refused unsafe configuration");
}
const server = createServer(async (req, res) => {
  if (req.socket.remoteAddress !== "127.0.0.1" && req.socket.remoteAddress !== "::ffff:127.0.0.1") {
    res.writeHead(403).end("Forbidden"); return;
  }
  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, {"content-type":"text/plain"}).end("ok"); return;
  }
  if (req.method !== "POST" || req.url !== "/emails") {
    res.writeHead(404).end("Not Found"); return;
  }
  let size=0;
  const chunks=[];
  try {
    for await (const part of req) {
      size+=part.length;
      if (size>131072) { res.writeHead(413).end("Payload Too Large"); return; }
      chunks.push(part);
    }
    // Re-run all checks against the unchanged local-only Resend fixture.
    const response = await globalThis.fetch(new Request("https://api.resend.com/emails", {
      method:"POST",headers:req.headers,body:Buffer.concat(chunks)
    }));
    res.writeHead(response.status,{"content-type":"application/json"}).end(await response.text());
  } catch {
    res.writeHead(422,{"content-type":"application/json"}).end(JSON.stringify({
      message:"Local provider security guard refused synthetic request"
    }));
  }
});
server.listen(PORT,"127.0.0.1");
process.on("SIGTERM",()=>server.close());
process.on("SIGINT",()=>server.close());
