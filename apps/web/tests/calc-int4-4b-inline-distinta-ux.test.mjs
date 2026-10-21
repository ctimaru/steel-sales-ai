import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const read = p => readFileSync(new URL(p, import.meta.url), "utf8");
const page = read("../app/(italian)/(public)/knowledge/tubes/page.tsx");
const switcher = read("../components/calculator-region-switch.tsx");
const calculator = read("../components/public-tube-weight-calculator.tsx");
const experience = read("../components/calculator-inline-distinta-experience.tsx");
const shell = read("../components/technical-cart-shell.tsx");
const shellCss = read("../components/technical-cart-shell.module.css");
const model = read("../lib/calculator-inline-distinta.ts");
const existingBuilder = read("../components/buyer-distinta-builder.tsx");

test("CALC-USA-FLOW1 mounts one inline bill across EU and USA, retaining separate calculation engines",()=>{
  assert.match(page,/import \{ CalculatorRegionSwitch \}/);
  assert.match(page,/<CalculatorRegionSwitch locale="it" initialRegion="eu" requestedRegion/);
  assert.match(page,/<EnStructuralMethodEvidence locale="it" \/>/);
  assert.match(page,/data-testid="calculator-editorial-disclosure"/);
  assert.match(page,/references=\{references\} initialValues=\{initialValues\} \/>/);
  assert.doesNotMatch(switcher,/inlineItalianBill/);
  assert.match(switcher,/renderCalculator=/);
  assert.match(switcher,/<CalculatorInlineDistintaExperience references=\{references\?\?\[\]\}/);
  assert.match(switcher,/<UsPipeSampleCalculator locale=\{locale\}/);
  assert.match(switcher,/onAddToDistinta=\{onAddUsToDistinta\}/);
  assert.match(experience,/<PublicTubeWeightCalculator references=\{references\}/);
  assert.match(experience,/onAddToDistinta=\{add\}/);
  assert.doesNotMatch(read("../app/(international-calculator)/[locale]/knowledge/tubes/page.tsx"),/CalculatorInlineDistintaExperience/);
});

test("CALC-INT4.4B preserves calculator first-screen 2 columns, commercial pricing and h1",()=>{
  assert.match(calculator,/const inEmbeddedBuilder = Boolean\(onAddToDistinta\) && !inlinePublicDistinta/);
  assert.match(calculator,/inEmbeddedBuilder \? "grid min-w-0 grid-cols-1"/);
  assert.match(calculator,/inEmbeddedBuilder \|\| locale === "de"/);
  assert.match(calculator,/<CalculatorCommercialPricing/);
  assert.match(calculator,/!inEmbeddedBuilder \? <details className="group\/extra/);
  assert.match(calculator,/!inEmbeddedBuilder && \(locale === "it" \|\| locale === "en"/);
  assert.match(calculator,/!inEmbeddedBuilder && !inlinePublicDistinta \? \(\s*<details/);
  assert.match(calculator,/inlinePublicDistinta && inlineBillCount > 0/);
  assert.match(calculator,/onClick=\{onOpenInlineBill\}/);
  assert.match(calculator,/if \(onAddToDistinta\) \{/);
  assert.match(calculator,/enqueueCalculatorRfq\(window\.sessionStorage, item\)/);
  assert.match(calculator,/inlineCopy.added/);
});

test("CALC-INT4.4B uses 4.4A pure state and existing canonical bill formatter with zero prices",()=>{
  const expected=[
    "addInlineDistintaItem", "duplicateInlineDistintaLine", "editInlineDistintaLine",
    "removeInlineDistintaLine", "inlineDistintaTotals", "persistInlineDistintaSession",
    "readInlineDistintaSession", "INLINE_DISTINTA_MAX_LINES",
  ];
  expected.forEach(name => assert.match(experience,new RegExp(name)));
  assert.match(experience,/buildBuyerDistintaPlainText\(c.quoteTitle, calculated\)/);
  assert.match(experience,/liveState\.current = result\.state/);
  assert.match(experience,/return commit\(result\)/);
  assert.match(experience,/if \(!result\.state\.lines\.length\) setOpen\(false\)/);
  assert.match(experience,/navigator\.clipboard\.writeText/);
  assert.match(experience,/id="distinta-inline"/);
  assert.match(experience,/<TechnicalCartShell/);
  assert.match(experience,/triggerTestId="calculator-cart-trigger"/);
  assert.match(shell,/createPortal\(/);
  assert.match(shell,/role="dialog" aria-modal="true"/);
  assert.match(shell,/document\.body\.style\.overflow/);
  assert.match(shell,/event\.key === "Escape"/);
  assert.match(shellCss,/\.dialogWide/);
  assert.match(experience,/aria-live="polite"/);
  assert.match(shell,/aria-expanded=\{open\}/);
  assert.match(experience,/type="button"/);
  assert.match(experience,/data-create-inline-private-rfq/);
  assert.match(experience,/createPrivateRfqOneStep/);
  assert.doesNotMatch(experience,/fetch\(|supabase|localStorage|document\.cookie|sendBuyerDistinta|marketplace_publish|trackProductEvent/);
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
