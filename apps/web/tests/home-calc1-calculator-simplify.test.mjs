import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

// HOME-CALC1: simpler public calculator (one H1, typed size box, plural bars,
// fixed decimals, collapsed prices, one drawing, error shown once).
const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const model = read("../lib/calculator-dimension-discovery.ts");
const ui = read("../components/calculator-dimension-discovery.tsx");
const calc = read("../components/public-tube-weight-calculator.tsx");
const region = read("../components/calculator-region-switch.tsx");
const page = read("../app/(italian)/(public)/knowledge/tubes/page.tsx");
const inline = read("../lib/calculator-inline-distinta-copy.ts");

function loadModel() {
  const source = model.split("\n").filter((line) => !line.startsWith("import type")).join("\n");
  const out = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const mod = { exports: {} };
  new Function("module", "exports", out)(mod, mod.exports);
  return mod.exports;
}

test("HOME-CALC1 typed sizes become a calculation, never a published reference", () => {
  const m = loadModel();
  assert.deepEqual(
    { ...m.parseTypedDimension("168,3x6") },
    { id: "typed:168.3x6", family: "round_tube", primaryMm: 168.3, secondaryMm: 168.3, thicknessMm: 6, source: "typed" },
  );
  assert.equal(m.parseTypedDimension("Ø 60,3 × 3 mm")?.family, "round_tube");
  assert.equal(m.parseTypedDimension("100x100x4")?.family, "square_tube");
  const rect = m.parseTypedDimension("100*200*5");
  assert.equal(rect?.family, "rectangular_tube");
  assert.equal(rect?.primaryMm, 200);
  assert.equal(rect?.secondaryMm, 100);
  assert.equal(m.parseTypedDimension("30x16"), null, "thickness must be below half the diameter");
  assert.equal(m.parseTypedDimension("tubo tondo"), null);
  assert.equal(m.parseTypedDimension("1x2x3x4"), null);
  assert.match(ui, /parseTypedDimension\(query\)/);
  assert.match(ui, /data-typed-dimension/);
  assert.match(ui, /search:"Scrivi la misura"/);
});

test("HOME-CALC1 one title, no badge, no step numbers and no second headline", () => {
  assert.match(calc, /<h1[^>]*>Calcolo peso tubi in acciaio al metro<\/h1>/);
  assert.doesNotMatch(page, /<h1/);
  assert.doesNotMatch(calc, /t\("Gratis"\)/);
  assert.doesNotMatch(calc, /className=\{cinematic\.step\}/);
  assert.doesNotMatch(region, /styles\.headline/);
});

test("HOME-CALC1 plural bars, fixed decimals and the word distinta", () => {
  assert.match(calc, /const barsWord = \(count: number\) => \(count === 1 \? t\("barra"\) : t\("barre"\)\);/);
  assert.doesNotMatch(calc, /\$\{t\("barre"\)\}/);
  assert.match(calc, /minimumFractionDigits: digits,\n    maximumFractionDigits: digits,/);
  assert.match(calc, /formatKgM\(values\.kgM\)/);
  assert.match(calc, /formatTonnes\(values\.totalTonnes\)/);
  assert.match(calc, /commercialNumber\(commercialTonnes, 3\)/);
  assert.doesNotMatch(inline.slice(0, inline.indexOf("en:")), /carrello/);
});

test("HOME-CALC1 secondary tasks are on demand; the input error appears once", () => {
  assert.match(calc, /<details data-commercial-disclosure/);
  assert.match(calc, /open=\{commercialOpenInitially \|\| undefined\}/);
  assert.match(calc, /data-calc-length-other/);
  assert.match(calc, /inEmbeddedBuilder \|\| customLengthOpen/);
  assert.doesNotMatch(calc, /data-cinematic-product/);
  assert.match(calc, /\{!inEmbeddedBuilder && !values\.error \? \(\n\s*<div data-cinematic-stage/);
  assert.match(calc, /role="alert" data-calc-input-error/);
  assert.doesNotMatch(calc, /className=\{cinematic\.invalid\}/);
});
