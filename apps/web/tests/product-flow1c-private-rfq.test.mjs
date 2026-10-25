import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
const require = createRequire(import.meta.url);
const ts = require("typescript");
const source = readFileSync(new URL("../lib/buyer-distinta-rfq-one-step.ts", import.meta.url), "utf8");
const javascript = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { createPrivateRfqOneStep } = await import("data:text/javascript;base64," + Buffer.from(javascript).toString("base64"));

test("FLOW1C: creates private RFQ from existing saved bill without resaving or dispatch", async () => {
  let saves = 0, creates = 0;
  const result = await createPrivateRfqOneStep({
    existingDistintaId: "bill-1",
    save: async () => { saves++; return { ok: true, distintaId: "wrong" }; },
    create: async id => { creates++; assert.equal(id, "bill-1"); return { ok: true, rfqId: "rfq-1" }; },
  });
  assert.deepEqual(result, { ok: true, distintaId: "bill-1", rfqId: "rfq-1" });
  assert.equal(saves, 0);
  assert.equal(creates, 1);
});

test("FLOW1C: successful save followed by failed RFQ retains bill id for safe retry", async () => {
  let saves = 0, creates = 0, acknowledged = null;
  const input = {
    existingDistintaId: null,
    save: async () => { saves++; return { ok: true, distintaId: "bill-2" }; },
    create: async id => { creates++; assert.equal(id, "bill-2"); return creates === 1 ? {ok:false,error:"temporary"} : {ok:true,rfqId:"rfq-2"}; },
    onSaved: id => { acknowledged = id; },
  };
  const failed = await createPrivateRfqOneStep(input);
  assert.equal(failed.ok, false);
  assert.equal(failed.phase, "create");
  assert.equal(failed.distintaId, "bill-2");
  assert.equal(acknowledged, "bill-2");
  const retried = await createPrivateRfqOneStep({...input,existingDistintaId:failed.distintaId});
  assert.equal(retried.ok, true);
  assert.equal(retried.rfqId, "rfq-2");
  assert.equal(saves, 1, "Never save the same acknowledged bill twice");
});

test("FLOW1C: save failure fails closed and never attempts RFQ creation", async () => {
  let creates = 0;
  const result = await createPrivateRfqOneStep({
    existingDistintaId: null,
    save: async () => ({ok:false,error:"invalid lines"}),
    create: async () => {creates++;return {ok:true,rfqId:"unexpected"};},
  });
  assert.equal(result.ok, false);
  assert.equal(result.phase, "save");
  assert.equal(result.distintaId, null);
  assert.equal(creates, 0);
});
