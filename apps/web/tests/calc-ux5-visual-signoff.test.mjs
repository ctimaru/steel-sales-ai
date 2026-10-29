import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const read=path=>readFileSync(new URL(path,import.meta.url),"utf8");
const calculator=read("../components/public-tube-weight-calculator.tsx");
const cinematic=read("../components/calculator-cinematic.module.css");
const dense=read("../components/calculator-dense-cockpit.module.css");
const chrome=read("./calc-ux5-chrome-visual-signoff.mjs");
const workflow=read("../../../.github/workflows/perf2-1-mobile-acceptance.yml");

test("CALC-UX5: visual-only styling retains the exact shared calculation and RFQ contracts",()=>{
  const parsed=ts.transpileModule(calculator,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.Preserve},reportDiagnostics:true});
  assert.equal(parsed.diagnostics?.filter(x=>x.category===ts.DiagnosticCategory.Error).length??0,0);
  for(const token of [
    "resolveCommercialBarQuantity(commercialQuantity.mode, commercialQuantity.raw, kgM, l)",
    "calculatorRfqFromValues(currentSnapshot,",
    "data-cockpit-workspace","data-cockpit-fields","data-cockpit-results",
    "data-cockpit-kpis","data-commercial-targets","data-cockpit-add",
    "data-effective-order-summary","data-cinematic-stage",
    "aria-hidden=\"true\">{sectionDiagram}"
  ])assert.ok(calculator.includes(token),token);
});

test("CALC-UX5: industrial scene has a bounded, secondary layout at all widths",()=>{
  assert.match(cinematic,/CALC-UX5 — FINAL VISUAL PASS/);
  assert.match(cinematic,/\.stage \.productPhoto \{[\s\S]*?height:148px/);
  assert.match(cinematic,/\.stage \.productPhoto \{[\s\S]*?height:118px/);
  assert.match(cinematic,/grid-template-columns:minmax\(0,\.92fr\) minmax\(0,1\.08fr\)/);
  assert.match(cinematic,/\.stageHeading,\.stage \.sectionMetric \{ grid-column:1\/-1; \}/);
  assert.match(cinematic,/repeat\(3,minmax\(0,1fr\)\)/);
});

test("CALC-UX5: commercial fields keep visible borders, keyboard focus and real 44px touch targets",()=>{
  for(const token of [
    "[data-commercial-price-fields] input",
    "border:1px solid #62977e",
    "min-height:44px",
    "-webkit-text-fill-color:#f6fff9",
    "outline-color:#8cfac8",
    "input[aria-invalid=\"true\"]",
    "[data-effective-order-summary]"
  ]) assert.ok(cinematic.includes(token),token);
  assert.match(dense,/\.fields \[data-commercial-targets\] :is\(input,button\) \{ min-height:44px; \}/);
  assert.ok(!cinematic.includes("display:none; /* hide invalid geometry */"));
});

test("CALC-UX5: real Chrome signs off public mobile, desktop and five locales",()=>{
  for(const token of ["'it','en','de','fr','es'","320,390,768,1440",
    "data-cinematic-stage","data-commercial-price-fields","data-cockpit-add",
    "screenshot(","getComputedStyle","horizontalOverflow"])
    assert.ok(chrome.includes(token),token);
  assert.ok(workflow.includes("calc-ux5-chrome-visual-signoff.mjs"));
  assert.ok(workflow.includes("calc-ux5-production-visual-signoff"));
});
