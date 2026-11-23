import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import ts from "typescript";

// COMM-RFQ-UX2.A introduced conversation + live preview on two columns.
// DISTINTA-SMART1 (founder decision, 23 Nov 2026) replaces that layout with one
// box above the Distinta. The invariants of UX2.A stay: AI proposals are never
// counted before approval, saving and RFQ creation reuse the authorized actions,
// nothing is sent to suppliers from this screen.

const read = name => fs.readFileSync(new URL(name, import.meta.url), "utf8");
const page = read("../app/(italian)/(workspace)/commercial/page.tsx");
const builder = read("../components/buyer-distinta-builder.tsx");
const box = read("../components/distinta-smart-box.tsx");
const sheet = read("../components/distinta-sheet.tsx");
const intake = read("../components/rfq-ai-intake-ux.tsx");
const review = read("../components/rfq-ai-text-review.tsx");

test("COMM-RFQ-UX2.A / DISTINTA-SMART1 one column: single box, then the Distinta", () => {
  assert.match(read("../app/(italian)/(workspace)/rfq-hub/distinta/page.tsx"), /Nuova richiesta/);
  assert.doesNotMatch(page, /1 · Analizza il materiale/);
  assert.match(builder, /data-testid="distinta-one-screen" className="mx-auto w-full max-w-4xl space-y-3"/);
  assert.ok(builder.indexOf("{smartIntake}") < builder.indexOf("<DistintaSheet"));
  assert.doesNotMatch(builder, /CommercialRfqWorkspace|CommercialRfqLivePreview|role="tablist"/);
  // The Distinta appears only once there is an article; before, a one-line hint.
  assert.match(builder, /\{activeLineCount > 0 \? \(\s*<DistintaSheet/);
  assert.match(builder, /data-testid="distinta-empty-hint"/);
  assert.equal((builder.match(/<BuyerDistintaBuilder/g) ?? []).length, 0, "Do not nest a second Distinta builder");
});

test("COMM-RFQ-UX2.A the box keeps unsent text in the AI owner, never reset by layout", () => {
  // The draft text lives in RfqAiIntakeUx; the box is a controlled view of it.
  assert.match(intake, /value: textDraft,/);
  assert.match(intake, /onChange: updateFocusedDraft,/);
  assert.match(box, /const value = ai\.value;/);
  assert.match(box, /ai\.onChange\(next\)/);
  assert.match(builder, /id="commercial-ai-intake"/);
});

test("COMM-RFQ-UX2.A keeps AI proposals separate from human confirmed lines", () => {
  // Proposals are reviewed inside the box thread; the Distinta only receives approved rows.
  assert.match(intake, /review: textResult \? \(/);
  assert.match(box, /data-testid="distinta-smart-review"/);
  assert.match(builder, /onInsertTextLines=\{insertRfqAiTextLines\}/);
  assert.match(builder, /line\.standard && line\.grade && calculateBuyerDistintaLine\(line\)\.complete/);
  assert.match(builder, /calculateBuyerDistintaTotals\(calculated\)/);
  assert.doesNotMatch(sheet, /candidates|proposals/);
  assert.match(review, /confirmed\[candidate\.candidateId\] && canConfirm\(candidate\)/);
});

test("COMM-RFQ-UX2.A reuses authorized saving and explicit RFQ creation without supplier sending", () => {
  assert.match(builder, /onSave=\{saveDistinta\}/);
  assert.match(builder, /onCreateRfq=\{createRfqHub\}/);
  assert.match(builder, /saveBuyerDistinta\(\{ title, lines, documents \}\)/);
  assert.match(builder, /createBuyerRfqCampaign\(savedId\)/);
  assert.match(sheet, /Salva solo la distinta/);
  assert.match(sheet, /Scegli i fornitori →/);
  assert.match(sheet, /Scegliere i fornitori non invia nulla: l’invio parte solo dopo la tua conferma/);
  assert.doesNotMatch(sheet + box, /sendBuyerDistinta|sendDistinta|sendEmail\(|saveBuyerDistinta|createBuyerRfqCampaign/);
  assert.doesNotMatch(builder, /sendBuyerDistinta|Invia direttamente a più fornitori/);
});

test("COMM-RFQ-UX2.A all new or changed TSX parses without syntax errors", () => {
  for (const [name, source] of [
    ["page.tsx", page], ["builder.tsx", builder], ["box.tsx", box], ["sheet.tsx", sheet], ["intake.tsx", intake],
  ]) {
    const parsed = ts.createSourceFile(name, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    assert.deepEqual(parsed.parseDiagnostics.map(d => ts.flattenDiagnosticMessageText(d.messageText, "\n")), [], name);
  }
});
