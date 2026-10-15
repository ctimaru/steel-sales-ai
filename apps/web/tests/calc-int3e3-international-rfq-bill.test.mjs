import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const read=p=>readFileSync(new URL(p,import.meta.url),"utf8");
const transpile=s=>ts.transpileModule(s,{compilerOptions:{
 module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,
}}).outputText;
const data=s=>"data:text/javascript;base64,"+Buffer.from(transpile(s)).toString("base64");
const bill=await import(data(read("../lib/rfq-bill-localization.ts")));
const engine=await import(data(read("../lib/international-tube-mass.ts")));
const routes=await import(data(read("../lib/calculator-international-contract.ts")));
const us=await import(data(read("../lib/us-calculator-i18n.ts")));
const builder=read("../components/english-rfq-bill-builder.tsx");
const localPage=read("../app/(international-calculator)/[locale]/distinta/page.tsx");
const enPage=read("../app/(english)/en/distinta/page.tsx");
const itPage=read("../app/(italian)/(public)/distinta/page.tsx");
const sitemap=read("../app/sitemap.ts");
const europe=read("../components/international-steel-calculator.tsx");
const pipe=read("../components/us-pipe-sample-calculator.tsx");
const hss=read("../components/us-hss-calculator.tsx");
const landing=read("../lib/international-calculator-landing.ts");
const v1=read("../lib/calculator-rfq-handoff.ts");
const v2=read("../lib/us-pipe-rfq-handoff.ts");

test("CALC-INT3E.3 RFQ routes published in 5 languages with correct html lang and reciprocal SEO",()=>{
 for(const lang of ["de","fr","es"]){
  const path="/"+lang+"/distinta";
  assert.equal(bill.RFQ_BILL_ROUTES[lang],path);
  assert.equal(routes.CALCULATOR_PUBLIC_ROUTES[lang].rfqBill,path);
  assert.equal(us.usRfqBillPath(lang),path);
  assert.ok(sitemap.includes(path));
  for(const src of [itPage,enPage])assert.ok(src.includes(path),"missing reciprocal alternate");
  assert.ok(bill.RFQ_BILL_LANDING[lang].description.length>95);
  assert.ok(bill.RFQ_BILL_LANDING[lang].detail.length>90);
 }
 assert.equal(routes.CALCULATOR_PUBLIC_ROUTES.it.rfqBill,"/distinta");
 assert.equal(routes.CALCULATOR_PUBLIC_ROUTES.en.rfqBill,"/en/distinta");
 assert.equal(us.usRfqBillPath("it"),"/distinta");
 assert.equal(us.usRfqBillPath("en"),"/en/distinta");
 assert.match(localPage,/SiteDocument|EnglishRfqBillBuilder locale=\{language\}/);
 assert.match(localPage,/generateStaticParams/);
 assert.match(localPage,/robotsForParameterizedPage/);
 assert.match(localPage,/RFQ_BILL_ROUTES/);
 assert.match(localPage,/inLanguage:language/);
});

test("CALC-INT3E.3 all RFQ bill fields and supplier-email text translated without translation of source designations",()=>{
 const keys=Object.keys(bill.RFQ_BILL_TEXT.en);
 for(const lang of ["de","fr","es"]){
  const copy=bill.RFQ_BILL_TEXT[lang];
  assert.deepEqual(Object.keys(copy).sort(),keys.sort());
  for(const k of keys)assert.ok(copy[k]?.length>2,lang+" "+k);
  assert.notEqual(copy.title,bill.RFQ_BILL_TEXT.en.title);
  assert.notEqual(copy.emailSubject,bill.RFQ_BILL_TEXT.en.emailSubject);
  assert.match(copy.usHssCaveat,/AISC/);
  assert.match(copy.usPipeCaveat,/API/);
  assert.match(copy.privacy,/server|Server/i);
 }
 assert.equal(bill.formatBillNumber(168.3,"de"),"168,3");
 assert.equal(bill.formatBillNumber(168.3,"fr"),"168,3");
 assert.equal(bill.formatBillNumber(168.3,"es"),"168,3");
 assert.equal(bill.formatBillNumber(168.3,"en"),"168.3");
 assert.match(builder,/RFQ_BILL_TEXT\[locale\]/);
 assert.match(builder,/formatBillNumber\(mass\.totalTonnes,locale,4\)/);
 assert.match(builder,/notes\.trim\(\)/);
 assert.match(builder,/line\.usProductIntent/);
 assert.match(builder,/usProductIntent:geometryChanged \? undefined : line\.usProductIntent/);
 assert.match(builder,/!line\.grade\.trim\(\)/);
 assert.match(builder,/invalidCount > 0/);
 assert.match(builder,/copyState === "copied"/);
});

test("CALC-INT3E.3 v1 and v2 still validated tab-local, source context is not certified and no backend send",()=>{
 assert.match(v1,/sss:calc-rfq-handoff:v1/);
 assert.match(v2,/sss:us-pipe-rfq-handoff:v2/);
 assert.match(builder,/readCalculatorRfqQueue\(window\.sessionStorage\)/);
 assert.match(builder,/readUsPipeRfqQueue\(window\.sessionStorage\)/);
 assert.match(builder,/consumeCalculatorRfqIds\(window\.sessionStorage/);
 assert.match(builder,/consumeUsPipeRfqIds\(window\.sessionStorage/);
 assert.match(builder,/Requested product specification|t\.usSpecification/);
 assert.match(europe,/CALCULATOR_PUBLIC_ROUTES\[locale\]\.rfqBill/);
 assert.match(pipe,/window\.location\.assign\(usRfqBillPath\(locale\)\)/);
 assert.match(hss,/window\.location\.assign\(usRfqBillPath\(locale\)\)/);
 assert.doesNotMatch(builder,/supabase\.from|createClient\(|fetch\(|dispatchRfq/);
 assert.match(landing,/Die Anfrage-Stückliste ist auf Deutsch verfügbar/);
 for(const lang of ["de","fr","es"]){
  for(const standard of ["en10219","en10210","geometric","aisc-a500"]){
   const r=engine.estimatePublicTubeMass({
    shape:"rectangular",standard,widthMm:152.4,heightMm:101.6,
    thicknessMm:6.35,bars:7,lengthM:12,
   });
   assert.equal(r.ok,true,lang+" "+standard);
   assert.ok(Math.abs(r.totalKg-r.weightKgM*84)<1e-8);
  }
 }
});
