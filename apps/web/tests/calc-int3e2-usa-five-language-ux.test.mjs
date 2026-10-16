import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
const read=p=>readFileSync(new URL(p,import.meta.url),"utf8");
const trans=s=>ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const uri=s=>"data:text/javascript;base64,"+Buffer.from(trans(s)).toString("base64");
const translations=await import(uri(read("../lib/us-calculator-i18n.ts")));
const routeSeed=await import(uri(read("../lib/us-calculator-route-seed.ts")));
const engine=await import(uri(read("../lib/international-tube-mass.ts")));
const region=read("../components/calculator-region-switch.tsx");
const pipe=read("../components/us-pipe-sample-calculator.tsx");
const hss=read("../components/us-hss-calculator.tsx");
const intlPage=read("../app/(international-calculator)/[locale]/knowledge/tubes/page.tsx");
const itPage=read("../app/(public)/knowledge/tubes/page.tsx");
const enPage=read("../app/en/knowledge/tubes/page.tsx");
const prev=read("../lib/calculator-rfq-handoff.ts");
const us=read("../lib/us-pipe-rfq-handoff.ts");
const sitemap=read("../app/sitemap.ts");

test("CALC-INT3E.2 translated US/NPS/HSS context distinguishes source from certification",()=>{
 for(const l of ["de","fr","es"]){
  const p=translations.US_PIPE_I18N[l],h=translations.US_HSS_I18N[l],r=translations.REGION_COPY[l];
  for(const [name,obj,keys]of [
   ["pipe",p,["title","catalogTab","customTab","hssTab","nps","schedule","purpose","theoretical","published","noPublished","disclaimer","bridge","copy","addRfq","source","clipProduct","clipFooter"]],
   ["hss",h,["title","summary","searchLabel","wallFilter","library","sourceWeight","comparison","model","libraryCaveat","add","specCaveat","specPublished"]],
   ["region",r,["headline","chooser","eu","us","eyebrow","europe"]],
  ]){
   for(const k of keys)assert.ok(typeof obj[k]==="string"&&obj[k].length>=4,`${l} ${name} ${k}`);
  }
  assert.equal(translations.usRfqBillPath(l),`/${l}/distinta`);
  assert.notEqual(translations.usLocaleTag(l),"en-US");
 }
 assert.equal(translations.usRfqBillPath("it"),"/distinta");
 assert.equal(translations.usRfqBillPath("en"),"/en/distinta");
 assert.match(pipe,/US_PIPE_I18N/);
 assert.match(hss,/US_HSS_I18N/);
 assert.match(hss,/i18n\?\.specCaveat/);
});

test("CALC-INT3E.2 preserves same mass vector in any UI locale and 2 RFQ queues",()=>{
 for(const standard of ["en10210","en10219","geometric","aisc-a500"]){
  for(const shape of ["round","square","rectangular"]){
   const x=engine.estimatePublicTubeMass({shape,standard,
    outerDiameterMm:168.3,widthMm:152.4,heightMm:101.6,
    thicknessMm:6.35,lengthM:12,bars:5});
   assert.equal(x.ok,true);
   assert.ok(x.totalKg>0);
   assert.ok(Math.abs(x.totalKg-x.weightKgM*60)<1e-8);
  }
 }
 assert.ok(prev.includes('sss:calc-rfq-handoff:v1'));
 assert.ok(us.includes('sss:us-pipe-rfq-handoff:v2'));
 assert.ok(us.includes('hssReferenceId'));
 assert.ok(pipe.includes('enqueueUsPipeRfq(window.sessionStorage,item)'));
 assert.ok(hss.includes('enqueueUsPipeRfq(window.sessionStorage,item)'));
 assert.ok(pipe.includes('window.location.assign(usRfqBillPath(locale))'));
 assert.ok(hss.includes('window.location.assign(usRfqBillPath(locale))'));
});

test("CALC-INT3E.2 USA deep links are language-stable and bounded, no redirects",()=>{
 const keys={system:"us",usMode:"hss",hssReferenceId:"s-6-250",
  hssUnits:"in",hssWidth:"6",hssThickness:"0.25",hssLength:"12",hssQuantity:"4"};
 assert.equal(routeSeed.calculatorRegionFromQuery(keys),"us");
 assert.equal(routeSeed.calculatorRegionFromQuery({system:"EU"}),"eu");
 assert.equal(routeSeed.usPipeSeedFromQuery(keys).hssReferenceId,"s-6-250");
 assert.equal(routeSeed.usPipeSeedFromQuery({usMode:["us","eu"]}).mode,undefined);
 assert.equal(routeSeed.usPipeSeedFromQuery({hssWidth:"x".repeat(400)}).hssWidth.length,80);
 assert.ok(region.includes('isNewCalculatorLocale(locale)'));
 assert.ok(region.includes('InternationalSteelCalculator locale={locale} seed={internationalSeed}'));
 assert.ok(region.includes('UsPipeSampleCalculator locale={locale} initialValues={usInitialValues}'));
 assert.doesNotMatch(pipe,/CalculatorFlagLanguages/);
 assert.doesNotMatch(hss,/CalculatorFlagLanguages/);
 assert.ok(pipe.includes('initialValues.mode'));
 assert.ok(hss.includes('initialValues.hssShape'));
 assert.ok(pipe.includes('initialReferenceId={initialValues.hssReferenceId}'));
 for(const src of [itPage,enPage,intlPage]){
  assert.ok(src.includes('calculatorRegionFromQuery('));
  assert.ok(src.includes('usPipeSeedFromQuery('));
 }
 assert.ok(intlPage.includes('initialRegion={calculatorRegionFromQuery(raw)}'));
 assert.ok(itPage.includes('canonical: absoluteUrl("/knowledge/tubes")'));
 assert.ok(enPage.includes('canonical: absoluteUrl("/en/knowledge/tubes")'));
 for(const l of ["de","fr","es"])assert.ok(sitemap.includes(`/${l}/knowledge/tubes`));
});

test("CALC-INT3E.2 localized editorial covers US NPS and HSS without false catalog claims",()=>{
 const content=read("../lib/international-calculator-landing.ts");
 for(const k of ["usTitle","usDescription","usNps","usHss","usCaveat"]){
  assert.ok(content.includes(k));
  assert.ok(intlPage.includes(`copy.${k}`));
 }
 assert.ok(intlPage.includes('robotsForParameterizedPage(hasParameters)'));
 assert.ok(pipe.includes('selectedStandard.title'));
 assert.ok(hss.includes('t.libraryCaveat'));
 assert.ok(hss.includes('setReferenceId("")'));
 assert.ok(hss.includes('findHssReference(initialReferenceId)'));
 assert.ok(hss.includes('initialUnits==="mm"?25.4:1'));
});
