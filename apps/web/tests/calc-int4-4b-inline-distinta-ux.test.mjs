import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const read = p => readFileSync(new URL(p, import.meta.url), "utf8");
const page = read("../app/(italian)/(public)/knowledge/tubes/page.tsx");
const switcher = read("../components/calculator-region-switch.tsx");
const calculator = read("../components/public-tube-weight-calculator.tsx");
const experience = read("../components/calculator-inline-distinta-experience.tsx");
const model = read("../lib/calculator-inline-distinta.ts");
const existingBuilder = read("../components/buyer-distinta-builder.tsx");

test("CALC-INT4.4B mounts inline bill only for public IT, not EN/DE/FR/ES or US calculator",()=>{
  assert.match(page,/import \{ CalculatorRegionSwitch \}/);
  assert.match(page,/<CalculatorRegionSwitch locale="it" initialRegion="eu" inlineItalianBill requestedRegion=\{calculatorRegionFromQuery\(params\)\}/);
  assert.match(page,/euAfter=\{<EnStructuralMethodEvidence locale="it" \/>\}/);
  assert.match(switcher,/inlineItalianBill\?: boolean/);
  assert.match(switcher,/inlineItalianBill && locale === "it"/);
  assert.match(switcher,/<CalculatorInlineDistintaExperience references=\{references\?\?\[\]\}/);
  assert.match(switcher,/<UsPipeSampleCalculator locale=\{locale\}/);
  assert.doesNotMatch(switcher,/UsPipeSampleCalculator[^\n]*onAddToDistinta/);
  assert.match(experience,/<PublicTubeWeightCalculator references=\{references\}/);
  assert.match(experience,/onAddToDistinta=\{add\}/);
  assert.doesNotMatch(read("../app/(international-calculator)/[locale]/knowledge/tubes/page.tsx"),/CalculatorInlineDistintaExperience/);
});

test("CALC-INT4.4B preserves calculator first-screen 2 columns, commercial pricing and h1",()=>{
  assert.match(calculator,/const inEmbeddedBuilder = Boolean\(onAddToDistinta\) && !inlinePublicDistinta/);
  assert.match(calculator,/inEmbeddedBuilder \? "grid min-w-0 grid-cols-1"/);
  assert.match(calculator,/inEmbeddedBuilder \|\| locale === "de"/);
  assert.match(calculator,/<CalculatorCommercialPricing/);
  assert.match(calculator,/!inEmbeddedBuilder \? <div/);
  assert.match(calculator,/!inEmbeddedBuilder && \(locale === "it" \|\| locale === "en"/);
  assert.match(calculator,/!inEmbeddedBuilder \? \(\s*<details/);
  assert.match(calculator,/inlinePublicDistinta && inlineBillCount > 0/);
  assert.match(calculator,/href="#distinta-inline"/);
  assert.match(calculator,/if \(onAddToDistinta\) \{/);
  assert.match(calculator,/enqueueCalculatorRfq\(window\.sessionStorage, item\)/);
  assert.match(calculator,/Articolo aggiunto alla distinta qui sotto/);
});

test("CALC-INT4.4B uses 4.4A pure state and existing canonical bill formatter with zero prices",()=>{
  const expected=[
    "addInlineDistintaItem", "duplicateInlineDistintaLine", "editInlineDistintaLine",
    "removeInlineDistintaLine", "inlineDistintaTotals", "persistInlineDistintaSession",
    "readInlineDistintaSession", "INLINE_DISTINTA_MAX_LINES",
  ];
  expected.forEach(name => assert.match(experience,new RegExp(name)));
  assert.match(experience,/buildBuyerDistintaPlainText\("Richiesta di offerta", calculated\)/);
  assert.match(experience,/liveState\.current = result\.state/);
  assert.match(experience,/return commit\(result\)/);
  assert.match(experience,/setOpen\(result\.state\.lines\.length > 0\)/);
  assert.match(experience,/navigator\.clipboard\.writeText/);
  assert.match(experience,/id="distinta-inline"/);
  assert.match(experience,/aria-live="polite"/);
  assert.match(experience,/aria-expanded=\{open\}/);
  assert.match(experience,/type="button"/);
  assert.match(experience,/data-create-inline-private-rfq/);
  assert.match(experience,/createPrivateRfqOneStep/);
  assert.doesNotMatch(experience,/fetch\(|supabase|localStorage|document\.cookie|createBuyerRfqCampaign|sendBuyerDistinta|marketplace_publish|trackProductEvent/);
  assert.match(model,/value\.targetEurT !== ""/);
  assert.match(model,/calculateBuyerDistintaTotals\(state\.lines\.map\(calculateBuyerDistintaLine\)\)/);
  assert.match(existingBuilder,/createPrivateRfqOneStep/);
});

test("CALC-INT4.4B TypeScript JSX parses, SSR has canonical and metadata unchanged",()=>{
  for(const source of [page,switcher,calculator,experience]) {
    const output=ts.transpileModule(source,{
      compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.Preserve},
      reportDiagnostics:true,
    });
    assert.equal(output.diagnostics?.filter(d=>d.category===ts.DiagnosticCategory.Error).length??0,0);
  }
  assert.match(page,/canonical: absoluteUrl\("\/knowledge\/tubes"\)/);
  assert.match(page,/en: absoluteUrl\("\/en\/knowledge\/tubes"\)/);
  assert.match(page,/robotsForParameterizedPage/);
});
