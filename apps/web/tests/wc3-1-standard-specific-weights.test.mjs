import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const calculator = fs.readFileSync(
  new URL("../components/public-tube-weight-calculator.tsx", import.meta.url),
  "utf8",
);
const page = fs.readFileSync(
  new URL("../app/(public)/knowledge/tubes/page.tsx", import.meta.url),
  "utf8",
);

test("WC3.1 applies EN 10210 corner radii to square and rectangular sections", () => {
  assert.match(calculator, /standard === "en10210"/);
  assert.match(calculator, /outerRadiusMm: 1\.5 \* thicknessMm/);
  assert.match(calculator, /innerRadiusMm: 1\.0 \* thicknessMm/);
});

test("WC3.1 applies EN 10219 thickness-dependent corner radii", () => {
  assert.match(calculator, /thicknessMm <= 6/);
  assert.match(calculator, /outerRadiusMm: 2\.0 \* thicknessMm/);
  assert.match(calculator, /innerRadiusMm: 1\.0 \* thicknessMm/);
  assert.match(calculator, /thicknessMm <= 10/);
  assert.match(calculator, /outerRadiusMm: 2\.5 \* thicknessMm/);
  assert.match(calculator, /innerRadiusMm: 1\.5 \* thicknessMm/);
  assert.match(calculator, /outerRadiusMm: 3\.0 \* thicknessMm/);
  assert.match(calculator, /innerRadiusMm: 2\.0 \* thicknessMm/);
});

test("WC3.1 uses the standard rounded-corner area and fixed steel mass coefficient", () => {
  assert.match(calculator, /2 \* thicknessMm \* \(widthMm \+ heightMm - 2 \* thicknessMm\)/);
  assert.match(calculator, /\(4 - Math\.PI\) \* \(outerRadiusMm \*\* 2 - innerRadiusMm \*\* 2\)/);
  assert.match(calculator, /const effectiveDensityKgM3 = standard === "geometric" \? rho : 7850/);
  assert.match(calculator, /const areaMm2 = standard === "geometric" \? freeAreaMm2 : standardAreaMm2/);
});

test("WC3.1 keeps custom density and sharp-corner geometry exclusive to free calculation", () => {
  assert.match(calculator, /standard === "geometric" && \(rho == null \|\| rho <= 0\)/);
  assert.match(calculator, /b \* b - \(b - 2 \* t\) \* \(b - 2 \* t\)/);
  assert.match(calculator, /b \* h - \(b - 2 \* t\) \* \(h - 2 \* t\)/);
  assert.match(calculator, /Nel calcolo libero la densità è modificabile/);
  assert.match(calculator, /La densità non è modificabile in modalità normativa/);
});

test("WC3.1 prevents a generic published reference from replacing the selected standard result", () => {
  assert.match(calculator, /const exactReference = !error && standard === "geometric"/);
  assert.match(calculator, /Metodo della norma applicato/);
  assert.match(calculator, /Massa lineare/);
  assert.match(calculator, /questo valore alimenta anche peso per barra, tonnellaggio e calcolo inverso/i);
});

test("WC3.1 explains the EN 10210 vs EN 10219 mass difference publicly", () => {
  assert.match(page, /raggi di raccordo di calcolo diversi/);
  assert.match(page, /EN 10210 ed EN 10219 usano raggi di raccordo/);
  assert.match(page, /Calcolo libero/);
});

test("WC3.1 formula reproduces the expected standard split for SHS 100x100x5", () => {
  const t = 5;
  const b = 100;
  const h = 100;
  const mass = (outerRadiusMm, innerRadiusMm) => {
    const areaMm2 =
      2 * t * (b + h - 2 * t) -
      (4 - Math.PI) * (outerRadiusMm ** 2 - innerRadiusMm ** 2);
    return areaMm2 * 0.00785;
  };

  const en10210 = mass(1.5 * t, 1.0 * t);
  const en10219 = mass(2.0 * t, 1.0 * t);

  assert.ok(Math.abs(en10210 - 14.7044) < 0.001);
  assert.ok(Math.abs(en10219 - 14.4096) < 0.001);
  assert.ok(en10210 > en10219);
});
