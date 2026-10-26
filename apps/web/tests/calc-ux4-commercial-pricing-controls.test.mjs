import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const pricing = await import("data:text/javascript;base64," + Buffer.from(
  ts.transpileModule(read("../lib/calculator-commercial-pricing.ts"), {
    compilerOptions: {module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}
  }).outputText
).toString("base64"));
const ui = read("../components/calculator-commercial-pricing.tsx");
const calculator = read("../components/public-tube-weight-calculator.tsx");
const locale = read("../lib/tube-calculator-locale.ts");

test("CALC-UX4: convert 850 EUR/t at 20 kg/m to 17 EUR/m, and reverse",()=>{
  assert.equal(pricing.convertCommercialRate("850","tonne",20,"it"),17);
  assert.equal(pricing.convertCommercialRate("17","metre",20,"it"),850);
  assert.equal(pricing.convertCommercialRate("850","tonne",10,"it"),8.5);
  assert.equal(pricing.convertCommercialRate("17","metre",10,"it"),1700);
});

test("CALC-UX4: localized monetary input: 1.250 IT must NOT become EUR1.25",()=>{
  assert.equal(pricing.parseCommercialRate("1.250","it"),1250);
  assert.equal(pricing.parseCommercialRate("1.250,50","it"),1250.5);
  assert.equal(pricing.parseCommercialRate("1,250.50","en"),1250.5);
  assert.equal(pricing.parseCommercialRate("1,250","en"),1250);
  assert.equal(pricing.parseCommercialRate("1.250","en"),1.25);
  assert.equal(pricing.parseCommercialRate("1 250,50","it"),null);
  assert.equal(pricing.parseCommercialRate("1.2.50","it"),null);
  assert.equal(pricing.parseCommercialRate("1,250.50","it"),null);
  assert.equal(pricing.convertCommercialRate("1.250","tonne",20,"it"),25);
});

test("CALC-UX4: decimals, zero, invalid input and invalid mass are handled safely",()=>{
  assert.equal(pricing.convertCommercialRate("850,50","tonne",20,"fr"),17.01);
  assert.equal(pricing.convertCommercialRate("0","tonne",20,"de"),0);
  assert.equal(pricing.parseCommercialRate(""),null);
  assert.equal(pricing.parseCommercialRate("-150"),null);
  assert.equal(pricing.parseCommercialRate("Infinity"),null);
  assert.equal(pricing.parseCommercialRate("1e5"),null);
  assert.equal(pricing.parseCommercialRate("105,12345"),null);
  assert.equal(pricing.convertCommercialRate("800","tonne",0,"it"),null);
  assert.equal(pricing.convertCommercialRate("800","tonne",null,"it"),null);
  assert.equal(pricing.convertCommercialRate("800","tonne",-1,"it"),null);
  assert.equal(pricing.convertCommercialRate("800","tonne",Number.NaN,"it"),null);
});

test("CALC-UX4: precision is for estimates, no chained rounding of active field",()=>{
  const euroMetre = pricing.convertCommercialRate("923,45","tonne",14.4101234,"de");
  assert.ok(euroMetre!==null);
  assert.ok(Math.abs(euroMetre - 923.45*14.4101234/1000)<1e-10);
  assert.equal(pricing.priceInputText(euroMetre,"it").includes("."),false);
});

test("CALC-UX4: pricing controls are fully translated and source of truth follows last edit",()=>{
  for(const key of ["it","en","de","fr","es"])assert.match(ui,new RegExp("\\b"+key+": \\{"));
  assert.match(ui,/useState<\{ basis: PriceBasis; raw: string \}>/);
  assert.match(ui,/setSource\(\{ basis: "tonne", raw: event.target.value \}\)/);
  assert.match(ui,/setSource\(\{ basis: "metre", raw: event.target.value \}\)/);
  assert.match(ui,/convertCommercialRate\(source.raw, source.basis, weightKgM, locale\)/);
  assert.match(ui,/inputMode="decimal"/);
  assert.match(ui,/aria-invalid=/);
  assert.match(ui,/data-commercial-price/);
  assert.match(ui,/grid-cols-2/);
  assert.match(ui,/focus-visible:/);
});

test("CALC-UX4: pricing is only inside EU result preview; not in RFQ, clipboard, analytics, storage or URL",()=>{
  assert.match(calculator,/<CalculatorCommercialPricing weightKgM=\{values.error \? null : values.kgM\} locale=\{locale\}/);
  assert.match(calculator,/closest\("\[data-commercial-price\]"\)/);
  assert.match(calculator,/onChangeCapture/);
  assert.doesNotMatch(ui,/fetch\(|localStorage|sessionStorage|URLSearchParams|trackProductEvent|trackInternationalRfq|calculatorRfqFromValues|navigator.clipboard|onAddToDistinta/);
  assert.doesNotMatch(calculator,/params.set\("price"/);
  assert.doesNotMatch(calculator,/currentSnapshot\s*=\s*\{[^}]*price/);
  assert.match(calculator,/const kgM = validSection\?\.weightKgM/);
});

test("CALC-UX4: compact accessible selectors replace redundant assist", () => {
  assert.doesNotMatch(calculator, /group\/assist|commercialSuggestionLabel/);
  assert.match(calculator, /<CalculatorDimensionDiscovery/);
  assert.match(calculator, /<select aria-label=\{t\("Norma"\)\} value=\{standard\}/);
  assert.match(calculator, /data-calc-shape-buttons/);
  assert.match(calculator, /focus-visible:ring-2/);
  assert.match(calculator, /aria-label=\{t\("Lunghezza barra personalizzata"\)\}/);
});
