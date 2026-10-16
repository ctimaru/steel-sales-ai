import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
import ts from "typescript";
const read=p=>readFileSync(new URL(p,import.meta.url),"utf8");
const pipe=read("../components/us-pipe-sample-calculator.tsx");
const hss=read("../components/us-hss-calculator.tsx");
const ui=read("../lib/us-calculator-visual.ts");
const region=read("../components/calculator-region-switch.tsx");
const eu=read("../components/public-tube-weight-calculator.tsx");

test("CALC-USA-UX1 both USA systems share EU-style compact responsive workbench",()=>{
  assert.match(ui,/lg:grid-cols-\[minmax/);
  assert.match(ui,/bg-\[#123b34\]/);
  assert.match(ui,/grid-cols-3/);
  assert.match(ui,/focus-visible:ring-2/);
  assert.match(ui,/min-h-11/);
  assert.match(ui,/min-h-12/);
  assert.match(pipe,/data-us-calculator/);
  assert.match(pipe,/ui.columns \+ " mt-3"/);
  assert.match(pipe,/className=\{ui.inputs\}/);
  assert.match(pipe,/className=\{ui.results\}/);
  assert.match(pipe,/ui.selectorActive/);
  assert.match(hss,/data-us-hss-calculator/);
  assert.match(hss,/className=\{ui.columns\}/);
  assert.match(hss,/className=\{ui.inputs\}/);
  assert.match(hss,/className=\{ui.results\}/);
  assert.match(eu,/lg:grid-cols-\[minmax/);
  assert.match(region,/<UsPipeSampleCalculator locale=\{locale\}/);
});

test("CALC-USA-UX1 never mixes manufacturer published mass with theoretical or AISC design mass",()=>{
  assert.match(pipe,/estimatePublicTubeMass\(\{/);
  assert.match(pipe,/standard:"geometric"/);
  assert.match(pipe,/result.weightKgM/);
  assert.match(pipe,/row.publishedWeightKgM/);
  assert.match(pipe,/row.publishedWeightLbFt/);
  assert.match(pipe,/data-us-technical-details/);
  assert.match(pipe,/copy.disclaimer/);
  assert.match(hss,/standard:"aisc-a500"/);
  assert.match(hss,/hssNominalPublishedKgM\(reference\)/);
  assert.match(hss,/reference.manufacturerNominalLbFt/);
  assert.match(hss,/t.libraryCaveat/);
  assert.match(hss,/t.status/);
});

test("CALC-USA-UX1 keeps accessible native controls and original RFQ navigation",()=>{
  for(const file of [pipe,hss]){
    assert.match(file,/aria-pressed/);
    assert.match(file,/aria-label/);
    assert.match(file,/role="status"/);
    assert.match(file,/enqueueUsPipeRfq\(window.sessionStorage,item\)/);
    assert.match(file,/window.location.assign\(usRfqBillPath\(locale\)\)/);
    const output=ts.transpileModule(file,{compilerOptions:{
      target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.Preserve
    },reportDiagnostics:true});
    assert.deepEqual(output.diagnostics?.filter(d=>d.category===ts.DiagnosticCategory.Error)??[],[]);
  }
  assert.match(pipe,/aria-hidden=\{inputMode==="hss"\}/);
  assert.match(pipe,/className=\{inputMode==="hss" \? "hidden" : ui.columns/);
  assert.match(hss,/onChange=\{e=>chooseReference\(e.target.value\)\}/);
  assert.match(hss,/onChange=\{e=>editMeasurement/);
});
