import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";
import ts from "typescript";
import vm from "node:vm";

const read=p=>readFileSync(new URL(p,import.meta.url),"utf8");
const compile=s=>ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
function evaluated(s,extra={}){
  const exports={};
  vm.runInNewContext(compile(s),{exports,Date,Intl,Map,Set,console,...extra});
  return exports;
}
const model=evaluated(read("../lib/analytics-consent.ts"));
const taxonomy=evaluated(read("../lib/international-rfq-funnel.ts"));
const bill=read("../components/english-rfq-bill-builder.tsx");
const messages=evaluated(read("../lib/rfq-bill-localization.ts"));
const link=read("../components/international-rfq-register-link.tsx");
const consent=read("../components/google-analytics-consent.tsx");
const en=read("../app/(english)/en/distinta/page.tsx");
const localized=read("../app/(international-calculator)/[locale]/distinta/page.tsx");
const analytics=read("../lib/international-rfq-analytics.client.ts");
const stored=new Map();
const emitted=[];
const client=evaluated(analytics,{
  require(id){
    if(id.includes("analytics-consent"))return model;
    if(id.includes("international-rfq-funnel"))return taxonomy;
    if(id.includes("product-analytics-events.client"))return {trackProductEvent:(name,properties)=>emitted.push({name,properties})};
    throw Error("Unexpected module "+id);
  },
  window:{localStorage:{
    getItem:k=>stored.get(k)??null,
    setItem:(k,v)=>stored.set(k,v),
  }},
});
function record(decision,time=new Date()){
  stored.set(model.ANALYTICS_CONSENT_STORAGE_KEY,JSON.stringify(model.createAnalyticsConsentRecord(decision,time)));
}
test("CALC-INT3E.5 no analytics before explicit current opt-in, expired opt-in, or denial",()=>{
  stored.clear();emitted.length=0;
  assert.equal(client.trackInternationalRfq("email_copied","de",{system:"eu",standard:"en10219"}),false);
  record("denied");
  assert.equal(client.trackInternationalRfq("email_copied","de",{system:"eu",standard:"en10219"}),false);
  record("granted",new Date("2020-01-01T00:00:00Z"));
  assert.equal(client.trackInternationalRfq("email_copied","de",{system:"eu",standard:"en10219"}),false);
  assert.equal(emitted.length,0);
  record("granted");
  assert.equal(client.trackInternationalRfq("email_copied","de",{system:"eu",standard:"en10219"}),true);
  assert.equal(emitted.length,1);
  assert.equal(emitted[0].name,"intl_rfq_email_copied_de");
  assert.deepEqual(Object.keys(emitted[0].properties).sort(),["standard","system"]);
  assert.equal(emitted[0].properties.standard,"en10219");
  record("denied"); // revoke
  assert.equal(client.trackInternationalRfq("email_copied","de"),false);
  assert.equal(emitted.length,1);
});
test("CALC-INT3E.5 first incomplete grade gets real input focus without fake grade defaults",()=>{
  assert.match(bill,/const firstIncomplete = calculated\.find/);
  assert.match(bill,/function focusFirstIncomplete\(\)/);
  assert.match(bill,/firstIncomplete\.error === t\.invalidGrade/);
  assert.match(bill,/target\.focus\(\{ preventScroll: true \}\)/);
  assert.match(bill,/onClick=\{focusFirstIncomplete\}/);
  assert.match(bill,/!line\.grade\.trim\(\)/);
  assert.match(bill,/grade:""/);
  assert.match(bill,/disabled=\{!hydrated \|\| invalidCount > 0\}/);
  assert.match(bill,/lines\.length === 1 \? t\.item : t\.items/);
});
test("CALC-INT3E.5 post-copy CTA is tied to a successful clipboard action, not a dispatch",()=>{
  const action=bill.slice(bill.indexOf("async function copyRfq()"),bill.indexOf("\n  return (",bill.indexOf("async function copyRfq()")));
  assert.ok(action.indexOf('await navigator.clipboard.writeText(emailText)')<
    action.indexOf('setCopyState("copied")'));
  assert.match(bill,/copyState === "copied" \?/);
  assert.match(bill,/InternationalRfqRegisterLink locale=\{locale\}/);
  assert.match(link,/onClick=\{\(\)=>trackInternationalRfq\("registration_click",locale\)\}/);
  assert.match(link,/href="\/en\/register"/);
  assert.doesNotMatch(bill,/supabase\.from|createClient\(|dispatchRfq|sendSupplierEmail|fetch\(/);
  for(const lang of ["en","de","fr","es"]){
    const t=messages.RFQ_BILL_TEXT[lang];
    for(const key of ["fixFirst","copyNext","registerNext","registerCaveat"]){
      assert.ok(t[key]?.length>20,"missing localized text "+lang+" "+key);
    }
    assert.match(t.registerCaveat,lang==="de"?/nicht/:lang==="fr"?/pas|ni/:lang==="es"?/no/i:/not/i);
  }
});
test("CALC-INT3E.5 localized cookie controls allow explicit choice in German/French/Spanish",()=>{
  for(const term of ["Analyse akzeptieren","Accepter les statistiques","Aceptar analítica",
    "Nur notwendige Cookies","Cookies essentiels uniquement","Solo cookies necesarios"]){
    assert.ok(consent.includes(term),term);
  }
  assert.match(consent,/analytics_storage: nextConsent === "granted" \? "granted" : "denied"/);
  assert.match(consent,/clearGoogleAnalyticsCookies\(\)/);
  assert.doesNotMatch(consent,/pathname\.startsWith\("\/platform"\)/);
});
test("CALC-INT3E.5 public URLs, 5-language SEO and private registration handoff stay intact",()=>{
  assert.match(en,/canonical: absoluteUrl\("\/en\/distinta"\)/);
  assert.match(localized,/RFQ_BILL_ROUTES\[language\]/);
  assert.match(localized,/robotsForParameterizedPage/);
  assert.match(en,/hreflang|hrefLang|languages/);
  assert.match(localized,/inLanguage:language/);
  assert.ok(en.includes("<EnglishRfqBillBuilder />"));
  assert.ok(localized.includes("<EnglishRfqBillBuilder locale={language}/>"));
});
