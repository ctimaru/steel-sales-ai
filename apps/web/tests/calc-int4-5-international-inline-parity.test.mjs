import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const copySource = read("../lib/calculator-inline-distinta-copy.ts");
const transpiled = ts.transpileModule(copySource,{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},
  reportDiagnostics:true,
});
assert.equal(transpiled.diagnostics?.filter(x=>x.category===ts.DiagnosticCategory.Error).length??0,0);
const exports = {};
new Function("exports",transpiled.outputText)(exports);
const copy = exports.inlineBillCopy;
const calculator = read("../components/public-tube-weight-calculator.tsx");
const region = read("../components/calculator-region-switch.tsx");
const bill = read("../components/calculator-inline-distinta-experience.tsx");
const buyer = read("../lib/calculator-inline-buyer-target.ts");
const italian = read("../app/(italian)/(public)/knowledge/tubes/page.tsx");
const english = read("../app/(english)/en/knowledge/tubes/page.tsx");
const international = read("../app/(international-calculator)/[locale]/knowledge/tubes/page.tsx");

test("4.5 all five languages implement the same localized inline bill contract",()=>{
  const locales=["it","en","de","fr","es"];
  assert.deepEqual(Object.keys(copy).sort(),[...locales].sort());
  const keys=Object.keys(copy.it).sort();
  assert.ok(keys.length>=85);
  for(const locale of locales){
    assert.deepEqual(Object.keys(copy[locale]).sort(),keys,locale+" missing localized action");
    for(const key of keys){
      assert.equal(typeof copy[locale][key],"string",locale+" "+key);
      assert.ok(copy[locale][key].trim().length>=2,locale+" "+key);
    }
    if(locale!=="it") assert.notEqual(copy[locale].title,copy.it.title,locale+" translated title");
  }
});

test("CALC-USA-FLOW1 five-language EU and USA calculators use one shared inline experience",()=>{
  assert.match(region,/<CalculatorInlineDistintaExperience references=\{references\?\?\[\]\}/);
  assert.match(region,/renderCalculator=/);
  assert.doesNotMatch(region,/inlineItalianBill/);
  assert.match(region,/<UsPipeSampleCalculator locale=\{locale\}/);
  assert.match(region,/onAddToDistinta=\{onAddUsToDistinta\}/);
  assert.match(italian,/<CalculatorRegionSwitch locale="it" initialRegion="eu"/);
  assert.match(english,/<CalculatorRegionSwitch locale="en" initialRegion="eu"/);
  assert.match(international,/initialRegion=\{calculatorRegionFromQuery\(raw\)\}/);
  assert.match(calculator,/const inlineCopy = localizedInlineBill\(locale\)/);
  assert.match(calculator,/!inEmbeddedBuilder && !inlinePublicDistinta/);
  assert.match(calculator,/inlinePublicDistinta \? \(/);
  assert.match(bill,/inlineBill=\{bill\}/);
});

test("4.5 currency inputs use each locale; public session and technical copy omit private prices",()=>{
  assert.match(buyer,/locale: PriceLocale = "it"/);
  assert.match(buyer,/parseCommercialRate\(raw, locale\)/);
  assert.match(buyer,/convertCommercialRate\(raw, "metre", kgM, locale\)/);
  assert.match(bill,/captureBuyerTargetCandidate\(value.raw, value.basis, value.weightKgM, locale\)/);
  assert.match(bill,/editBuyerTargetForLine\(liveState.current, targets, id, targetRaw, targetBasis, locale\)/);
  assert.match(bill,/CALCULATOR_ROUTES\[locale\]/);
  assert.match(bill,/buildBuyerDistintaPlainText\(c.quoteTitle, calculated\)/);
  assert.match(bill,/locale === "it"/);
  assert.match(bill,/navigator.clipboard.writeText\(plain\)/);
  assert.doesNotMatch(bill,/JSON.stringify\(targets\)|localStorage|marketplace_publish|sendSupplierEmail/);
});
