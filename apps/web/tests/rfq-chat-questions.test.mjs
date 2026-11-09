import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const source = read("../lib/rfq-chat-questions.ts").replace(/^import type \{[^}]*\} from "[^"]+";\s*/u, "");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { buildRfqChatQuestions, describeRfqChatQuestions } = await import(
  "data:text/javascript;base64," + Buffer.from(compiled).toString("base64"));

const line = (...codes) => ({ issues: codes.map((code) => ({ code, severity: "warning", field: "x" })) });

test("RFQ chat: norma, dimensioni, quantità e unità sono obbligatorie", () => {
  const { questions, canCreateDraft, blockingCount } = buildRfqChatQuestions([
    line("missing_standard", "missing_dimensions", "missing_quantity", "unsupported_quantity_unit"),
  ]);
  assert.equal(blockingCount, 4);
  assert.equal(canCreateDraft, false);
  assert.deepEqual(questions.map((q) => q.field), ["standard", "dimensions", "quantity", "unit"]);
});

test("RFQ chat: qualità e lunghezza barra sono consigliate e non bloccano la bozza", () => {
  const result = buildRfqChatQuestions([line("missing_grade", "missing_bar_length")]);
  assert.equal(result.blockingCount, 0);
  assert.equal(result.canCreateDraft, true);
  assert.ok(result.questions.every((q) => q.kind === "advisory"));
});

test("RFQ chat: nessuna riga o nessuna segnalazione", () => {
  assert.equal(buildRfqChatQuestions([]).canCreateDraft, false);
  assert.equal(buildRfqChatQuestions([line()]).canCreateDraft, true);
  assert.equal(describeRfqChatQuestions([line()]), null);
});

test("RFQ chat: il messaggio indica la riga e come rispondere", () => {
  const text = describeRfqChatQuestions([line(), line("missing_quantity", "missing_grade")]);
  assert.match(text, /mi servono ancora alcuni dati/);
  assert.match(text, /Riga 2: manca la quantità; manca la qualità/);
  assert.match(text, /“riga 2: 20 barre”/);
  assert.doesNotMatch(text, /Riga 1:/);
});

test("RFQ chat: segnalazioni duplicate non ripetono la domanda", () => {
  const { questions } = buildRfqChatQuestions([line("missing_dimensions", "invalid_geometry")]);
  assert.equal(questions.length, 1);
});

test("RFQ chat: il turno dell'assistente usa le domande", () => {
  const ux = read("../components/rfq-ai-intake-ux.tsx");
  assert.match(ux, /describeRfqChatQuestions\(response\.result\.candidates\)/);
});
