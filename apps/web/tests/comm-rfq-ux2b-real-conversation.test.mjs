import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

// UX2.B made the AI a real conversation. DISTINTA-SMART1 keeps the same AI
// owner (RfqAiIntakeUx) and its rules, rendered as the thread under the single box.

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const builder = read("../components/buyer-distinta-builder.tsx");
const intake = read("../components/rfq-ai-intake-ux.tsx");
const box = read("../components/distinta-smart-box.tsx");
const reviewer = read("../components/rfq-ai-text-review.tsx");

test("UX2.B the focused view shows the recent turns under the box, not the legacy accordion", () => {
  assert.match(intake, /if \(focused && workspace && focusedView\) \{/);
  assert.match(intake, /turns: conversationTurns,/);
  assert.match(builder, /focusedView=\{\(controls\) => \(/);
  assert.match(box, /data-testid="distinta-smart-thread"/);
  assert.match(box, /role="log"/);
  assert.match(box, /const recentTurns = ai\.turns\.slice\(-3\)/);
  assert.match(box, /role="combobox"/);
  // Enter analyses, Shift+Enter is a new line, IME composition is never submitted.
  assert.match(box, /if \(event\.nativeEvent\.isComposing\) return;/);
  assert.match(box, /if \(event\.key !== "Enter" \|\| event\.shiftKey\) return;/);
  // Disabled until the draft is ready (hydration) and while the AI is working.
  assert.match(box, /disabled=\{disabled \|\| ai\.pending\}/);
  assert.match(builder, /disabled=\{!draftReady \|\| Boolean\(restoreCandidate\)\}/);
  assert.ok(box.includes('ai.hasProposals ? "Correggi"'));
  assert.ok(intake.includes("parseCommercialRfqLineCorrection(submitted, textResult.candidates.length)"));
});

test("UX2.B the AI only interprets explicitly submitted individual text without uploading chat history", () => {
  assert.match(intake, /async function analyzeText\(\)/);
  assert.match(intake, /return runTextAnalysis\(textDraft\)/);
  assert.match(intake, /analyzeRfqAiFreeText\(submitted\)/);
  assert.match(intake, /if \(focused\) appendConversationTurn\("user", submitted\)/);
  assert.match(intake, /const count = response\.result\.candidates\.length/);
  assert.match(intake, /setTextResult\(response\.result\)/);
  assert.doesNotMatch(intake, /analyzeRfqAiFreeText\((?:conversationTurns|messages|history)\)/);
  assert.ok(box.includes("if (disabled || ai.pending || value.trim().length < 3) return;"));
  assert.ok(intake.includes("if (textResult && focused) {"));
  assert.ok(intake.includes("setPendingCorrection({"));
  assert.match(intake, /if \(focused && submitted\.length < 12\)/);
  assert.match(intake, /nessuna misura è stata ancora confermata/);
});

test("UX2.B AI suggestions remain editable and separate from human approved Distinta", () => {
  assert.match(intake, /review: textResult \? \(/);
  assert.match(intake, /<RfqAiTextReview/);
  assert.match(reviewer, /onCandidatesChange\?: \(updated: RfqAiLineCandidate\[\]\) => void/);
  assert.match(reviewer, /onCandidatesChange\?\.\(candidates\)/);
  assert.match(intake, /onPreviewChange\?\.\(\{ \.\.\.textResult, candidates: updated \}\)/);
  assert.match(intake, /if \(!onInsertTextLines\(items\)\) return false/);
  assert.match(intake, /setTextResult\(null\)/);
  assert.match(intake, /Proposte scartate/);
  assert.match(intake, /articoli verificati alla distinta qui sotto/);
  assert.doesNotMatch(box, /sendBuyerDistinta|sendDistinta|sendEmail\(/);
});

test("UX2.B preserves explicit save and RFQ governance and never exposes email send in focused workflow", () => {
  assert.match(builder, /onSave=\{saveDistinta\}/);
  assert.match(builder, /onCreateRfq=\{createRfqHub\}/);
  assert.doesNotMatch(builder, /sendBuyerDistinta|Invia direttamente a più fornitori/); // DISTINTA-ONE1
  assert.match(intake, /The focused \/rfq-hub\/distinta route renders the single DISTINTA-SMART1 box/);
  assert.match(box, /Invio: l’assistente prepara gli articoli, tu li controlli prima che entrino in distinta/);
});

test("UX2.B new and changed TSX parses without JSX syntax errors", () => {
  for (const [name, source] of [
    ["distinta-smart-box.tsx", box],
    ["rfq-ai-intake-ux.tsx", intake],
    ["rfq-ai-text-review.tsx", reviewer],
    ["buyer-distinta-builder.tsx", builder],
  ]) {
    const parsed = ts.createSourceFile(name, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    assert.deepEqual(parsed.parseDiagnostics.map(d => ts.flattenDiagnosticMessageText(d.messageText, "\n")), [], name);
  }
});
