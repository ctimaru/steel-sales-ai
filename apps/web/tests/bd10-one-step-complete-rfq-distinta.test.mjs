import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import ts from "typescript";

const read = (p) => fs.readFileSync(new URL(p, import.meta.url), "utf8");
const buyerSource = read("../lib/buyer-distinta.ts");
const guidanceSource = read("../lib/buyer-tube-guidance.ts");
const adapterSource = read("../lib/buyer-guided-commercial-line.ts");
const builder = read("../components/buyer-distinta-builder.tsx");
const creator = read("../components/buyer-tube-guided-creator.tsx");
const session = read("../lib/buyer-distinta-session-draft.ts");
const css = read("../app/globals.css");

const toJs = (source) => ts.transpileModule(
  source.replace(/^import[^;]+;\s*/gmu, ""),
  { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } },
).outputText.replace(/^export /gmu, "");

const buyer = new Function(toJs(buyerSource) + "\nreturn { calculateBuyerDistintaLine, calculateBuyerDistintaTotals };")();
const guidance = new Function(toJs(guidanceSource) + "\nreturn { newGuidedTubeDraft, guidedTubeMeasurement };")();
const convert = new Function(
  "calculateBuyerDistintaLine", "guidedTubeMeasurement",
  toJs(adapterSource) + "\nreturn guidedTubeToBuyerLine;",
)(buyer.calculateBuyerDistintaLine, guidance.guidedTubeMeasurement);

const tube = (standard, quantityMode = "bars", quantity = "2") => ({
  ...guidance.newGuidedTubeDraft(), family: "square_tube", standard,
  grade: "S355J2H", side: "100", thickness: "5", quantityMode, quantity,
});

test("BD10 confirmed wizard article includes every commercial field; same canonical totals as saved RFQ", () => {
  const a = convert(tube("EN 10219"), "cold");
  const b = convert(tube("EN 10210"), "hot");
  assert.ok(a && b);
  assert.equal(a.quantity, "2");
  assert.equal(a.barLengthM, "12");
  assert.equal(a.grade, "S355J2H");
  assert.equal(a.quantityMode, "bars");
  assert.notEqual(a.weightKgM, b.weightKgM);
  const calculated = [buyer.calculateBuyerDistintaLine(a), buyer.calculateBuyerDistintaLine(b)];
  assert.equal(calculated.every((row) => row.complete), true);
  const total = buyer.calculateBuyerDistintaTotals(calculated);
  assert.equal(total.completeLines, 2);
  assert.equal(total.totalMeters, 48);
  assert.ok(total.totalTonnes > 0);
});

test("BD10 refuses partial, fractional bar and bad target rows; allows meters and tonnes", () => {
  assert.equal(convert(tube("EN 10219", "bars", ""), "blank"), null);
  assert.equal(convert(tube("EN 10219", "bars", "2.5"), "fraction"), null);
  assert.equal(convert(tube("", "bars", "2"), "missing-standard"), null);
  assert.equal(convert({ ...tube("EN 10219"), targetEurT: "-1" }, "bad-target"), null);
  assert.equal(convert({ ...tube("EN 10219"), barLengthM: "0" }, "bad-bar"), null);
  const meters = convert(tube("EN 10219", "meters", "120"), "metres");
  const tonnes = convert(tube("EN 10210", "tonnes", "0,5"), "tonnes");
  assert.ok(meters && tonnes);
  assert.equal(buyer.calculateBuyerDistintaLine(meters).meters, 120);
  assert.equal(buyer.calculateBuyerDistintaLine(tonnes).tonnes, 0.5);
});

test("BD10 optional terms and quantity survive canonical creation and tab-scoped handoff", () => {
  const row = convert({
    ...tube("EN 10210"), quantity: "12", finish: "Nero",
    targetEurT: "850", note: "Consegna frazionata",
  }, "commercial");
  assert.ok(row);
  assert.equal(row.targetEurT, "850");
  assert.equal(row.finish, "Nero");
  assert.equal(row.note, "Consegna frazionata");
  for (const key of ["quantityMode", "quantity", "barLengthM", "finish", "targetEurT", "note"]) {
    assert.match(session, new RegExp(key + ":"));
  }
  assert.match(session, /normalGuidedDraft/);
  assert.match(session, /wizardDraft: normalGuidedDraft\(data.wizardDraft\)/);
});

test("BD10 user completes all article data in wizard and edits each row inside preview", () => {
  assert.match(creator, /05<\/span> Quantità e condizioni/);
  assert.match(creator, /value=\{draft.quantityMode\}/);
  assert.match(creator, /value=\{draft.quantity\}/);
  assert.match(creator, /value=\{draft.barLengthM\}/);
  assert.match(creator, /Inserisci articolo completo/);
  assert.match(creator, /disabled=\{!completeLine \|\| !canAdd\}/);
  assert.match(creator, /onAdd\(draft\)/);
  assert.match(builder, /const nextLine = guidedTubeToBuyerLine\(draft, id\)/);
  assert.match(builder, /if \(!nextLine\) return;/);
  const previewStart = builder.indexOf('className="bd7-preview"');
  assert.ok(previewStart > 0);
  assert.equal((builder.match(/className="bd5-row-card bd10-preview-row"/g) ?? []).length, 1);
  assert.match(builder.slice(previewStart), /className="bd10-row-summary"/);
  assert.match(builder.slice(previewStart), /hidden=\{!editOpen\}/);
  assert.match(builder.slice(previewStart), /onClick=\{\(\) => duplicateLine\(line.id\)\}/);
  assert.match(builder.slice(previewStart), /onClick=\{\(\) => removeLine\(line.id\)\}/);
  assert.match(builder, /saveBuyerDistinta\(\{ title, lines, documents \}\)/);
  assert.match(builder, /createBuyerRfqCampaign\(savedId\)/);
  assert.match(css, /\/\* BD10/);
  assert.match(css, /@media \(max-width: 640px\)/);
});
