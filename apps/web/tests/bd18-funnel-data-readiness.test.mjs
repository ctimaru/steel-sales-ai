import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
import vm from "node:vm";

const read = relative => fs.readFileSync(new URL(relative, import.meta.url), "utf8");
const src = read("../lib/platform-product-analytics.ts");
const dashboard = read("../components/product-analytics-dashboard.tsx");
const page = read("../app/(platform)/platform/product-analytics/page.tsx");

function harness(events=[], config={}) {
  const compiled=ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const exports={};
  const count=events.reduce((n,x)=>n+(x.count||0),0);
  const ctx={
    exports, URL, URLSearchParams, AbortSignal,
    process:{env:config.tokenMissing?{}:{VERCEL_ANALYTICS_TOKEN:"test-only-token",VERCEL_ANALYTICS_PROJECT_ID:"fixture-project"}},
    fetch:async url=>{
      if(config.apiError)return {ok:false,status:403,text:async()=>"not authorized"};
      const path=new URL(url).pathname.split("/web-analytics/")[1];
      const data=path==="visits/count"?{pageviews:10,visitors:8}
        :path==="events/count"?(config.missingEventCount?{}:{count:config.totalOverride??count,visitors:7})
        :path==="events/aggregate"?(config.eventsResponseMissing?undefined:events)
        :[];
      return {ok:true,json:async()=>data===undefined?{}:({data})};
    },
  };
  vm.runInNewContext(compiled,ctx);
  return exports;
}
const event=(name,count)=>({eventName:name,count,visitors:1});
const ab=(a,b,c,d)=>[
  event("bd17_cta_control_view",a),event("bd17_cta_control_click",b),
  event("bd17_cta_clarity_view",c),event("bd17_cta_clarity_click",d),
];
test("BD18: token and API errors have separate actionable states, never pretend true zero",async()=>{
  const token=await harness([],{tokenMissing:true}).getPlatformAnalyticsSnapshot("7d");
  assert.equal(token.configured,false);
  assert.equal(token.bd18Readiness.state,"token_missing");
  assert.equal(token.bd18Readiness.usableForComparison,false);
  assert.equal(token.bd18Readiness.deltaClickRatePp,null);
  const api=await harness([],{apiError:true}).getPlatformAnalyticsSnapshot("7d");
  assert.equal(api.configured,true);
  assert.equal(api.bd18Readiness.state,"api_error");
  assert.equal(api.bd18Readiness.usableForComparison,false);
  assert.match(api.bd18Readiness.nextAction,/permessi/);
  assert.match(dashboard,/Bd18ReadinessPanel snapshot=\{snapshot\}/);
  assert.match(page,/requirePlatformSuperadmin/);
  assert.doesNotMatch(dashboard,/\{snapshot\.error\}/,"Don't disclose arbitrary upstream API errors");
});
test("BD18: healthy API but no A/B exposure is not proof of zero conversions",async()=>{
  const none=await harness([]).getPlatformAnalyticsSnapshot("7d");
  assert.equal(none.ingestion.state,"receiving");
  assert.equal(none.bd18Readiness.state,"awaiting_exposure");
  assert.equal(none.bd18Readiness.observedFunnelSteps,0);
  assert.equal(none.bd18Readiness.totalExposures,0);
  assert.equal(none.bd18Readiness.usableForComparison,false);
  const partial=await harness(ab(120,20,130,25),{missingEventCount:true}).getPlatformAnalyticsSnapshot("7d");
  assert.equal(partial.ingestion.state,"partial_data");
  assert.equal(partial.bd18Readiness.state,"partial_data");
  assert.equal(partial.bd18Readiness.usableForComparison,false);
});
test("BD18: detects invalid event aggregation even when count response is a non-zero value",async()=>{
  const missingRows=await harness([], {totalOverride:24,eventsResponseMissing:true}).getPlatformAnalyticsSnapshot("7d");
  assert.equal(missingRows.ingestion.state,"partial_data");
  assert.equal(missingRows.bd18Readiness.state,"partial_data");
  const undercount=await harness(ab(20,3,20,1),{totalOverride:1}).getPlatformAnalyticsSnapshot("7d");
  assert.equal(undercount.ingestion.state,"partial_data");
  assert.equal(undercount.bd18Readiness.usableForComparison,false);
});
test("BD18: invalid click/exposure order, missing arm and insufficient sample prevent conclusions",async()=>{
  const invalid=await harness(ab(130,131,135,20)).getPlatformAnalyticsSnapshot("7d");
  assert.equal(invalid.bd18Readiness.state,"invalid_counts");
  assert.equal(invalid.bd18Readiness.deltaClickRatePp,null);
  const oneArm=await harness(ab(110,25,0,0)).getPlatformAnalyticsSnapshot("7d");
  assert.equal(oneArm.bd18Readiness.state,"sample_imbalance");
  assert.equal(oneArm.bd18Readiness.usableForComparison,false);
  const small=await harness(ab(35,10,35,12)).getPlatformAnalyticsSnapshot("7d");
  assert.equal(small.bd18Readiness.state,"collecting");
  assert.equal(small.bd18Readiness.usableForComparison,false);
  assert.equal(small.bd18Readiness.checks.find(x=>x.label==="Campione A/B").status,"pending");
});
test("BD18: 50/50 sample ratio mismatch blocks interpretation, not mislabelled a losing arm",async()=>{
  const s=await harness(ab(320,65,130,40)).getPlatformAnalyticsSnapshot("7d");
  assert.equal(s.bd18Readiness.state,"sample_imbalance");
  assert.ok(s.bd18Readiness.balanceZ > 2.576);
  assert.equal(s.bd18Readiness.deltaClickRatePp,null);
  assert.equal(s.bd18Readiness.usableForComparison,false);
});
test("BD18: healthy balanced samples are descriptive, no automatic statistical winner",async()=>{
  const s=await harness([
    ...ab(160,32,150,45),
    event("rfq_calculator_line_added",12), event("distinta_save",7),event("rfq_start",4),
  ]).getPlatformAnalyticsSnapshot("7d");
  assert.equal(s.bd18Readiness.state,"exploratory_ready");
  assert.equal(s.bd18Readiness.usableForComparison,true);
  assert.equal(s.bd18Readiness.totalExposures,310);
  assert.equal(s.bd18Readiness.deltaClickRatePp,10);
  assert.equal(s.bd18Readiness.observedFunnelSteps,3);
  assert.equal(s.bd18Readiness.funnelSteps,6);
  assert.ok(s.bd18Readiness.checks.every(x=>x.status==="ok"));
  assert.match(s.bd18Readiness.nextAction,/non scegliere un vincitore/);
  assert.match(dashboard,/non prova causale, non vincitore/);
  assert.match(dashboard,/La pubblicazione Vercel non garantisce/);
});
