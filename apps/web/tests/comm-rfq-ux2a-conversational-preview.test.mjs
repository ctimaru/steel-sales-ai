import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import ts from "typescript";

const read = name => fs.readFileSync(new URL(name, import.meta.url), "utf8");
const page = read("../app/(italian)/(workspace)/commercial/page.tsx");
const builder = read("../components/buyer-distinta-builder.tsx");
const workspace = read("../components/commercial-rfq-workspace.tsx");
const preview = read("../components/commercial-rfq-live-preview.tsx");
const intake = read("../components/rfq-ai-intake-ux.tsx");
const review = read("../components/rfq-ai-text-review.tsx");

test("COMM-RFQ-UX2.A replaces the step form with an integrated conversation and live preview", () => {
  assert.match(page, /Nuova distinta/);
  assert.doesNotMatch(page, /1 · Analizza il materiale/);
  assert.doesNotMatch(page, /2 · Verifica gli articoli/);
  assert.match(builder, /<CommercialRfqWorkspace/);
  assert.match(builder, /<CommercialRfqLivePreview/);
  assert.match(workspace, /data-testid="commercial-rfq-chat-workspace"/);
  assert.match(workspace, /xl:grid-cols-/);
  assert.match(workspace, /xl:sticky/);
  assert.match(workspace, /data-testid="commercial-rfq-conversation-pane"/);
  assert.match(workspace, /data-testid="commercial-rfq-preview-pane"/);
  assert.equal((builder.match(/<BuyerDistintaBuilder/g) ?? []).length, 0, "Do not nest a second Distinta builder");
});

test("COMM-RFQ-UX2.A mobile tab keeps both panels mounted and never resets unsent text", () => {
  assert.match(workspace, /useState<"chat" \| "preview">\("chat"\)/);
  assert.match(workspace, /role="tablist"/);
  assert.match(workspace, /aria-selected=\{mobileView === "chat"\}/);
  assert.match(workspace, /aria-selected=\{mobileView === "preview"\}/);
  assert.match(workspace, /className=\{mobileView === "preview" \? "hidden min-w-0 xl:block"/);
  assert.match(workspace, /className=\{mobileView === "chat" \? "hidden min-w-0 xl:block"/);
  assert.match(builder, /id="commercial-ai-intake"/);
  assert.match(builder, /hidden=\{focusAiIntake && !showManualTools\}/);
});

test("COMM-RFQ-UX2.A keeps AI proposals separate from human confirmed lines", () => {
  assert.match(builder, /const \[aiPreview, setAiPreview\] = useState<RfqAiTextDraftResult \| null>\(null\)/);
  assert.match(builder, /proposals=\{aiPreview\}/);
  assert.match(builder, /approvedLines=\{activeLineCount \? lines : \[\]\}/);
  assert.match(intake, /onPreviewChange\?\.\(response\.result\)/);
  assert.match(intake, /onPreviewChange\?\.\(null\)/);
  assert.match(preview, /const candidates = proposals\?\.candidates \?\? \[\]/);
  assert.match(preview, /const calculated = approvedLines\.map\(calculateBuyerDistintaLine\)/);
  assert.match(preview, /calculateBuyerDistintaTotals\(calculated\)/);
  assert.doesNotMatch(preview, /candidates\.map\(calculateBuyerDistintaLine\)/);
  assert.match(preview, /Le proposte non vengono salvate né conteggiate/);
  assert.match(review, /confirmed\[candidate\.candidateId\] && canConfirm\(candidate\)/);
});

test("COMM-RFQ-UX2.A reuses authorized saving and explicit RFQ creation without supplier sending", () => {
  assert.match(builder, /onSave=\{saveDistinta\}/);
  assert.match(builder, /onCreateRfq=\{createRfqHub\}/);
  assert.match(builder, /saveBuyerDistinta\(\{ title, lines, documents \}\)/);
  assert.match(builder, /createBuyerRfqCampaign\(savedId\)/);
  assert.match(preview, /Salva distinta privata/);
  assert.match(preview, /Crea RFQ privata/);
  assert.match(preview, /Salvare o creare una RFQ privata non invia messaggi ai fornitori/);
  assert.match(preview, /disabled=\{!canSave \|\| Boolean\(savedId\)\}/);
  assert.doesNotMatch(preview, /sendBuyerDistinta|sendDistinta|sendEmail\(/);
  assert.match(builder, /<details hidden=\{focusAiIntake\}/);
});

test("COMM-RFQ-UX2.A all new or changed TSX parses without syntax errors", () => {
  for (const [name, source] of [
    ["page.tsx", page], ["builder.tsx", builder], ["workspace.tsx", workspace],
    ["preview.tsx", preview], ["intake.tsx", intake],
  ]) {
    const parsed = ts.createSourceFile(name, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    assert.deepEqual(parsed.parseDiagnostics.map(d => ts.flattenDiagnosticMessageText(d.messageText, "\n")), [], name);
  }
});
