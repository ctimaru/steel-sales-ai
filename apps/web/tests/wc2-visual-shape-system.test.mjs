import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const calculator = fs.readFileSync(
  new URL("../components/public-tube-weight-calculator.tsx", import.meta.url),
  "utf8",
);

test("WC2 exposes a parametric visual system for all supported tube families", () => {
  assert.match(calculator, /function ParametricShapeDiagram/);
  assert.match(calculator, /family === "round_tube"/);
  assert.match(calculator, /family === "square_tube"/);
  assert.match(calculator, /family === "rectangular_tube"/);
  assert.match(calculator, /innerScale/);
  assert.match(calculator, /outerW/);
  assert.match(calculator, /outerH/);
});

test("WC2 binds the visual section directly to live calculator dimensions", () => {
  assert.match(calculator, /outerDiameter=\{outerDiameter\}/);
  assert.match(calculator, /width=\{width\}/);
  assert.match(calculator, /height=\{height\}/);
  assert.match(calculator, /thickness=\{thickness\}/);
  assert.match(calculator, /Le quote seguono i valori inseriti/);
  assert.match(calculator, /Vista proporzionale/);
});

test("WC2 renders dimension callouts around the section", () => {
  assert.match(calculator, /primaryDimension/);
  assert.match(calculator, /secondaryDimension/);
  assert.match(calculator, /thicknessDimension/);
  assert.match(calculator, /Ø \$\{formatNumber\(d, 2\)\} mm/);
  assert.match(calculator, /B \$\{formatNumber\(b, 2\)\} mm/);
  assert.match(calculator, /H \$\{formatNumber\(h, 2\)\} mm/);
  assert.match(calculator, /t \$\{formatNumber\(t, 2\)\} mm/);
});

test("WC2 keeps the SVG accessible and responsive", () => {
  assert.match(calculator, /viewBox="0 0 264 210"/);
  assert.match(calculator, /role="img"/);
  assert.match(calculator, /aria-label=\{accessibleLabel\}/);
  assert.match(calculator, /className="mx-auto mt-3 block h-auto w-full max-w-\[30rem\]"/);
  assert.match(calculator, /<title>\{accessibleLabel\}<\/title>/);
});

test("WC2 preserves selected hover and keyboard focus states on shape controls", () => {
  assert.match(calculator, /aria-pressed=\{selected\}/);
  assert.match(calculator, /hover:-translate-y-0\.5/);
  assert.match(calculator, /focus-visible:ring-4 focus-visible:ring-\[#b8d2c8\]/);
  assert.match(calculator, /focus-visible:ring-4 focus-visible:ring-\[#d9e8e2\]/);
});
