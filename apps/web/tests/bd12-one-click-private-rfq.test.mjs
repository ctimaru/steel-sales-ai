import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), "utf8");
const js = ts.transpileModule(read("../lib/buyer-distinta-rfq-one-step.ts"),
  { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { createPrivateRfqOneStep } = await import("data:text/javascript;base64," + Buffer.from(js).toString("base64"));
const builder = read("../components/buyer-distinta-builder.tsx");
const actions = read("../app/(public)/distinta/actions.ts");

test("BD12 saves once and creates a private campaign with one deliberate action", async () => {
  const calls = [];
  const saved = [];
  const result = await createPrivateRfqOneStep({
    existingDistintaId: null,
    save: async () => { calls.push("save"); return { ok: true, distintaId: "dist-1" }; },
    create: async id => { calls.push("create:" + id); return { ok: true, rfqId: "rfq-1" }; },
    onSaved: id => saved.push(id),
  });
  assert.deepEqual(calls, ["save","create:dist-1"]);
  assert.deepEqual(saved, ["dist-1"]);
  assert.deepEqual(result, { ok: true, distintaId: "dist-1", rfqId: "rfq-1" });
});

test("BD12 failed save never creates RFQ", async () => {
  let creations = 0;
  const result = await createPrivateRfqOneStep({
    existingDistintaId: null,
    save: async () => ({ ok: false, error: "Check lines" }),
    create: async () => { creations++; return { ok: true, rfqId: "unexpected" }; },
  });
  assert.equal(result.ok, false);
  assert.equal(result.phase, "save");
  assert.equal(creations, 0);
});

test("BD12 campaign failure preserves snapshot and retry skips duplicate saving", async () => {
  let saves = 0; let creates = 0;
  const save = async () => { saves++; return { ok: true, distintaId: "dist-1" }; };
  const create = async () => { creates++; return creates === 1 ? { ok: false, error: "Temporarily offline" } : { ok: true, rfqId: "rfq-2" }; };
  const first = await createPrivateRfqOneStep({ existingDistintaId: null, save, create });
  assert.equal(first.ok, false);
  assert.equal(first.phase, "create");
  assert.equal(first.distintaId, "dist-1");
  const second = await createPrivateRfqOneStep({ existingDistintaId: first.distintaId, save, create });
  assert.equal(second.ok, true);
  assert.equal(second.rfqId, "rfq-2");
  assert.equal(saves, 1);
  assert.equal(creates, 2);
});

test("BD12 rejected server action is handled without false success", async () => {
  const result = await createPrivateRfqOneStep({
    existingDistintaId: "saved-42",
    save: async () => { throw Error("must not save"); },
    create: async () => { throw Error("network"); },
  });
  assert.equal(result.ok, false);
  assert.equal(result.phase, "create");
  assert.equal(result.distintaId, "saved-42");
});

test("BD12 guards are UI+server side and no supplier dispatch occurs at RFQ creation", () => {
  assert.match(builder, /rfqInFlightRef\.current = true/);
  assert.match(builder, /!authenticated \|\| !draftReady \|\| restoreCandidate \|\| !allComplete/);
  assert.match(builder, /onClick=\{createRfqHub\}/);
  assert.match(builder, /Salva la distinta e crea la RFQ con un clic/);
  assert.match(builder, /nessun invio ai fornitori/);
  assert.match(actions, /\.eq\("source_distinta_id", distintaId\)/);
  assert.match(actions, /\.eq\("owner_user_id", authData\.user\.id\)/);
  assert.match(actions, /if \(previous\?\.id\) return \{ ok: true, rfqId: previous\.id \}/);
  const createFn = actions.slice(actions.indexOf("export async function createBuyerRfqCampaign"), actions.indexOf("export async function saveBuyerDistinta"));
  assert.doesNotMatch(createFn, /sendBuyerDistinta|resend\.com|rfqh1_add_supplier|marketplace_publish/);
});
