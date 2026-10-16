import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";
const read = p => readFileSync(new URL(p, import.meta.url), "utf8");
const model = read("../lib/calculator-inline-distinta.ts");
const bill = read("../components/calculator-inline-distinta-experience.tsx");
const switcher = read("../components/calculator-region-switch.tsx");
const us = read("../components/us-pipe-sample-calculator.tsx");
const hss = read("../components/us-hss-calculator.tsx");
const price = read("../components/calculator-commercial-pricing.tsx");
const buyer = read("../lib/buyer-distinta.ts");
const tsToJs = s => ts.transpileModule(s,{
  compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.Preserve},
  reportDiagnostics:true,
}).outputText;
const stripImports = x => x.replace(/^import\s+[\s\S]*?\s+from\s+["'][^"']+["'];\s*/gmu,"");
const engine = new Function(stripImports(tsToJs(buyer)).replace(/^export /gmu,"")+
  "\nreturn {calculateBuyerDistintaLine,calculateBuyerDistintaTotals};")();
const makeModel = (validUsPipeRfqItem,usPipeRfqSpecification) => new Function(
  "validatedCalculatorRfqItem","calculatorItemToBuyerLine",
  "calculateBuyerDistintaLine","calculateBuyerDistintaTotals",
  "validUsPipeRfqItem","usPipeRfqSpecification",
  stripImports(tsToJs(model)).replace(/^export /gmu,"")+
  "\nreturn {emptyInlineDistinta,addInlineDistintaUsItem,inlineDistintaTotals,"+
  "duplicateInlineDistintaLine,serializeInlineDistinta,parseInlineDistinta};"
)(()=>null,()=>null,engine.calculateBuyerDistintaLine,
  engine.calculateBuyerDistintaTotals,validUsPipeRfqItem,usPipeRfqSpecification);

test("CALC-USA-FLOW1 adds validated US technical row, not nominal published mass or prices",()=>{
  const item={id:"us-catalog-123",version:2,createdAt:Date.now(),sampleId:"6-40",productStandard:"api5l",
    bars:4,lengthM:12};
  const spec={designation:"NPS 6 Sch/Class 40",standardLabel:"API Spec 5L (edition and PSL to confirm)",
    bars:4,lengthM:12,theoreticalKgM:22.45678,publishedKgM:25.991,
    provenanceNote:"Theoretical geometric mass, not certified; U.S. Steel reference p.10; supplier confirmation required"};
  const m=makeModel(x=>x.id===item.id?x:null,()=>spec);
  const first=m.addInlineDistintaUsItem(m.emptyInlineDistinta(),item);
  assert.equal(first.ok,true);
  const line=first.state.lines[0];
  assert.equal(line.standard,spec.standardLabel);
  assert.equal(line.weightKgM,"22.45678");
  assert.equal(line.targetEurT,"");
  assert.equal(line.grade,"");
  assert.match(line.note,/not certified/);
  assert.equal(m.inlineDistintaTotals(first.state).totalMeters,48);
  assert.equal(m.addInlineDistintaUsItem(first.state,item).reason,"duplicate");
  const saved=m.serializeInlineDistinta(first.state);
  assert.ok(saved);
  assert.doesNotMatch(saved,/publishedKgM|25\.991|secretTarget|targetEurT":"850/);
  assert.equal(m.parseInlineDistinta(saved).lines[0].standard,spec.standardLabel);
});
test("CALC-USA-FLOW1 rejects stale US evidence and forged catalog/HSS prices",()=>{
  const item={id:"us-catalog-123",version:2};
  const m=makeModel(()=>null,()=>{throw Error("should not inspect invalid evidence")});
  assert.equal(m.addInlineDistintaUsItem(m.emptyInlineDistinta(),item).reason,"invalid");
  const f=makeModel(x=>x,()=>({standardLabel:"Counterfeit Standard",designation:"Sample",
    bars:1,lengthM:12,theoreticalKgM:55,provenanceNote:"Unknown claimed certificate"}));
  assert.equal(f.addInlineDistintaUsItem(f.emptyInlineDistinta(),item).reason,"invalid");
});
test("CALC-USA-FLOW1 shares one RFQ CTA and one privacy-governed inline bill",()=>{
  for(const text of [model,bill,switcher,us,hss,price]){
    const d=ts.transpileModule(text,{compilerOptions:{
      module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.Preserve
    },reportDiagnostics:true}).diagnostics??[];
    assert.equal(d.filter(x=>x.category===ts.DiagnosticCategory.Error).length,0);
  }
  assert.match(model,/validUsPipeRfqItem\(input, now\)/);
  assert.match(model,/usPipeRfqSpecification\(valid\)/);
  assert.match(bill,/onAddUsToDistinta: addUs/);
  assert.match(switcher,/onAddToDistinta=\{onAddUsToDistinta\}/);
  assert.match(switcher,/region==="us" \? inlineBill : null/);
  for(const component of [us,hss]){
    assert.match(component,/if \(onAddToDistinta\)|if\(onAddToDistinta\)/);
    assert.match(component,/onAddToDistinta\(item\)/);
    assert.match(component,/<CalculatorCommercialPricing/);
    assert.match(component,/weightKgM=\{/);
    assert.match(component,/data-us-add-to-inline-bill/);
    assert.match(component,/window.location.assign\(usRfqBillPath\(locale\)\)/);
  }
  assert.match(price,/optInMessage/);
  assert.match(price,/onChooseBuyerTarget \? \(/);
  assert.doesNotMatch(price,/onChooseBuyerTarget && locale === "it"/);
  assert.match(bill,/createPrivateRfqOneStep/);
});
