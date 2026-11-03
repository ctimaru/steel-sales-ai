import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const source = read("../lib/commercial-rfq-line-correction.ts");
const intake = read("../components/rfq-ai-intake-ux.tsx");
const conversation = read("../components/commercial-rfq-conversation.tsx");
const reviewer = read("../components/rfq-ai-text-review.tsx");
const preview = read("../components/commercial-rfq-live-preview.tsx");
const builder = read("../components/buyer-distinta-builder.tsx");

const transpiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  fileName: "commercial-rfq-line-correction.ts",
});
const { parseCommercialRfqLineCorrection: parse } = await import(
  "data:text/javascript;base64," + Buffer.from(transpiled.outputText).toString("base64")
);

test("UX3.A corrects one of ten pending lines without filling unrelated fields", () => {
  const q = parse("riga 2: 20 barre", 10);
  assert.equal(q.ok, true);
  assert.equal(q.index, 1);
  assert.deepEqual(q.patch, { quantity: "20", quantityUnit: "PZ" });
  const length = parse("riga 10: lunghezza 6 m", 10);
  assert.deepEqual(length.patch, { lengthMm: "6000" });
  assert.deepEqual(parse("riga 1: qualità S355J2H", 10).patch, { grade: "S355J2H" });
  assert.deepEqual(parse("riga 3: norma EN 10219", 10).patch, { standard: "EN 10219" });
  assert.deepEqual(parse("riga 4: spessore 5,5 mm", 10).patch, { thicknessMm: "5.5" });
  assert.deepEqual(parse("riga 5: quantità 120 m", 10).patch, { quantity: "120", quantityUnit: "M" });
  assert.deepEqual(parse("riga 6: 2,5 tonnellate", 10).patch, { quantity: "2.5", quantityUnit: "T" });
});

test("UX3.A rejects unscoped, invalid, ambiguous or out-of-range commands", () => {
  for (const text of [
    "cambia tutte le righe a 20 barre", "riga 11: 20 barre", "riga 0: 20 barre",
    "riga 1: 2,5 barre", "riga 2: 0 barre", "riga 1: spessore 0 mm",
    "riga 1: lunghezza 300 m", "riga 2: norma ASTM A500",
    "riga 1: prezzo 999 euro", "riga 1: spediscila ai fornitori",
    "riga 1: 20 barre e 10 mm", "riga 2: elimina articolo", "riga 1: quantità 1e30 t",
  ]) {
    const result = parse(text, 10);
    assert.equal(result.ok, false, text);
    assert.ok(result.reason.length > 10, text);
  }
  assert.equal(parse("riga 1: 20 barre", 0).ok, false);
});

test("UX3.A routes each chat correction to review, not model memory or dispatch", () => {
  assert.ok(intake.includes("parseCommercialRfqLineCorrection(submitted, textResult.candidates.length)"));
  assert.ok(intake.includes("setPendingCorrection({"));
  assert.ok(intake.includes("candidateId: target.candidateId"));
  assert.ok(intake.includes('if (textResult) { setTextDraft(next); setTextError(""); return; }'));
  assert.ok(intake.includes("correction={pendingCorrection}"));
  assert.ok(intake.includes("setTextResult((current) => current ? { ...current, candidates: updated } : null)"));
  assert.ok(conversation.includes('hasProposals ? "Correggi riga"'));
  assert.ok(conversation.includes('disabled={pending}'));
  assert.ok(reviewer.includes('lastCorrectionSerial.current = correction.serial'));
  assert.ok(reviewer.includes("change(target, correction.patch)"));
  assert.ok(reviewer.includes('evidence.origin === "human"'));
  assert.ok(reviewer.includes("setConfirmed((previous) => ({ ...previous, [candidate.candidateId]: false }))"));
  assert.ok(reviewer.includes("if (!selected.length || transferStarted.current) return;"));
  assert.ok(preview.includes("const candidates = proposals?.candidates ?? []"));
  assert.ok(preview.includes("const calculated = approvedLines.map(calculateBuyerDistintaLine)"));
  assert.ok(preview.includes('correctedByBuyer ? "Modificato da te · da confermare"'));
  assert.ok(preview.includes("Le proposte non vengono salvate né conteggiate finché non le confermi."));
  assert.ok(builder.includes("function insertRfqAiTextLines(proposals: BuyerDistintaDraftLine[])"));
  assert.ok(intake.includes("if (!onInsertTextLines(items)) return false"));
  assert.ok(!source.includes("sendBuyerDistinta"));
  assert.ok(!source.includes("saveBuyerDistinta"));
});

test("UX3.A changed components parse as TypeScript / TSX", () => {
  for (const [name, text, kind] of [
    ["correction.ts", source, ts.ScriptKind.TS],
    ["rfq-ai-intake-ux.tsx", intake, ts.ScriptKind.TSX],
    ["commercial-rfq-conversation.tsx", conversation, ts.ScriptKind.TSX],
    ["rfq-ai-text-review.tsx", reviewer, ts.ScriptKind.TSX],
  ]) {
    const parsed = ts.createSourceFile(name, text, ts.ScriptTarget.Latest, true, kind);
    assert.deepEqual(parsed.parseDiagnostics.map(d => ts.flattenDiagnosticMessageText(d.messageText, "\n")), [], name);
  }
});
