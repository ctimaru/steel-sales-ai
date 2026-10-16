import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
import ts from "typescript";
const read=path=>readFileSync(new URL(path,import.meta.url),"utf8");
const landing=read("../app/(italian)/(public)/knowledge/tubes/page.tsx");
const calc=read("../components/public-tube-weight-calculator.tsx");
const bill=read("../components/calculator-inline-distinta-experience.tsx");
const regional=read("../components/calculator-region-switch.tsx");
const english=read("../app/(international-calculator)/[locale]/knowledge/tubes/page.tsx");

test("4.4D.1 keeps calculator and Distinta as the only primary visible content on IT",()=>{
  assert.match(landing,/<CalculatorRegionSwitch locale="it" initialRegion="eu" inlineItalianBill/);
  assert.match(landing,/data-testid="calculator-editorial-disclosure"/);
  assert.match(landing,/<summary[^>]*>[\s\S]*Guide, fonti e approfondimenti tecnici/);
  assert.doesNotMatch(landing,/<details[^>]*calculator-editorial-disclosure[^>]*\sopen/);
  assert.match(calc,/data-testid="calculator-technical-disclosure"/);
  assert.match(calc,/Riferimenti tecnici del calcolatore/);
  assert.match(calc,/!inEmbeddedBuilder && !\(inlinePublicDistinta && locale === "it"\)/,
    "The Italian inline workbench must not render Add to Home or Save Calculator actions");
  assert.match(bill,/inlineBill=\{bill\}/);
  const source=calc.indexOf("{inlineBill}");
  const supplemental=calc.indexOf('data-testid="calculator-technical-disclosure"');
  assert.ok(source>0 && source<supplemental,"Inline bill appears before other technical sections");
});

test("4.4D.1 retains indexable editorial content in accessible native details, not bot-only visibility",()=>{
  for(const phrase of ["Come si calcola il peso di un tubo in acciaio",
    "Da kg/m a peso barra e tonnellaggio",
    "Peso teorico e peso pubblicato", "Domande frequenti",
    "Esplora per famiglia e dimensione esterna","EnStructuralMethodEvidence",
    "Esplora le norme","Esplora i gradi",
    "Per ordini, certificazione"])assert.ok(landing.includes(phrase),phrase);
  assert.match(landing,/\"@type\": \"WebApplication\"/);
  assert.match(landing,/\"@type\": \"TechArticle\"/);
  assert.match(landing,/\"@type\": \"FAQPage\"/);
  assert.match(landing,/\"@type\": \"BreadcrumbList\"/);
  assert.match(landing,/canonical: absoluteUrl\("\/knowledge\/tubes"\)/);
  for(const locale of ["it","en","de","fr","es"])assert.match(landing,
    new RegExp(locale+": absoluteUrl\\("));
  assert.match(landing,/robotsForParameterizedPage\(hasParameters\)/);
  assert.match(landing,/listPublicTubeFamilyHubs/);
  assert.match(landing,/href=\{tubeFamilyHubPath\(hub.family_slug\)\}/);
  assert.match(landing,/href="\/knowledge\/norme"/);
  assert.match(landing,/href="\/knowledge\/gradi"/);
  assert.doesNotMatch(landing,/display:\s*["']none|aria-hidden=\{true\}[\s\S]{0,100}TechArticle|typeof window.*navigator\.userAgent.*googlebot/i);
});
test("4.4D.1 preserves international pages and EU/USA switch, device option and reference source data",()=>{
  assert.match(landing,/CalculatorPageLanguageSelector locale="it"/);
  assert.match(regional,/aria-pressed=\{region === "eu"\}/);
  assert.match(regional,/aria-pressed=\{region === "us"\}/);
  assert.match(regional,/<UsPipeSampleCalculator locale=\{locale\}/);
  assert.match(regional,/inlineItalianBill && locale === "it"/);
  assert.doesNotMatch(english,/data-testid="calculator-editorial-disclosure"/);
  assert.match(calc,/data-testid="tube-reference-catalogue"/);
  assert.match(calc,/tube-reference-heading/);
  assert.match(calc,/<CalculatorInstallGuide locale=\{locale\}/);
  assert.match(calc,/secondaryTools/);
  assert.match(calc,/\) : secondaryTools\}/);
});
test("4.4D.1 changed JSX parses and keeps user-visible headings and data-rich links",()=>{
  for(const input of [landing,calc,bill]){
    const out=ts.transpileModule(input,{
      compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.Preserve},
      reportDiagnostics:true,
    });
    assert.deepEqual(out.diagnostics?.filter(x=>x.category===ts.DiagnosticCategory.Error)??[],[]);
  }
  assert.match(calc,/id="calcolatore-pesi"/);
  assert.match(bill,/id="distinta-inline"/);
  assert.match(landing,/<details data-testid="calculator-editorial-disclosure"/);
  assert.match(landing,/<EnStructuralMethodEvidence locale="it"/);
});
