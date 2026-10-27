import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";
import ts from "typescript";

const read = name => readFileSync(new URL(name, import.meta.url), "utf8");
const calculator = read("../components/public-tube-weight-calculator.tsx");
const discovery = read("../components/calculator-dimension-discovery.tsx");
const chrome = read("./calc-cine1a-chrome-acceptance.mjs");

test("CALC-UX3.1B parses the calculator without altering its commercial transfer contracts", () => {
  const result = ts.transpileModule(calculator, {
    compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.Preserve},
    reportDiagnostics:true,
  });
  assert.equal(result.diagnostics?.filter(x=>x.category===ts.DiagnosticCategory.Error).length??0,0);
  for (const marker of [
    "calculatorRfqFromValues(currentSnapshot,",
    "enqueueCalculatorRfq(window.sessionStorage, item)",
    "onAddToDistinta(item)", "data-cockpit-add",
    "data-calc-shape-buttons", "aria-pressed={family === option.value}",
    "onClick={() => setFamily(option.value as TubeFamily)}",
    'data-commercial-targets', 'commercialShownTonnes',
    'values.targetBars', 'setQuantity(String(values.targetBars))',
    'commercialWeight = !values.error && values.kgM',
    'setCommercialPrice(event.target.value)',
  ]) assert.ok(calculator.includes(marker),marker);
  assert.ok(!calculator.includes("PRICE_COMPONENT"),"No temporary placeholder in commercial price tab");
  assert.ok(!calculator.includes("targetDisclosureOpen"),"Old tonnage disclosure removed");
  assert.ok(!calculator.includes('params.set("price"'),"Price not exposed in shared URLs");
});

test("CALC-UX3.1B compact search has no duplicate filter disclosure",()=>{
  assert.ok(discovery.includes('!compact ? <details'));
  assert.ok(discovery.includes("searchCalculatorDimensions(items,query,family,wall,8)"));
  assert.ok(discovery.includes("chooseDimension(found.results"));
});

test("CALC-UX3.1B cinematic Chrome acceptance uses the new direct shape and price controls",()=>{
  assert.ok(chrome.includes("data-calc-shape-buttons"));
  assert.ok(chrome.includes("shape('round_tube').click()"));
  assert.ok(chrome.includes("shape('square_tube').click()"));
  assert.ok(chrome.includes("shape('rectangular_tube').click()"));
  assert.ok(chrome.includes("data-commercial-targets"));
});
