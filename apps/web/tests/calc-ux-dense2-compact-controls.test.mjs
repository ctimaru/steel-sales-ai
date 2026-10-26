import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const calculator = readFileSync(new URL("../components/public-tube-weight-calculator.tsx", import.meta.url), "utf8");

test("CALC-UX DENSE2 groups standard and shape without changing state handlers", () => {
  assert.match(calculator, /<select aria-label=\{t\("Norma"\)\} value=\{standard\}/);
  assert.match(calculator, /handleStandardChange\(event\.target\.value as StandardValue\)/);
  assert.match(calculator, /data-calc-shape-buttons/);
  assert.match(calculator, /setFamily\(option\.value as TubeFamily\)/);
});

test("CALC-UX DENSE2 removes redundant thickness disclosure and retains intelligent discovery", () => {
  assert.doesNotMatch(calculator, /group\/assist|Spessori suggeriti/);
  assert.match(calculator, /<CalculatorDimensionDiscovery/);
});

test("CALC-UX DENSE2 keeps editable length and compact quantity stepper", () => {
  assert.match(calculator, /lengthPresets\.some\(\(preset\) => preset === length\)/);
  assert.match(calculator, /aria-label=\{t\("Lunghezza barra personalizzata"\)\}/);
  assert.match(calculator, /grid-cols-\[36px_52px_36px\]/);
  assert.match(calculator, /setQuantity\(String\(Math\.max\(1, current - 1\)\)\)/);
  assert.match(calculator, /setQuantity\(String\(current \+ 1\)\)/);
});
