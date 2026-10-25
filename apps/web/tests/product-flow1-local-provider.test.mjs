import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const preload = fileURLToPath(new URL("./product-flow1-local-provider.cjs", import.meta.url));
test("local provider captures one private invite per key and refuses external effects", () => {
  const temp = mkdtempSync(path.join(os.tmpdir(), "flow1-provider-"));
  const env = { ...process.env, NODE_OPTIONS: "", FLOW1_LOCAL_PROVIDER: "true", CI: "true",
    RUNNER_TEMP: temp, DEMOTEST23_WEB_URL: "http://127.0.0.1:3000",
    NEXT_PUBLIC_SITE_URL: "http://127.0.0.1:3000", NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
    RESEND_API_KEY: "flow1-local-synthetic" };
  try {
    execFileSync(process.execPath, ["-e", `
      const assert = require('node:assert/strict');
      let networkCalls = 0;
      globalThis.fetch = async (input, init) => {
        networkCalls += 1;
        assert.equal(input,'http://127.0.0.1:3000/local-redirect');
        assert.equal(init.redirect,'error');
        return new Response(null,{status:302,headers:{location:'https://example.com/'}});
      };
      require(${JSON.stringify(preload)});
      (async () => {
        const headers = {Authorization:'Bearer flow1-local-synthetic',
          'Content-Type':'application/json', 'Idempotency-Key':'rfqh3-11111111-1111-1111-1111-111111111111-invite-v1'};
        const body = {to:['rfqh14-producer@example.test'],subject:'RFQ: FLOW1 E2E LOCAL 390',
          text:'http://127.0.0.1:3000/rfq/respond/'+'a'.repeat(43),html:'<p>Local fixture</p>'};
        const send = (value=body, extra={}) => fetch('https://api.resend.com/emails',
          {method:'POST',headers,body:JSON.stringify(value),...extra});
        const first = await send();
        assert.equal(first.headers.get('x-flow1-local-provider'),'true');
        assert.deepEqual(await first.json(), await (await send()).json());
        await assert.rejects(send({...body,to:['real@example.com']}));
        await assert.rejects(send({...body,to:[...body.to,'rfqh14-trader@example.test']}));
        await assert.rejects(send({...body,text:'https://example.com/rfq/respond/'+'a'.repeat(43)}));
        await assert.rejects(send(body,{headers:{...headers,Authorization:'Bearer real-key'}}));
        await assert.rejects(fetch('https://api.resend.com/domains',{method:'POST'}));
        await assert.rejects(fetch('https://example.com/'));
        assert.equal(networkCalls,0,'No provider or external request may reach the real fetch');
        await fetch('http://127.0.0.1:3000/local-redirect');
        assert.equal(networkCalls,1,'Allowed local fetch must disable redirects');
      })().catch(() => { process.exitCode=1; });
    `], { env, stdio: "pipe" });
    const file = path.join(temp, "product-flow1-provider.jsonl");
    const captured = readFileSync(file, "utf8").trim().split("\n").map(JSON.parse);
    assert.equal(captured.length, 1);
    assert.equal(captured[0].recipient, "rfqh14-producer@example.test");
    assert.equal(statSync(file).mode & 0o777, 0o600);
    assert.ok(!readFileSync(file, "utf8").includes("flow1-local-synthetic"));
    assert.throws(() => execFileSync(process.execPath, ["--require", preload, "-e", ""], {
      env: { ...env, NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co" }, stdio: "pipe" }));
  } finally { rmSync(temp, { recursive: true, force: true }); }
});
