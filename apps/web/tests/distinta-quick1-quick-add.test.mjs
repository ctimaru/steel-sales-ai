import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import ts from "typescript";

// DISTINTA-QUICK1 (founder decision, 17 Nov 2026): no AI/manual switch, no
// 5-step configurator; one fast «Aggiungi articolo» bar on /rfq-hub/distinta.

const read = (p) => fs.readFileSync(new URL(p, import.meta.url), "utf8");
const toJs = (source) => ts.transpileModule(
  source.replace(/^import[^;]+;\s*/gmu, ""),
  { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } },
).outputText.replace(/^export /gmu, "");

const calculateTubeSection = new Function(toJs(read("../lib/international-tube-mass.ts")) + "\nreturn calculateTubeSection;")();
const guidance = new Function("calculateTubeSection", toJs(read("../lib/buyer-tube-guidance.ts")) +
  "\nreturn { guidedTubeMassKgM, guidedFormatDimension };")(calculateTubeSection);
const catalog = new Function(toJs(read("../lib/buyer-distinta-catalog.ts")) +
  "\nreturn { buyerTubeFamilyLabels, buildBuyerDistintaCatalogOptions };")();
const quick = new Function("buyerTubeFamilyLabels", "guidedTubeMassKgM", "guidedFormatDimension",
  toJs(read("../lib/distinta-quick-add.ts")) +
  "\nreturn { buildQuickAddIndex, suggestQuickAdd, parseQuickAddMeasure, quickAddWeightText, normalizeQuickAddQuery };",
)(catalog.buyerTubeFamilyLabels, guidance.guidedTubeMassKgM, guidance.guidedFormatDimension);

const ref = (family, a, b, t, weight) => ({
  dimension_slug: family + "-" + a + "-" + b + "-" + t, product_family: family,
  outer_diameter_mm: family === "round_tube" ? a : null,
  width_mm: family === "round_tube" ? null : a,
  height_mm: family === "rectangular_tube" ? b : null,
  thickness_mm: t, weight_kg_m: weight, source_name: "EN",
});
const options = catalog.buildBuyerDistintaCatalogOptions([
  ref("square_tube", 100, 100, 4, 11.73), ref("square_tube", 100, 100, 5, 14.4),
  ref("square_tube", 80, 80, 4, 9.22), ref("rectangular_tube", 120, 80, 4, 11.73),
  ref("round_tube", 60.3, 60.3, 3, 4.24), ref("round_tube", 101.6, 101.6, 4, 9.63),
]);
const index = quick.buildQuickAddIndex(options);

test("published size typed as bare dimensions is the first suggestion", () => {
  const [first] = quick.suggestQuickAdd(index, "100x100x5", "EN 10219");
  assert.equal(first.kind, "catalog");
  assert.equal(first.description, "Tubo quadro 100 × 100 × 5 mm");
  assert.equal(first.weightKgM, 14.4);
  const round = quick.suggestQuickAdd(index, "tondo 60,3 × 3", "EN 10219")[0];
  assert.equal(round.kind, "catalog");
  assert.equal(round.family, "round_tube");
});

test("unpublished valid size gets a theoretical weight; invalid geometry does not", () => {
  const [first] = quick.suggestQuickAdd(index, "quadro 150x150x6", "EN 10219");
  assert.equal(first.kind, "computed");
  assert.equal(first.description, "Tubo quadro 150 × 150 × 6 mm");
  assert.ok(first.weightKgM > 25 && first.weightKgM < 28, String(first.weightKgM));
  assert.equal(quick.parseQuickAddMeasure("140x60x5", "EN 10219").family, "rectangular_tube");
  assert.equal(quick.parseQuickAddMeasure("88,9x4", "EN 10210").family, "round_tube");
  assert.equal(quick.parseQuickAddMeasure("tondo 100x100x5", "EN 10219"), null);
  assert.equal(quick.parseQuickAddMeasure("20x20x12", "EN 10219"), null, "thickness too large");
});

test("partial search browses published sizes and always ends with a free row", () => {
  const list = quick.suggestQuickAdd(index, "quadro 100", "EN 10219");
  assert.deepEqual(list.filter((s) => s.kind === "catalog").map((s) => s.description),
    ["Tubo quadro 100 × 100 × 4 mm", "Tubo quadro 100 × 100 × 5 mm"]);
  assert.equal(list.at(-1).kind, "free");
  const free = quick.suggestQuickAdd(index, "Lamiera S275 sp. 10", "EN 10219");
  assert.deepEqual(free.map((s) => s.kind), ["free"]);
  assert.deepEqual(quick.suggestQuickAdd(index, "  ", "EN 10219"), []);
});

test("weight text uses decimal comma and never a thousands separator", () => {
  assert.equal(quick.quickAddWeightText(14.4), "14,4");
  assert.equal(quick.quickAddWeightText(1234.56789), "1234,568");
});

test("the page has one way to add an article next to the chat", () => {
  const conversation = read("../components/commercial-rfq-conversation.tsx");
  assert.doesNotMatch(conversation, /Compila manualmente/);
  assert.doesNotMatch(conversation, /commercial-ai-focused-modes/);
  assert.match(conversation, /quickAdd/);
  const builder = read("../components/buyer-distinta-builder.tsx");
  assert.match(builder, /<DistintaQuickAddBar/);
  assert.match(builder, /focusAiIntake \? \(\s*<DistintaQuickAddBar/);
  assert.doesNotMatch(builder, /showManualTools/);
  const bar = read("../components/distinta-quick-add-bar.tsx");
  assert.match(bar, /role="combobox"/);
  assert.match(bar, /buildQuickAddIndex/);
  assert.match(bar, /useDeferredValue/);
  assert.match(bar, /come riga libera/);
  const page = read("../app/(italian)/(workspace)/rfq-hub/distinta/page.tsx");
  assert.match(page, /unstable_cache/);
});
