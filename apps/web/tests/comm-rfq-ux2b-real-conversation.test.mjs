import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const builder = read("../components/buyer-distinta-builder.tsx");
const intake = read("../components/rfq-ai-intake-ux.tsx");
const conversation = read("../components/commercial-rfq-conversation.tsx");
const reviewer = read("../components/rfq-ai-text-review.tsx");
const preview = read("../components/commercial-rfq-live-preview.tsx");

test("UX2.B uses an actual chat transcript with the composer in the bottom, not the legacy accordion", () => {
  assert.match(intake, /if \(focused && workspace\) \{/);
  assert.match(intake, /<CommercialRfqConversation/);
  assert.match(intake, /turns=\{conversationTurns\}/);
  assert.match(builder, /conversation=\{aiIntakePanel\}/);
  assert.doesNotMatch(builder, /mb-5 flex items-start gap-3.*data-testid="commercial-rfq-conversation-intro"/);
  assert.match(conversation, /data-testid="commercial-rfq-gpt-conversation"/);
  assert.match(conversation, /data-testid="commercial-rfq-message-thread"/);
  assert.match(conversation, /data-testid="commercial-rfq-user-message"/);
  assert.match(conversation, /data-testid="commercial-rfq-assistant-message"/);
  assert.match(conversation, /data-testid="commercial-rfq-sticky-composer"/);
  assert.match(conversation, /role="log"/);
  assert.match(conversation, /textarea id="rfqai2-text-input"/);
  assert.match(conversation, /event\.key !== "Enter" \|\| event\.shiftKey \|\| event\.nativeEvent\.isComposing/);
  assert.match(conversation, /disabled=\{pending \|\| hasProposals\}/);
  assert.match(conversation, /min-h-11/);
});

test("UX2.B the AI only interprets explicitly submitted individual text without uploading chat history", () => {
  assert.match(intake, /async function analyzeText\(\)/);
  assert.match(intake, /const submitted = textDraft\.trim\(\)/);
  assert.match(intake, /analyzeRfqAiFreeText\(submitted\)/);
  assert.match(intake, /if \(focused\) appendConversationTurn\("user", submitted\)/);
  assert.match(intake, /const count = response\.result\.candidates\.length/);
  assert.match(intake, /setTextResult\(response\.result\)/);
  assert.match(intake, /onPreviewChange\?\.\(response\.result\)/);
  assert.doesNotMatch(intake, /analyzeRfqAiFreeText\(conversationTurns|messages|history/);
  assert.match(conversation, /canSubmit = value\.trim\(\)\.length >= 3 && !pending && !hasProposals/);
  assert.match(intake, /if \(focused && submitted\.length < 12\)/);
  assert.match(intake, /nessuna misura è stata ancora confermata/);
  assert.match(conversation, /value\.trim\(\)\.length > 0 && value\.trim\(\)\.length < 12 \? "Completa richiesta"/);
});

test("UX2.B AI suggestions remain editable and separate from human approved Distinta", () => {
  assert.match(intake, /review=\{textResult \? \(/);
  assert.match(intake, /<RfqAiTextReview/);
  assert.match(reviewer, /onCandidatesChange\?: \(updated: RfqAiLineCandidate\[\]\) => void/);
  assert.match(reviewer, /onCandidatesChange\?\.\(candidates\)/);
  assert.match(intake, /onPreviewChange\?\.\(\{ \.\.\.textResult, candidates: updated \}\)/);
  assert.match(intake, /if \(!onInsertTextLines\(items\)\) return false/);
  assert.match(intake, /setTextResult\(null\)/);
  assert.match(intake, /Proposte scartate/);
  assert.match(intake, /articoli verificati alla Distinta a destra/);
  assert.match(preview, /const calculated = approvedLines\.map\(calculateBuyerDistintaLine\)/);
  assert.match(preview, /const candidates = proposals\?\.candidates \?\? \[\]/);
  assert.doesNotMatch(preview, /sendBuyerDistinta|sendDistinta|sendEmail\(/);
});

test("UX2.B preserves explicit save and RFQ governance and never exposes email send in focused workflow", () => {
  assert.match(builder, /onSave=\{saveDistinta\}/);
  assert.match(builder, /onCreateRfq=\{createRfqHub\}/);
  assert.match(builder, /<details hidden=\{focusAiIntake\}/);
  assert.match(builder, /onPreviewChange=\{setAiPreview\}/);
  assert.match(intake, /The focused Commerciale route renders a real conversational surface/);
  assert.match(conversation, /Nessuna/);
});

test("UX2.B new and changed TSX parses without JSX syntax errors", () => {
  for (const [name, source] of [
    ["commercial-rfq-conversation.tsx", conversation],
    ["rfq-ai-intake-ux.tsx", intake],
    ["rfq-ai-text-review.tsx", reviewer],
    ["buyer-distinta-builder.tsx", builder],
  ]) {
    const parsed = ts.createSourceFile(name, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    assert.deepEqual(parsed.parseDiagnostics.map(d => ts.flattenDiagnosticMessageText(d.messageText, "\n")), [], name);
  }
});
