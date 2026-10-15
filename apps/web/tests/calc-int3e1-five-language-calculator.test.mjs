import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const read=p=>readFileSync(new URL(p,import.meta.url),"utf8");
const trans=s=>ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const mod=s=>"data:text/javascript;base64,"+Buffer.from(trans(s)).toString("base64");
const intl=await import(mod(read("../lib/international-calculator-landing.ts")));
const engine=await import(mod(read("../lib/international-tube-mass.ts")));
const page=read("../app/(international-calculator)/[locale]/knowledge/tubes/page.tsx");
const layout=read("../app/(international-calculator)/[locale]/layout.tsx");
const ui=read("../components/international-steel-calculator.tsx");
const flags=read("../components/calculator-flag-languages.tsx");
const region=read("../components/calculator-region-switch.tsx");
const existingIt=read("../app/(public)/knowledge/tubes/page.tsx");
const existingEn=read("../app/en/knowledge/tubes/page.tsx");
const original=read("../components/public-tube-weight-calculator.tsx");
const sitemap=read("../app/sitemap.ts");
const v1=read("../lib/calculator-rfq-handoff.ts");

test("CALC-INT3E.1 DE/FR/ES translated landing pages are complete unique content and valid locale tags",()=>{
  const expected={de:"Deutsch",fr:"Français",es:"Español"};
  for(const [lang,name] of Object.entries(expected)){
    assert.equal(intl.isNewCalculatorLocale(lang),true);
    assert.equal(intl.CALCULATOR_FLAGS[lang].label,name);
    assert.equal(intl.CALCULATOR_ROUTES[lang],`/${lang}/knowledge/tubes`);
    const copy=intl.CALCULATOR_TRANSLATIONS[lang];
    for(const key of ["title","description","intro","shape","standard","round","square",
      "rectangular","cold","hot","geometric","diameter","width","height","wall","density",
      "length","bars","result","totalTonnes","addBill","invalid","disclaimer",
      "methodTitle","methodText","rfqEnglish"]){
      assert.ok(copy[key].length>=5,`${lang} missing ${key}`);
    }
    assert.equal(copy.faq.length,3);
    for(const item of copy.faq)assert.ok(item.q.length>15 && item.a.length>50);
  }
  assert.equal(intl.isNewCalculatorLocale("pt"),false);
  assert.equal(intl.isNewCalculatorLocale("en"),false);
  assert.deepEqual(intl.CALCULATOR_LANGUAGE_ORDER,["it","en","de","fr","es"]);
  assert.match(layout,/SiteDocument lang=\{locale\}/);
  assert.match(read("../app/site-document.tsx"),/lang: "it" \| "en" \| "de" \| "fr" \| "es"/);
});

test("CALC-INT3E.1 exactly one shared mass engine, no copied formulas or foreign norm promotion",()=>{
  assert.match(ui,/estimatePublicTubeMass\(/);
  assert.ok(ui.includes("parseTubeNumber(thickness)"));
  assert.match(ui,/calculatorRfqFromValues\(/);
  assert.match(ui,/enqueueCalculatorRfq\(window\.sessionStorage,item\)/);
  assert.match(ui,/window\.location\.assign\("\/en\/distinta"\)/);
  assert.doesNotMatch(ui,/Math\.PI|supabase\.from|fetch\(|dispatchRfq/);
  for(const standard of ["en10219","en10210","geometric"]){
    for(const shape of ["round","square","rectangular"]){
      const r=engine.estimatePublicTubeMass({standard,shape,
        outerDiameterMm:168.3,widthMm:120,heightMm:80,
        thicknessMm:6.3,lengthM:12,bars:7,densityKgM3:7850});
      assert.equal(r.ok,true,`${standard} ${shape}`);
      assert.ok(r.weightKgM>0);
      assert.ok(Math.abs(r.totalKg-r.weightKgM*12*7)<1e-7);
    }
  }
  assert.match(v1,/sss:calc-rfq-handoff:v1/);
});

test("CALC-INT3E.1 five-way hreflang reciprocity and self-canonical clean URLs",()=>{
  for(const lang of ["de","fr","es"]){
    assert.ok(page.includes('absoluteUrl(path)'));
    assert.ok(sitemap.includes(`/${lang}/knowledge/tubes`));
    assert.match(existingIt,new RegExp(`\\b${lang}: absoluteUrl\\("/${lang}/knowledge/tubes"\\)`));
    assert.match(existingEn,new RegExp(`\\b${lang}: absoluteUrl\\("/${lang}/knowledge/tubes"\\)`));
  }
  assert.match(page,/robotsForParameterizedPage\(hasParameters\)/);
  assert.match(page,/inLanguage:locale/);
  assert.match(page,/"@type":"FAQPage"/);
  assert.match(page,/"@type":"WebApplication"/);
  assert.match(page,/notFound\(\)/);
  assert.ok(original.includes("showLanguageSwitcher?: boolean"));
  assert.ok(original.includes("showLanguageSwitcher?: boolean"));
  assert.match(original,/query=\{languageQuery\}/);
  assert.match(region,/showLanguageSwitcher/);
  assert.match(flags,/hrefLang=\{code\}/);
  assert.match(flags,/aria-current=\{locale===code\?"page":undefined\}/);
  for(const l of ["it","en","de","fr","es"])assert.ok(intl.CALCULATOR_ROUTES[l]);
});

test("CALC-INT3E.1 share state is compatible between localized and original calculator",()=>{
  assert.match(ui,/family:familyTo\(shape\)/);
  assert.match(ui,/new URLSearchParams\(entries\)/);
  assert.match(original,/new URLSearchParams\(\)/);
  assert.match(ui,/query=\{query\}/);
  assert.match(ui,/type="text"/);
  assert.match(ui,/function CalcInput\(/);
  assert.ok(ui.includes("parseTubeNumber(thickness)"));
});
