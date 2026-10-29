import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const helper = read("../lib/calculator-commercial-quantity.ts");
const calc = read("../components/public-tube-weight-calculator.tsx");
const cine = read("../components/calculator-cinematic.module.css");
const browser = read("./calc-ux4-chrome-quantity.mjs");
const compiled = ts.transpileModule(helper,{
  compilerOptions:{ target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext }
}).outputText;
const quantities = await import("data:text/javascript;base64,"+Buffer.from(compiled).toString("base64"));

test("CALC-UX4: 48 metres resolves to 4 complete 12-m bars, same exact bill quantity",()=>{
  const q=quantities.resolveCommercialBarQuantity("metres","48",13.214,12);
  assert.ok(q);
  assert.equal(q.bars,4);
  assert.equal(q.actualMetres,48);
  assert.ok(Math.abs(q.actualTonnes-.634272)<1e-10);
  assert.equal(q.surplusMetres,0);
  assert.ok(Math.abs(q.actualMetres*12.30-590.40)<1e-7);
});

test("CALC-UX4: non-multiple and tonnes round up visibly, never secretly under-supply",()=>{
  const q=quantities.resolveCommercialBarQuantity("metres","49",13.214,12);
  assert.equal(q?.bars,5);
  assert.equal(q?.requestedMetres,49);
  assert.equal(q?.actualMetres,60);
  assert.equal(q?.surplusMetres,11);
  const t=quantities.resolveCommercialBarQuantity("tonnes","0,634272",13.214,12);
  assert.equal(t?.bars,4);
  assert.ok(Math.abs(t.actualTonnes-.634272)<1e-10);
  const changedWeight=quantities.resolveCommercialBarQuantity("metres","48",20,6);
  assert.equal(changedWeight?.bars,8);
  assert.equal(changedWeight?.actualTonnes,.96);
});

test("CALC-UX4: invalid targets cannot produce apparently valid bill quantities",()=>{
  for(const raw of ["", "0", "-1", "abc", "Infinity", "2e5", "10.3.2", "100000000"]){
    assert.equal(quantities.resolveCommercialBarQuantity("metres",raw,13.214,12),null,raw);
  }
  assert.equal(quantities.resolveCommercialBarQuantity("tonnes","1",0,12),null);
  assert.equal(quantities.resolveCommercialBarQuantity("tonnes","1",13.214,0),null);
});

test("CALC-UX4: shared public/private calculator uses one canonical value for display, price and RFQ",()=>{
  const parsed=ts.transpileModule(calc,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.Preserve},reportDiagnostics:true});
  assert.equal(parsed.diagnostics?.filter(d=>d.category===ts.DiagnosticCategory.Error).length??0,0);
  for(const needle of ["resolveCommercialBarQuantity(commercialQuantity.mode, commercialQuantity.raw, kgM, l)",
    "const qty = commercialQuantity ? quantityResolution?.bars ?? null : enteredQty",
    "quantity: String(values.qty)", "calculatorRfqFromValues(currentSnapshot,",
    "data-commercial-rounding", "setCommercialQuantity(null)", "data-cockpit-add",
    "data-commercial-targets", "data-cockpit-preview"])
    assert.ok(calc.includes(needle),needle);
  assert.ok(calc.indexOf("data-commercial-targets")<calc.indexOf("data-cockpit-results"),
    "Target inputs belong in the left column, before the live result");
  assert.ok(calc.includes("values.totalMeters! : values.totalTonnes!"),
    "Private price uses supplied metres/tonnes, not the unrounded target");
  assert.ok(!helper.includes("localStorage")&&!helper.includes("fetch("));
  assert.ok(cine.includes("balanced two-column cockpit"));
  assert.ok(!cine.includes("minmax(0,1.15fr) minmax(0,.95fr)"),
    "Old three-column public layout must be gone");
});

test("CALC-UX4: multilingual browser acceptance covers mobile and desktop and protected quantity handoff",()=>{
  for(const token of ["'it','en','de','fr','es'","320,390,1440","sss:inline-distinta:v1",
    "data-commercial-rounding","data-cockpit-add"])
    assert.ok(browser.includes(token),token);
});
