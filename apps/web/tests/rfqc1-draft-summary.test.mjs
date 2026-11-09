import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const compiled = ts.transpileModule(read("../lib/rfqc1-draft-summary.ts"), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { summarizeRfqDraft } = await import("data:text/javascript;base64," + Buffer.from(compiled).toString("base64"));

const line = (extra = {}) => ({ description: "Tubo quadro 100 × 100 × 5 mm", standard: "EN 10219", grade: "S355J2H", quantity: 20, ...extra });
const sup = (extra = {}) => ({ name: "Rossi Tubi", email: "info@rossi.it", ...extra });
const base = { status: "draft", lines: [line()], suppliers: [sup()], dueAt: "2026-12-01T10:00:00Z" };

test("Chat RFQ passo 3: bozza completa è pronta alla revisione", () => {
  const r = summarizeRfqDraft(base);
  assert.equal(r.applies, true);
  assert.equal(r.ready, true);
  assert.deepEqual(r.missing, []);
});

test("Chat RFQ passo 3: norma, quantità, fornitori ed email sono bloccanti", () => {
  assert.equal(summarizeRfqDraft({ ...base, lines: [line({ standard: "" })] }).ready, false);
  assert.equal(summarizeRfqDraft({ ...base, lines: [line({ quantity: 0 })] }).ready, false);
  assert.equal(summarizeRfqDraft({ ...base, suppliers: [] }).ready, false);
  assert.equal(summarizeRfqDraft({ ...base, suppliers: [sup({ email: null })] }).ready, false);
  assert.equal(summarizeRfqDraft({ ...base, lines: [] }).ready, false);
});

test("Chat RFQ passo 3: qualità e scadenza sono consigliate e non bloccano", () => {
  const r = summarizeRfqDraft({ ...base, lines: [line({ grade: null })], dueAt: null });
  assert.equal(r.ready, true);
  assert.equal(r.checks.filter((c) => !c.ok && !c.blocking).length, 2);
});

test("Chat RFQ passo 3: non si applica a RFQ già inviate", () => {
  for (const status of ["launched", "collecting", "awarded", "closed"]) {
    assert.equal(summarizeRfqDraft({ ...base, status }).applies, false);
    assert.equal(summarizeRfqDraft({ ...base, status }).ready, false);
  }
});

test("Chat RFQ passo 3: il componente non invia e porta al pannello con conferma finale", () => {
  const ui = read("../components/rfqc1-draft-summary.tsx");
  assert.match(ui, /href="#rfq-review-send"/);
  assert.doesNotMatch(ui, /launchBuyerRfq|use server|onClick/);
  assert.match(ui, /Nessuna richiesta è stata inviata/);
  const chat = read("../components/rfqc1-chat-workspace.tsx");
  assert.match(chat, /<Rfqc1DraftSummary[\s\S]{0,200}canExecute=\{props\.canExecute && !props\.readOnlyByProfile\}/);
});
