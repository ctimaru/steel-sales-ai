import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const calculator = read("../app/(english)/en/knowledge/tubes/page.tsx");
const hub = read("../app/(english)/en/knowledge/page.tsx");
const engine = read("../lib/international-tube-mass.ts");
const standards = read("../app/(english)/en/knowledge/standards/page.tsx");
const grades = read("../app/(english)/en/knowledge/grades/page.tsx");

test("SCHOOL-GROWTH1B keeps existing canonical, five-language alternates and noindex search variants", () => {
  assert.match(calculator, /canonical: absoluteUrl\("\/en\/knowledge\/tubes"\)/);
  for (const lang of ["it", "en", "de", "fr", "es"]) {
    assert.match(calculator, new RegExp(lang + ': absoluteUrl\\('));
  }
  assert.match(calculator, /robotsForParameterizedPage\(hasParameters\)/);
  assert.match(calculator, /<CalculatorRegionSwitch locale="en" initialRegion="eu"/);
  assert.doesNotMatch(calculator, /service_role|\/network\//);
});

test("SCHOOL-GROWTH1B optimizes snippets for an existing utility without a fake area calculator", () => {
  assert.match(calculator, /Steel Tube Weight Calculator \| CHS, SHS & RHS kg\/m/);
  assert.match(calculator, /Free steel tube weight calculator for circular, square and rectangular hollow sections/);
  assert.match(calculator, /title="Steel tube weight calculator: CHS, SHS & RHS in kg\/m"/);
  assert.match(calculator, /weight per metre, weight per bar and tonnes/);
  assert.doesNotMatch(calculator, /Calculate cross-sectional area instantly|free area calculator/);
  assert.match(calculator, /"@type": "WebApplication"/);
  assert.match(calculator, /"@type": "FAQPage"/);
});

test("SCHOOL-GROWTH1B keeps formula disclosure real, technical and optional for human visitors", () => {
  assert.match(calculator, /<details data-testid="school-growth1b-en-editorial"/);
  assert.match(calculator, /<summary[^>]*>[\s\S]*Hollow section weight & cross-sectional area/);
  assert.doesNotMatch(calculator, /<details data-testid="school-growth1b-en-editorial"[^>]*\sopen/);
  assert.match(calculator, /A = π × t × \(D − t\)/);
  assert.match(calculator, /A = B × H − \(B − 2t\) × \(H − 2t\)/);
  assert.match(calculator, /nominal corner-radius correction/);
  assert.match(engine, /freeAreaMm2 = width \* height - \(width - 2 \* t\) \* \(height - 2 \* t\)/);
  assert.match(engine, /2 \* thicknessMm \* \(widthMm \+ heightMm - 2 \* thicknessMm\)/);
  assert.match(calculator, /7,850 ÷ 1,000,000/);
  assert.doesNotMatch(calculator, /display:\s*none|googlebot|data-nosnippet/);
});

test("SCHOOL-GROWTH1B improves contextual English links but preserves conversions and existing catalogs", () => {
  assert.match(hub, /aria-label="Featured steel tube calculator"/);
  assert.match(hub, /Calculate steel tube weight in kg\/m \(CHS, SHS, RHS\)/);
  assert.match(hub, /href="\/en\/knowledge\/tubes"/);
  assert.match(calculator, /href="\/en\/knowledge\/standards"/);
  assert.match(calculator, /href="\/en\/knowledge\/grades"/);
  assert.match(calculator, /href="\/en\/distinta"/);
  assert.match(calculator, /CalculatorRegionSwitch/);
  assert.match(standards, /listPublicStandards/);
  assert.match(grades, /listPublicGrades/);
});

test("SCHOOL-GROWTH1B TSX parses without syntax diagnostics", () => {
  for (const source of [calculator, hub]) {
    const result = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.Preserve },
      reportDiagnostics: true,
    });
    assert.deepEqual(result.diagnostics?.filter(d => d.category === ts.DiagnosticCategory.Error) ?? [], []);
  }
});
