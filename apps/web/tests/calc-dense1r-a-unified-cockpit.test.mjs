import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const source = path => readFileSync(new URL(path, import.meta.url), "utf8");
const calculator = source("../components/public-tube-weight-calculator.tsx");
const finder = source("../components/calculator-dimension-discovery.tsx");
const css = source("../components/calculator-dense-cockpit.module.css");
const chrome = source("./calc-dense1r-a-chrome-cockpit.mjs");

test("DENSE1R-A one toolbar and one workspace preserve calculator technical contracts", () => {
  for (const file of [calculator, finder]) {
    const parsed=ts.transpileModule(file,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.Preserve},reportDiagnostics:true});
    assert.equal(parsed.diagnostics?.filter(d=>d.category===ts.DiagnosticCategory.Error).length??0,0);
  }
  for (const token of ["data-cockpit-header","data-cockpit-toolbar","data-cockpit-controls",
    "data-cockpit-workspace","data-cockpit-fields","data-cockpit-results",
    "data-cockpit-preview","data-cockpit-kpis","data-cockpit-add",
    "onChoose={applyDiscoveredDimension}","setThicknessTouched(true)",
    "calculatorRfqFromValues(currentSnapshot,","onAddToDistinta(item)"])
    assert.ok(calculator.includes(token),token);
  assert.equal((calculator.match(/<CalculatorDimensionDiscovery /g)||[]).length,1);
  assert.equal((calculator.match(/<ParametricShapeDiagram/g)||[]).length,1);
  assert.ok(calculator.indexOf("data-cockpit-toolbar")<calculator.indexOf("data-cockpit-fields"));
  assert.ok(calculator.indexOf("data-cockpit-fields")<calculator.indexOf("data-cockpit-results"));
  assert.ok(finder.includes("compact onChoose")||calculator.includes("compact onChoose"));
  assert.ok(css.includes("grid-template-columns:minmax(0,1.25fr) minmax(340px,.85fr)"));
  assert.ok(chrome.includes("data-cockpit-toolbar"));
});

test("DENSE1R-A no leaked price or auto dispatched RFQ in merged discovery",()=>{
  for(const forbidden of ["supabase", "fetch(", "sessionStorage", "localStorage", "onChooseBuyerTarget"])
    assert.ok(!finder.includes(forbidden),"finder must stay local: "+forbidden);
  assert.ok(calculator.includes("handleStandardChange(event.target.value as StandardValue)"));
  assert.ok(calculator.includes("setFamily(option.value as TubeFamily)"));
  assert.ok(calculator.includes("commercialTotal"));
  assert.ok(calculator.includes("commercialShownTonnes"));
});

test("CALC-PARITY public and embedded calculators retain one shared commercial workflow", () => {
  // The embedded builder may reduce visual decoration, but geometry, targets
  // and Distinta handoff must remain inside the single shared calculator.
  assert.match(calculator,/const inEmbeddedBuilder = Boolean\(onAddToDistinta\) && !inlinePublicDistinta/);
  for (const token of ["data-calc-shape-buttons","data-commercial-targets",
    "data-calc-total-weight","data-cockpit-add"])
    assert.equal(calculator.split(token).length-1,1,"Shared feature must not fork: "+token);
  assert.ok(calculator.includes("setCommercialPriceUnit(unit);"));
  assert.ok(calculator.includes("data-commercial-price-fields"));
  assert.ok(calculator.includes("onClick={() => setFamily(option.value as TubeFamily)}"));
  assert.ok(calculator.includes("onAddToDistinta(item)"));
  assert.ok(calculator.includes("{sectionDiagram}"),"Shared parametric preview is visible beside the weight");
  assert.ok(calculator.includes("!inEmbeddedBuilder ? ("),
    "Only the decorative cinematic stage may be omitted in embedded mode");
  assert.ok(calculator.indexOf("data-commercial-targets")<calculator.indexOf("data-cockpit-add"),"Quantity targets remain with editable dimensions");
  assert.ok(calculator.indexOf("data-commercial-targets")<calculator.indexOf("data-cinematic-geometry"));
});
