import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";
import ts from "typescript";
const read=p=>readFileSync(new URL(p,import.meta.url),"utf8");
const calc=read("../components/public-tube-weight-calculator.tsx");
const region=read("../components/calculator-region-switch.tsx");
const css=read("../components/calculator-dense-cockpit.module.css");
const regionCss=read("../components/calculator-region-switch.module.css");
test("DENSE1R-E context bar and geometry retain EU/US and mass contracts",()=>{
  for(const source of [calc,region]){
    const parsed=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.Preserve},reportDiagnostics:true});
    assert.equal(parsed.diagnostics?.filter(x=>x.category===ts.DiagnosticCategory.Error).length??0,0);
  }
  for(const marker of ["data-cockpit-measurements","data-cockpit-length-quantity","data-cockpit-feedback",
    "data-cockpit-kpis","data-cockpit-add","calculatorRfqFromValues(currentSnapshot,",
    "setThicknessTouched(true)"])assert.ok(calc.includes(marker),marker);
  assert.ok(region.includes("data-calc-region-switch"));
  assert.match(css,/\.measurementsRect/);
  assert.match(regionCss,/market selector is a compact context bar/);
  assert.match(region,/inert=\{region !== "eu"\}/);
  assert.match(region,/inert=\{region !== "us"\}/);
});
