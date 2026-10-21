import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const calculator = read("../components/public-tube-weight-calculator.tsx");
const discovery = read("../components/calculator-dimension-discovery.tsx");
const pricing = read("../components/calculator-commercial-pricing.tsx");
const privateTargetChrome = read("./calc-int4-4c-chrome-private-target.mjs");

test("DENSE1A: compact editor and responsive result preserve core controls", () => {
  for (const source of [calculator, discovery, pricing]) {
    const parsed = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.Preserve },
      reportDiagnostics: true,
    });
    assert.equal(parsed.diagnostics?.filter(d => d.category === ts.DiagnosticCategory.Error).length ?? 0, 0);
  }
  assert.match(calculator, /md:grid-cols-\\[minmax\\(0,1fr\\)_minmax\\(0,1\\.35fr\\)\\]/);
  assert.match(calculator, /lg:grid-cols-\\[minmax\\(0,1fr\\)_150px\\]/);
  assert.match(calculator, /tube-calculator-result/);
  assert.match(calculator, /mt-2 grid grid-cols-3 gap-1\\.5/);
  assert.match(calculator, /onAddToDistinta\\(item\\)/);
  assert.match(calculator, /<details defaultOpen=\\{Boolean\\(targetTonnes\\.trim\\(\\)\\)\\}/);
  assert.match(pricing, /<details data-commercial-price/);
  assert.match(pricing, /onChooseBuyerTarget\\(\\{ basis: source\\.basis, raw: source\\.raw, weightKgM \\}\\)/);
  assert.match(privateTargetChrome, /\\[data-commercial-price\\] summary/);
});

test("DENSE1B: instant discovery starts collapsed, filters progressively and selects only explicitly", () => {
  assert.match(discovery, /const \\[expandedResults,setExpandedResults\\]=useState\\(false\\)/);
  assert.match(discovery, /query\\.trim\\(\\)\\.length > 0/);
  assert.match(discovery, /event\\.key==="Enter"/);
  assert.match(discovery, /chooseDimension\\(found\\.results\\[0\\]\\)/);
  assert.match(discovery, /onChoose\\(item\\)/);
  assert.match(discovery, /<details className="group\\/filter/);
  assert.match(discovery, /aria-label=\\{c\\.title\\}/);
  assert.match(discovery, /min-h-11/);
  for (const locale of ["it","en","de","fr","es"]) {
    assert.match(discovery, new RegExp("\\b"+locale+":\\\\{"));
  }
  assert.doesNotMatch(discovery, /(?:fetch\\(|supabase|localStorage|sessionStorage|onChooseBuyerTarget)/);
  assert.match(calculator, /setThicknessTouched\\(true\\)/);
  assert.match(calculator, /<CalculatorDimensionDiscovery items=\\{availableDimensions\\}/);
});
