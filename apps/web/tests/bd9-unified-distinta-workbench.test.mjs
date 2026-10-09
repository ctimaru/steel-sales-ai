import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (p) => fs.readFileSync(new URL(p, import.meta.url), "utf8");
const builder = read("../components/buyer-distinta-builder.tsx");
const wizard = read("../components/buyer-tube-guided-creator.tsx");
const css = read("../app/globals.css");

test("BD9/10 assisted creation and editable article list form one two-column workbench", () => {
  const editorStart = builder.indexOf('className="bd7-workbench-editor"');
  const previewStart = builder.indexOf('className="bd7-preview"');
  assert.ok(editorStart > 0 && previewStart > editorStart);
  const editor = builder.slice(editorStart, previewStart);
  const preview = builder.slice(previewStart, builder.indexOf('className="rounded-3xl', previewStart));
  assert.match(editor, /<BuyerTubeGuidedCreator/);
  assert.doesNotMatch(editor, /className="bd5-row-card/);
  assert.match(preview, /className="bd10-preview-lines"/);
  assert.match(preview, /className="bd5-row-card bd10-preview-row"/);
  assert.match(preview, /className="bd10-row-summary"/);
  assert.match(preview, /className="bd10-row-editor" hidden=\{!editOpen\}/);
  assert.match(preview, /onClick=\{\(\) => duplicateLine\(line.id\)\}/);
  assert.match(preview, /onClick=\{addLine\}/);
  assert.match(preview, /id=\{"buyer-quantity-" \+ line.id\}/);
  assert.match(preview, /changeLineStandard\(line.id, event.target.value\)/);
  assert.match(preview, /formatNumber\(calc.tonnes, 3\)/);
  assert.equal((builder.match(/className="bd5-row-card bd10-preview-row"/g) ?? []).length, 1);
});

test("BD9/10 preview excludes a recyclable placeholder but preserves manual editing", () => {
  assert.match(builder, /const initialEmptyRow = lines.length === 1 && isUntouchedLine\(lines\[0\]\) && !editingRows\[lines\[0\]\.id\]/);
  assert.match(builder, /const activeLineCount = initialEmptyRow \? 0 : lines.length/);
  assert.match(builder, /aria-valuemax=\{activeLineCount\}/);
  assert.match(builder, /activeLineCount \? totals.completeLines \/ activeLineCount : 0/);
  assert.match(builder, /\{totals.completeLines\}\/\{activeLineCount\} righe/);
  assert.match(builder, /hidden=\{initialEmptyRow && !editingRows\[line.id\]\}/);
  assert.match(builder, /Nessun articolo ancora inserito/);
  assert.match(builder, /onDraftChange=\{setPreviewDraft\}/);
  assert.match(wizard, /onDraftChange\(draft\)/);
});

test("BD9/10 canonical guided line and private handoff survive the cutover", () => {
  assert.match(builder, /function changeLineStandard\(id: string, standard: string\)/);
  assert.match(builder, /guidedTubeMeasurement\(\{ \.\.\.guided, standard \}\)/);
  assert.match(builder, /const copy = \{ \.\.\.source, id: duplicateId, quantity: "" \}/);
  assert.match(builder, /function addGuidedTube\(draft: GuidedTubeDraft\)/);
  assert.match(builder, /guidedTubeToBuyerLine\(draft, id\)/);
  assert.match(builder, /focusQuantityId.current = id/);
  assert.match(builder, /buildBuyerDistintaPlainText\(title, valid, documents\)/);
  assert.match(builder, /saveBuyerDistinta\(\{ title, lines, documents \}\)/);
  assert.match(builder, /createBuyerRfqCampaign\(savedId\)/);
});

test("BD9/10 layout retains adapted editor, mobile controls and inline preview", () => {
  assert.match(css, /\/\* BD9/);
  assert.match(css, /\/\* BD10/);
  assert.match(css, /\.bd10-preview-lines/);
  assert.match(css, /\.bd10-row-editor\[hidden\]/);
  assert.match(css, /\.bd10-commercial-grid/);
  assert.match(css, /@media \(max-width: 640px\)/);
  assert.match(css, /min-height: 44px/);
});
