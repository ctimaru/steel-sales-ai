import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const calculator = fs.readFileSync(
  new URL("../components/public-tube-weight-calculator.tsx", import.meta.url),
  "utf8",
);

test("WC3 preserves the forward commercial mass engine", () => {
  assert.match(calculator, /const kgM =/);
  assert.match(calculator, /const kgBar = kgM != null && l != null \? kgM \* l : null/);
  assert.match(calculator, /const totalKg = kgBar != null && qty != null \? kgBar \* qty : null/);
  assert.match(calculator, /const totalTonnes = totalKg != null \? totalKg \/ 1000 : null/);
  assert.match(calculator, /const totalMeters = l != null && qty != null \? l \* qty : null/);
});

test("WC3 calculates whole-bar requirements from a target tonnage", () => {
  assert.match(calculator, /const \[targetTonnes, setTargetTonnes\] = useState\(initialValues\?\.targetTonnes \?\? ""\)/);
  assert.match(calculator, /const targetBarsExact =/);
  assert.match(calculator, /\(targetT \* 1000\) \/ kgBar/);
  assert.match(calculator, /Math\.ceil\(targetBarsExact\)/);
  assert.match(calculator, /const targetActualTonnes = targetActualKg != null \? targetActualKg \/ 1000 : null/);
});

test("WC3 exposes linked commercial metres and tonnage without mutating bars", () => {
  assert.match(calculator, /commercialShownMetres/);
  assert.match(calculator, /commercialShownTonnes/);
  assert.match(calculator, /setCommercialQuantity/);
  assert.match(calculator, /commercialWeight/);
  assert.match(calculator, /const targetBarsExact =/);
});

test("WC3 lets users adjust bar quantity without retyping the field", () => {
  assert.match(calculator, /aria-label=\{t\("Riduci di una barra"\)\}/);
  assert.match(calculator, /aria-label=\{t\("Aumenta di una barra"\)\}/);
  assert.match(calculator, /setQuantity\(String\(Math\.max\(1, current - 1\)\)\)/);
  assert.match(calculator, /setQuantity\(String\(current \+ 1\)\)/);
});

test("WC3 makes total linear meters visible alongside mass outputs", () => {
  assert.match(calculator, /Metri totali/);
  assert.match(calculator, /values\.totalMeters/);
  assert.match(calculator, /grid-cols-3/);
});
