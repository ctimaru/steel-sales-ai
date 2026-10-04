import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const calculator = fs.readFileSync(
  new URL("../components/public-tube-weight-calculator.tsx", import.meta.url),
  "utf8",
);

test("WC4.2 defines standard-specific preferred commercial thicknesses", () => {
  assert.match(calculator, /en10210:\s*\{[\s\S]*preferred: "6,3"/);
  assert.match(calculator, /en10219:\s*\{[\s\S]*preferred: "6"/);
  assert.match(calculator, /preferredThicknessForStandard/);
});

test("WC4.2 starts normative calculations from the selected standard preference", () => {
  assert.match(calculator, /const initialStandard = initialValues\?\.standard \?\? "en10219"/);
  assert.match(calculator, /initialValues\?\.thickness \?\? preferredThicknessForStandard\(initialStandard\)/);
});

test("WC4.2 switches the preferred thickness with the standard until the user edits it", () => {
  assert.match(calculator, /function handleStandardChange/);
  assert.match(calculator, /nextStandard !== "geometric" && !thicknessTouched/);
  assert.match(calculator, /setThickness\(preferredThicknessForStandard\(nextStandard\)\)/);
  assert.match(calculator, /setThicknessTouched\(true\)/);
});

test("WC4.2 applies the standard preference as the primary dimension is entered", () => {
  assert.match(calculator, /function handlePrimaryDimensionChange/);
  assert.match(calculator, /standard !== "geometric"/);
  assert.match(calculator, /parseNumber\(nextValue\)/);
  assert.match(calculator, /handlePrimaryDimensionChange\(setOuterDiameter/);
  assert.match(calculator, /handlePrimaryDimensionChange\(setWidth/);
});

test("WC4.2 exposes compact full-dimension commercial suggestions", () => {
  assert.match(calculator, /Assist \{currentStandard\.label\}/);
  assert.match(calculator, /preferito \{standardAssist\.preferred\} mm/);
  assert.match(calculator, /commercialSuggestionLabel/);
  assert.match(calculator, /standardAssist\.options\.map/);
  assert.match(calculator, /overflow-x-auto/);
});

test("WC4.2 keeps free calculation outside normative assistance", () => {
  assert.match(calculator, /standard === "geometric" \? null : standardThicknessAssist\[standard\]/);
  assert.match(calculator, /standard === "geometric" \? "6,3"/);
});
