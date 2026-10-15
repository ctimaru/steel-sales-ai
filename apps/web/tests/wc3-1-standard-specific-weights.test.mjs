import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const calculator = read("../components/public-tube-weight-calculator.tsx");
const engineCode = read("../lib/international-tube-mass.ts");
const page = read("../app/(public)/knowledge/tubes/page.tsx");
const output = ts.transpileModule(engineCode, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const engine = await import("data:text/javascript;base64," + Buffer.from(output).toString("base64"));
const section = (standard, shape="square", t=5, b=100, h=100) =>
  engine.calculateTubeSection({ standard, shape, widthMm:b, heightMm:h,
    thicknessMm:t, densityKgM3:7850 });

test("WC3.1 canonical EN 10210 nominal radii for SHS/RHS", () => {
  assert.deepEqual(engine.standardCornerRadii("en10210", 5), {
    outerRadiusMm:7.5, innerRadiusMm:5,
  });
  const actual=section("en10210");
  assert.equal(actual.ok,true);
  assert.equal(actual.outerRadiusMm,7.5);
  assert.equal(actual.innerRadiusMm,5);
});

test("WC3.1 canonical EN 10219 thickness bands <=6, <=10, >10", () => {
  for (const [t,outer,inner] of [[5,10,5],[6,12,6],[6.01,15.025,9.015],[10,25,15],[12,36,24]]) {
    const { outerRadiusMm,innerRadiusMm } = engine.standardCornerRadii("en10219",t);
    assert.ok(Math.abs(outerRadiusMm-outer)<1e-10);
    assert.ok(Math.abs(innerRadiusMm-inner)<1e-10);
  }
});

test("WC3.1 standard rounded-corner area and fixed 7850 kg/m3", () => {
  const result=section("en10219");
  const legacy=2*5*(100+100-2*5)-(4-Math.PI)*((2*5)**2-(1*5)**2);
  assert.equal(result.ok,true);
  assert.ok(Math.abs(result.areaMm2-legacy)<1e-9);
  assert.equal(result.densityKgM3,7850);
  assert.equal(result.weightKgM,result.areaMm2*7850/1_000_000);
  assert.equal(result.standardAreaMm2,result.areaMm2);
  assert.match(calculator,/calculateTubeSection\(/);
  assert.doesNotMatch(calculator,/function standardCornerRadii\(/);
  assert.doesNotMatch(calculator,/function standardRectangularAreaMm2\(/);
});

test("WC3.1 free geometry and custom density never leak into normative output", () => {
  const free=engine.calculateTubeSection({shape:"square",standard:"geometric",widthMm:100,
    thicknessMm:5,densityKgM3:8000});
  const standard=engine.calculateTubeSection({shape:"square",standard:"en10219",
    widthMm:100,thicknessMm:5,densityKgM3:8000});
  assert.equal(free.ok,true);
  assert.equal(standard.ok,true);
  assert.equal(free.areaMm2,100*100-90*90);
  assert.equal(free.densityKgM3,8000);
  assert.equal(free.standardAreaMm2,null);
  assert.equal(standard.densityKgM3,7850);
  assert.notEqual(standard.areaMm2,free.areaMm2);
  assert.match(calculator,/Nel calcolo libero la densità è modificabile/);
  assert.match(calculator,/La densità non è modificabile in modalità normativa/);
});

test("WC3.1 published sources never replace selected standard mass", () => {
  assert.match(calculator,/const exactReference = !error && standard === "geometric"/);
  assert.match(calculator,/Metodo della norma applicato/);
  assert.match(calculator,/Massa lineare/);
  assert.match(calculator,/questo valore alimenta anche peso per barra, tonnellaggio e calcolo inverso/i);
});

test("WC3.1 SEO explains the difference while numerical regression stays stable", () => {
  assert.match(page,/raggi di raccordo di calcolo diversi/);
  assert.match(page,/EN 10210 ed EN 10219 usano raggi di raccordo/);
  assert.match(page,/Calcolo libero/);
  const hot=section("en10210"),cold=section("en10219");
  assert.equal(hot.ok,true);
  assert.equal(cold.ok,true);
  assert.ok(Math.abs(hot.weightKgM-14.7044)<0.001);
  assert.ok(Math.abs(cold.weightKgM-14.4096)<0.001);
  assert.ok(hot.weightKgM>cold.weightKgM);
});
