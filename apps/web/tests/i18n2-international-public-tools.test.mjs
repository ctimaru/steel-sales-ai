import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import ts from "typescript";

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), "utf8");
const engineCode = read("../lib/international-tube-mass.ts");
const jsEngine = ts.transpileModule(engineCode, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const engine = await import(`data:text/javascript;base64,${Buffer.from(jsEngine).toString("base64")}`);

const calculatorPage = read("../app/en/knowledge/tubes/page.tsx");
const calculator = read("../components/english-tube-weight-calculator.tsx");
const rfqPage = read("../app/en/distinta/page.tsx");
const rfq = read("../components/english-rfq-bill-builder.tsx");
const sitemap = read("../app/sitemap.ts");
const italianCalculator = read("../components/public-tube-weight-calculator.tsx");
const italianCalculatorPage = read("../app/(public)/knowledge/tubes/page.tsx");
const italianRfqPage = read("../app/(public)/distinta/page.tsx");
const englishHub = read("../app/en/knowledge/page.tsx");

function nearlyEqual(actual, expected, epsilon = 1e-10) {
  assert.ok(Math.abs(actual - expected) <= epsilon * Math.max(1, expected), `Expected ${expected}, received ${actual}`);
}
function valid(input) {
  const result = engine.estimatePublicTubeMass(input);
  assert.equal(result.ok, true, result.ok ? "" : result.error);
  return result;
}

test("I18N2 uses the existing CHS area and steel density formula", () => {
  assert.match(italianCalculator, /Math\.PI \* t \* \(d - t\)/);
  const result = valid({ shape: "round", standard: "en10219", outerDiameterMm: 168.3, thicknessMm: 6, lengthM: 12, bars: 30 });
  const kgm = Math.PI * 6 * (168.3 - 6) * 7850 / 1_000_000;
  nearlyEqual(result.weightKgM, kgm);
  nearlyEqual(result.totalKg, kgm * 12 * 30);
  nearlyEqual(result.totalTonnes, kgm * 12 * 30 / 1000);
});

test("I18N2 follows EN 10219 vs EN 10210 corner radius bands exactly", () => {
  assert.match(italianCalculator, /standardRectangularAreaMm2/);
  const base = { shape: "square", widthMm: 100, thicknessMm: 5, lengthM: 6, bars: 1 };
  const cold = valid({ ...base, standard: "en10219" });
  const hot = valid({ ...base, standard: "en10210" });
  const f = 4 - Math.PI;
  nearlyEqual(cold.areaMm2, 2 * 5 * (200 - 2 * 5) - f * ((2 * 5) ** 2 - (1 * 5) ** 2));
  nearlyEqual(hot.areaMm2, 2 * 5 * (200 - 2 * 5) - f * ((1.5 * 5) ** 2 - (1 * 5) ** 2));
  assert.notEqual(cold.weightKgM, hot.weightKgM);
  const coldThick = valid({ shape: "rectangular", standard: "en10219", widthMm: 120, heightMm: 80, thicknessMm: 12, lengthM: 12, bars: 2 });
  nearlyEqual(coldThick.areaMm2, 2 * 12 * (120 + 80 - 2 * 12) - f * ((3 * 12) ** 2 - (2 * 12) ** 2));
});

test("I18N2 separates free geometry and density from normative calculations", () => {
  const free = valid({ shape: "square", standard: "geometric", widthMm: 100, thicknessMm: 5, lengthM: 12, bars: 1, densityKgM3: 8000 });
  nearlyEqual(free.areaMm2, 100 * 100 - 90 * 90);
  nearlyEqual(free.weightKgM, free.areaMm2 * 8000 / 1_000_000);
  const normative = valid({ shape: "square", standard: "en10219", widthMm: 100, thicknessMm: 5, lengthM: 12, bars: 1, densityKgM3: 8000 });
  assert.equal(normative.densityKgM3, 7850);
});

test("I18N2 validates all dimensions, quantity and malformed decimals", () => {
  assert.equal(engine.parseTubeNumber("168,3"), 168.3);
  assert.equal(engine.parseTubeNumber("168.3"), 168.3);
  assert.ok(Number.isNaN(engine.parseTubeNumber("abc")));
  assert.ok(Number.isNaN(engine.parseTubeNumber("1.234,5")));
  const base = { shape: "round", standard: "en10219", outerDiameterMm: 80, thicknessMm: 5, lengthM: 12, bars: 2 };
  for (const patch of [
    { thicknessMm: 0 }, { outerDiameterMm: 10 }, { lengthM: -1 }, { bars: 1.5 },
    { bars: 0 }, { outerDiameterMm: Number.NaN },
  ]) {
    const result = engine.estimatePublicTubeMass({ ...base, ...patch });
    assert.equal(result.ok, false, JSON.stringify(patch));
  }
});

test("I18N2 serves two English functional routes and reciprocal canonical SEO", () => {
  assert.match(calculatorPage, /EnglishTubeWeightCalculator/);
  assert.match(rfqPage, /EnglishRfqBillBuilder/);
  assert.match(calculatorPage, /canonical: absoluteUrl\("\/en\/knowledge\/tubes"\)/);
  assert.match(rfqPage, /canonical: absoluteUrl\("\/en\/distinta"\)/);
  assert.match(italianCalculatorPage, /en: absoluteUrl\("\/en\/knowledge\/tubes"\)/);
  assert.match(italianRfqPage, /en: absoluteUrl\("\/en\/distinta"\)/);
  for (const uri of ["/en/knowledge/tubes", "/en/distinta"]) {
    assert.ok(sitemap.includes(`url: absoluteUrl("${uri}")`));
    assert.ok(englishHub.includes(`href: "${uri}"`));
  }
});

test("I18N2 tools remain local until user copies; mixed standards remain available", () => {
  assert.match(rfq, /const \[lines, setLines\]/);
  assert.match(rfq, /"en10219"/);
  assert.match(rfq, /"en10210"/);
  assert.match(rfq, /navigator\.clipboard\.writeText/);
  assert.match(calculator, /navigator\.clipboard\.writeText/);
  assert.doesNotMatch(rfq + calculator, /fetch\(|createClient\(|supabase|sendRfq|dispatchRfq|/i);
});
