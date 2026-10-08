import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import ts from "typescript";

const read = (p) => fs.readFileSync(new URL(p, import.meta.url), "utf8");
const builder = read("../components/buyer-distinta-builder.tsx");
const wizard = read("../components/buyer-tube-guided-creator.tsx");
const calc = read("../components/public-tube-weight-calculator.tsx");
const guidanceSource = read("../lib/buyer-tube-guidance.ts");
const js = ts.transpileModule(guidanceSource, { compilerOptions: {
  target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext,
}}).outputText;
const guide = await import("data:text/javascript;base64," + Buffer.from(js).toString("base64"));
const option = (family, a, b, t) => ({
  id: family + a + b + t, family, sizeKey: family + ":" + a + ":" + b,
  sizeLabel: a + " × " + b + " mm", thicknessMm: t,
  description: "Tubo", weightKgM: 1, sourceName: "Knowledge",
});
const options = [
  option("square_tube", 100, 100, 4),
  option("square_tube", 120, 120, 5),
  option("rectangular_tube", 100, 50, 4),
  option("rectangular_tube", 100, 60, 5),
  option("round_tube", 114.3, 114.3, 4),
];

test("BD6 mass follows the public calculator corner-radii difference", () => {
  assert.match(calc, /outerRadiusMm: 1\.5 \* thicknessMm/);
  assert.match(calc, /outerRadiusMm: 2\.0 \* thicknessMm/);
  assert.match(guidanceSource, /7850 \/ 1_000_000/);
  const hot = guide.guidedTubeMassKgM("square_tube", "EN 10210", 100, 100, 5);
  const cold = guide.guidedTubeMassKgM("square_tube", "EN 10219", 100, 100, 5);
  assert.ok(Math.abs(hot - 14.7044) < 0.001);
  assert.ok(Math.abs(cold - 14.4096) < 0.001);
  assert.ok(hot > cold);
  assert.equal(guide.guidedTubeMassKgM("round_tube", "EN 10210", 114.3, 114.3, 4),
    guide.guidedTubeMassKgM("round_tube", "EN 10219", 114.3, 114.3, 4));
  assert.equal(guide.guidedTubeMassKgM("square_tube", "EN 10219", 10, 10, 5), null);
});

test("BD6 guided workflow requires norm and grade before weighted dimensions", () => {
  const d = guide.newGuidedTubeDraft();
  assert.equal(guide.guidedTubeMeasurement(d), null);
  Object.assign(d, { family: "square_tube", standard: "EN 10219", side: "100", thickness: "4" });
  assert.equal(guide.guidedTubeMeasurement(d), null);
  d.grade = "S355J2H";
  assert.equal(guide.guidedTubeMeasurement(d).description, "Tubo quadro 100 × 100 × 4 mm");
  for (const label of ["Tipo di tubo", "Norma", "Grado acciaio", "Dimensioni assistite"]) {
    assert.ok(wizard.includes(label));
  }
});

test("BD6 dimension autocomplete suggests 1xx values and constrains dependent fields", () => {
  const d = { ...guide.newGuidedTubeDraft(), family: "square_tube" };
  assert.deepEqual(guide.suggestedGuidedDimensions(options, d, "side", "1"), ["100", "120"]);
  Object.assign(d, { family: "rectangular_tube", width: "100" });
  assert.deepEqual(guide.suggestedGuidedDimensions(options, d, "height", "5"), ["50"]);
  d.height = "50";
  assert.deepEqual(guide.suggestedGuidedDimensions(options, d, "thickness", "4"), ["4"]);
  for (const item of ["ArrowDown", "ArrowUp", "Enter", "listbox", "aria-autocomplete"]) {
    assert.ok(wizard.includes(item));
  }
});

test("BD6 keeps normative mass and document requirements separate from tube metadata", () => {
  const d = guide.newGuidedTubeDraft();
  assert.equal(d.inspectionDocument, undefined);
  assert.equal(d.ceDop, undefined);
  assert.equal(d.iso9001, undefined);
  assert.doesNotMatch(wizard, /Documentazione richiesta/);
  assert.match(builder, /weightFromCatalogForStandard/);
  assert.match(builder, /guidedTubeMeasurement\(\{ \.\.\.guided, standard \}\)/);
  assert.match(builder, /createBuyerRfqCampaign/);
  assert.match(builder, /saveBuyerDistinta/);
  assert.match(builder, /copyDistinta/);
});
