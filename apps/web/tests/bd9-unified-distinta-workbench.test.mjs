import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (p) => fs.readFileSync(new URL(p, import.meta.url), "utf8");
const builder = read("../components/buyer-distinta-builder.tsx");
const wizard = read("../components/buyer-tube-guided-creator.tsx");
const css = read("../app/globals.css");

test("BD9 assisted configurator and editable article cards share one editor and preview", () => {
  const editorStart = builder.indexOf('className="bd7-workbench-editor"');
  const previewStart = builder.indexOf('className="bd7-preview"');
  assert.ok(editorStart > 0 && previewStart > editorStart);
  const editor = builder.slice(editorStart, previewStart);
  assert.match(editor, /<BuyerTubeGuidedCreator/);
  assert.match(editor, /className="bd9-rows-in-composer"/);
  assert.match(editor, /Righe della richiesta/);
  assert.match(editor, /className="bd5-row-card"/);
  assert.match(editor, /onClick=\{\(\) => duplicateLine\(line.id\)\}/);
  assert.match(editor, /onClick=\{addLine\}/);
  assert.match(editor, /id=\{"buyer-quantity-" \+ line.id\}/);
  assert.match(editor, /changeLineStandard\(line.id, event.target.value\)/);
  assert.match(editor, /formatNumber\(calc.tonnes, 3\)/);
  // The previous disconnected cards must not be repeated after the live preview.
  assert.doesNotMatch(builder.slice(previewStart), /className="bd5-row-card"/);
});

test("BD9 live preview excludes only the initial recyclable blank row from counts", () => {
  assert.match(builder, /const initialEmptyRow = lines.length === 1 && isUntouchedLine\(lines\[0\]\)/);
  assert.match(builder, /const activeLineCount = initialEmptyRow \? 0 : lines.length/);
  assert.match(builder, /aria-valuemax=\{activeLineCount\}/);
  assert.match(builder, /activeLineCount \? totals.completeLines \/ activeLineCount : 0/);
  assert.match(builder, /\{totals.completeLines\}\/\{activeLineCount\} righe/);
  assert.match(builder, /hidden=\{initialEmptyRow\}/);
  assert.match(builder, /Nessun articolo ancora inserito/);
  assert.match(builder, /calculated\[index\]\.tonnes/);
  assert.match(builder, /onDraftChange=\{setPreviewDraft\}/);
  assert.match(wizard, /onDraftChange\(draft\)/);
});

test("BD9 preserves per-line standard, guided weight, duplicate, copy and private handoff", () => {
  assert.match(builder, /function changeLineStandard\(id: string, standard: string\)/);
  assert.match(builder, /guidedTubeMeasurement\(\{ \.\.\.guided, standard \}\)/);
  assert.match(builder, /const copy = \{ \.\.\.source, id: duplicateId, quantity: "" \}/);
  assert.match(builder, /function addGuidedTube\(draft: GuidedTubeDraft\)/);
  assert.match(builder, /focusQuantityId.current = id/);
  assert.match(builder, /buildBuyerDistintaPlainText\(title, valid, documents\)/);
  assert.match(builder, /saveBuyerDistinta\(\{ title, lines, documents \}\)/);
  assert.match(builder, /createBuyerRfqCampaign\(savedId\)/);
});

test("BD9 unified editor has no desktop row overflow and has 2-column mobile controls", () => {
  assert.match(css, /\/\* BD9/);
  assert.match(css, /\.bd9-rows-in-composer/);
  assert.match(css, /\.bd7-workbench-editor \.bd5-row-card:has\(\.bd8-inline-norm\) \.bd52-core-fields/);
  assert.match(css, /grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)/);
  assert.match(css, /@media \(max-width: 600px\)/);
  assert.match(css, /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(css, /\.bd7-preview-list li\[hidden\] \{ display: none; \}/);
});
