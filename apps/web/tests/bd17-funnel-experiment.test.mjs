import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import vm from "node:vm";

const read = p => readFileSync(new URL(p, import.meta.url), "utf8");
const pure = read("../lib/bd17-cta-experiment.ts");
const component = read("../components/bd17-guest-rfq-cta.tsx");
const builder = read("../components/buyer-distinta-builder.tsx");
const events = read("../lib/product-analytics-events.client.ts");
const service = read("../lib/platform-product-analytics.ts");
const dashboard = read("../components/product-analytics-dashboard.tsx");
const compiled = ts.transpileModule(pure, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const exp = {};
vm.runInNewContext(compiled, {exports:exp}, {filename:"bd17-cta-experiment.js"});

function storage() {
  const m = new Map();
  return { getItem:k=>m.get(k)??null, setItem:(k,v)=>m.set(k,v) };
}
test("BD17: deterministic 50/50 allocation per tab with stable rereads", () => {
  const a=storage(),b=storage();
  assert.equal(exp.chooseBd17Arm(a,0.01),"control");
  assert.equal(exp.chooseBd17Arm(a,0.99),"control");
  assert.equal(exp.chooseBd17Arm(b,0.99),"clarity");
  assert.equal(exp.chooseBd17Arm(b,0.01),"clarity");
  assert.equal(exp.chooseBd17Arm(null,0.99),"clarity");
  assert.equal(exp.chooseBd17Arm({getItem:()=>{throw Error("blocked")},setItem:()=>{}},0.99),"control");
});
test("BD17: counts exposure and click at most once per tab and arm, never leaks keys", () => {
  const store=storage(),observed=[];
  assert.equal(exp.recordBd17Once(store,"control","view",n=>observed.push(n)),true);
  assert.equal(exp.recordBd17Once(store,"control","view",n=>observed.push(n)),false);
  assert.equal(exp.recordBd17Once(store,"control","click",n=>observed.push(n)),true);
  assert.equal(exp.recordBd17Once(store,"control","click",n=>observed.push(n)),false);
  assert.equal(exp.recordBd17Once(store,"clarity","view",n=>observed.push(n)),true);
  assert.equal(observed.join(","),"bd17_cta_control_view,bd17_cta_control_click,bd17_cta_clarity_view");
});
test("BD17: eligibility, explicit consent and safely preserved original login handoff",()=>{
  assert.match(component,/analyticsConsentRecordIsCurrent\(record\)/);
  assert.match(component,/record\?\.decision === "granted"/);
  assert.match(component,/IntersectionObserver/);
  assert.match(component,/recordView\(\)/);
  assert.match(component,/onNavigate\(\)/);
  assert.match(component,/NEXT_PUBLIC_BD17_CTA_EXPERIMENT !== "off"/);
  assert.match(component,/encodeURIComponent\(appRoutes\.rfqHub\.createDistinta\)/);
  assert.match(component,/Accedi per creare una RFQ privata/);
  assert.match(component,/Accedi e scegli i fornitori per una RFQ privata/);
  assert.match(component,/Nessun invio parte senza la tua conferma/);
  assert.match(builder,/eligible=\{!workspace && allComplete && draftReady && !restoreCandidate\}/);
  assert.match(builder,/onNavigate=\{persistBrowserDraft\}/);
  assert.match(events,/bd17_cta_control_view/);
  assert.match(events,/bd17_cta_clarity_click/);
  assert.doesNotMatch(component,/emailAddress|session_id|customer_id|rfqId|userId|vatNumber/);
});
async function snapshot(eventRows,missingToken=false) {
  const compiled=ts.transpileModule(service,{
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},
  }).outputText;
  const exports={};
  const ctx={
    exports,URL,URLSearchParams,AbortSignal,
    process:{env:missingToken?{}:{VERCEL_ANALYTICS_TOKEN:"fixture-token",VERCEL_ANALYTICS_PROJECT_ID:"fixture"}},
    fetch:async url=>{
      const endpoint=new URL(url).pathname.split("/web-analytics/")[1];
      const data=endpoint==="visits/count"?{pageviews:20,visitors:12}
        :endpoint==="events/count"?{count:eventRows.reduce((n,x)=>n+x.count,0),visitors:9}
          :endpoint==="events/aggregate"?eventRows:[];
      return {ok:true,json:async()=>({data})};
    }
  };
  vm.runInNewContext(compiled,ctx);
  return exports.getPlatformAnalyticsSnapshot("7d");
}
const rows=(a,b,c,d)=>[
  {eventName:"bd17_cta_control_view",count:a,visitors:1},
  {eventName:"bd17_cta_control_click",count:b,visitors:1},
  {eventName:"bd17_cta_clarity_view",count:c,visitors:1},
  {eventName:"bd17_cta_clarity_click",count:d,visitors:1},
];
test("BD17: comparable consented arms show descriptive CTR without inventing a winner",async()=>{
  const result=await snapshot(rows(130,26,120,36));
  assert.equal(result.bd17CtaExperiment.control.clickRatePercent,20);
  assert.equal(result.bd17CtaExperiment.clarity.clickRatePercent,30);
  assert.equal(result.bd17CtaExperiment.sampleSufficient,true);
  assert.match(dashboard,/nessun vincitore automatico/);
  assert.match(dashboard,/non prova statistica/);
  assert.match(dashboard,/solo con consenso/);
});
test("BD17: sample too small or missing denominators never yields decision",async()=>{
  const tooSmall=await snapshot(rows(10,6,8,4));
  assert.equal(tooSmall.bd17CtaExperiment.sampleSufficient,false);
  assert.equal(tooSmall.bd17CtaExperiment.control.clickRatePercent,60);
  const inconsistent=await snapshot(rows(3,9,0,3));
  assert.equal(inconsistent.bd17CtaExperiment.control.clickRatePercent,null);
  assert.equal(inconsistent.bd17CtaExperiment.clarity.clickRatePercent,null);
  assert.equal(inconsistent.bd17CtaExperiment.sampleSufficient,false);
  const unavailable=await snapshot([],true);
  assert.equal(unavailable.configured,false);
  assert.equal(unavailable.bd17CtaExperiment.sampleSufficient,false);
  assert.match(dashboard,/Campione insufficiente/);
});
