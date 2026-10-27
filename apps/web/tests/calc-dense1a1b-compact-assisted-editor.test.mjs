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
  for (const marker of [
    "data-cockpit-toolbar",
    "data-cockpit-fields",
    "data-cockpit-results",
    "data-cockpit-preview",
    "tube-calculator-result",
    "mt-2 grid grid-cols-3 gap-1.5",
    "onAddToDistinta(item)",
    "data-commercial-targets",
    "setThicknessTouched(true)",
  ]) assert.ok(calculator.includes(marker), marker);
  assert.ok(pricing.includes("<details data-commercial-price"));
  assert.ok(pricing.includes("onChooseBuyerTarget({ basis: source.basis, raw: source.raw, weightKgM })"));
  assert.ok(privateTargetChrome.includes('[data-commercial-targets]'));
});

test("DENSE1B: instant discovery starts collapsed and selects only explicitly", () => {
  for (const marker of [
    'const [expandedResults,setExpandedResults]=useState(false)',
    'query.trim().length > 0',
    'event.key==="Enter"',
    'chooseDimension(found.results[Math.min(activeIndex,found.results.length-1)])',
    'onChoose(item)',
    'group/filter',
    'data-dense-discovery-popover',
    'role="searchbox"',
    'role="listbox"',
    'aria-label={c.title}',
    'min-h-11',
  ]) assert.ok(discovery.includes(marker), marker);
  for (const locale of ["it","en","de","fr","es"]) {
    assert.ok(discovery.includes(locale+':{'), locale);
    assert.ok(discovery.includes('filters:'), 'localized filters label');
  }
  for (const blocked of ["fetch(", "supabase", "localStorage", "sessionStorage", "onChooseBuyerTarget"]) {
    assert.ok(!discovery.includes(blocked), blocked);
  }
  assert.ok(calculator.includes("<CalculatorDimensionDiscovery items={availableDimensions}"));
});
