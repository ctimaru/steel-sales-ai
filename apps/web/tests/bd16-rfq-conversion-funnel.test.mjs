import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
import vm from "node:vm";

const read = path => fs.readFileSync(new URL(path, import.meta.url), "utf8");
const builder = read("../components/buyer-distinta-builder.tsx");
const client = read("../lib/product-analytics-events.client.ts");
const server = read("../lib/product-analytics-events.server.ts");
const rfqActions = read("../app/(workspace)/marketplace/rfq-hub/actions.ts");
const billActions = read("../app/(public)/distinta/actions.ts");
const dispatch = read("../components/rfq-dispatch-panel.tsx");
const service = read("../lib/platform-product-analytics.ts");
const dashboard = read("../components/product-analytics-dashboard.tsx");
const page = read("../app/(platform)/platform/product-analytics/page.tsx");

async function snapshot(eventRows = [], missingToken = false) {
  const exports = {};
  const js = ts.transpileModule(service, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  const ctx = {
    exports, URL, URLSearchParams, AbortSignal,
    process: { env: missingToken ? {} : { VERCEL_ANALYTICS_TOKEN:"test-token", VERCEL_ANALYTICS_PROJECT_ID:"test-project" } },
    fetch: async url => {
      const p = new URL(url);
      const rest = p.pathname.split("/web-analytics/")[1];
      const data = rest === "visits/count" ? {pageviews:12,visitors:8}
        : rest === "events/count" ? {count:eventRows.reduce((n,r)=>n+r.count,0),visitors:8}
        : rest === "events/aggregate" ? eventRows : [];
      return {ok:true,json: async()=>({data})};
    }
  };
  vm.runInNewContext(js,ctx);
  return exports.getPlatformAnalyticsSnapshot("7d");
}

test("BD16: frontend tracks successfully added calculator line and copied bill, not failed attempts",()=>{
  assert.match(client,/rfq_calculator_line_added/);
  assert.match(client,/rfq_bill_copied/);
  const add = builder.slice(builder.indexOf("function addCalculatorLine"),builder.indexOf("function addGuidedTube"));
  assert.ok(add.indexOf('if (!calculateBuyerDistintaLine(nextLine).complete) return false') <
    add.indexOf('trackProductEvent("rfq_calculator_line_added"'),"only valid lines count");
  const copy = builder.slice(builder.indexOf("async function copyDistinta"),builder.indexOf("function saveDistinta"));
  assert.ok(copy.indexOf('await navigator.clipboard.writeText') < copy.indexOf('trackProductEvent("rfq_bill_copied"'),"copy tracked only after successful clipboard write");
  assert.ok(copy.indexOf('trackProductEvent("rfq_bill_copied"') < copy.indexOf('} catch {'));
});

test("BD16: server emits post-commit/no-PII events, deduped once per supplier bulk action",()=>{
  assert.match(page,/requirePlatformSuperadmin/);
  assert.match(server,/rfq_supplier_added/);
  assert.match(server,/rfq_recipient_reviewed/);
  assert.match(billActions,/trackServerProductEvent\("distinta_save"/);
  assert.match(billActions,/trackServerProductEvent\("rfq_start"/);
  assert.match(rfqActions,/if \(!input.suppressAnalytics\) await trackServerProductEvent\("rfq_supplier_added"/);
  assert.match(rfqActions,/suppressAnalytics: true/);
  assert.match(rfqActions,/if \(addedKeys.length > 0\) await trackServerProductEvent\("rfq_supplier_added"/);
  const review = rfqActions.slice(rfqActions.indexOf("export async function recordBuyerRfqRecipientReview"),rfqActions.indexOf("type LaunchBuyerRfqInput"));
  assert.match(review,/await supabase.auth.getUser/);
  assert.match(review,/\.eq\("owner_user_id", authData.user.id\)/);
  assert.match(review,/\.in\("status", \["draft", "ready"\]\)/);
  assert.match(review,/trackServerProductEvent\("rfq_recipient_reviewed"\)/);
  assert.doesNotMatch(review,/supplier_email|buyer_message|price|userId|supplier_name|rfqTitle/);
  assert.match(dispatch,/reviewTrackedRef\.current = true/);
  assert.match(dispatch,/recordBuyerRfqRecipientReview\(rfqId\)\.catch/);
  assert.match(rfqActions,/if \(sentCount > 0\)/);
  assert.match(rfqActions,/trackServerProductEvent\("rfq_dispatch_launch"/);
});

test("BD16: funnel snapshot uses existing server-only Vercel aggregation and honest event volume counts",async()=>{
  const rows = [
    {eventName:"rfq_calculator_line_added",count:9,visitors:6},
    {eventName:"distinta_save",count:4,visitors:3},
    {eventName:"rfq_start",count:3,visitors:2},
    {eventName:"rfq_supplier_added",count:5,visitors:2},
    {eventName:"rfq_recipient_reviewed",count:2,visitors:2},
    {eventName:"rfq_dispatch_launch",count:1,visitors:1},
    {eventName:"rfq_bill_copied",count:7,visitors:5},
  ];
  const s=await snapshot(rows);
  assert.equal(s.configured,true);
  assert.equal(s.rfqConversionFunnel.length,6);
  assert.deepEqual(Array.from(s.rfqConversionFunnel,x=>x.value),[9,4,3,5,2,1]);
  assert.equal(s.rfqConversionFunnel[0].conversionFromPrevious,null);
  assert.equal(s.rfqConversionFunnel[1].conversionFromPrevious,44.4);
  assert.equal(s.rfqConversionFunnel[3].conversionFromPrevious,166.7);
  assert.equal(s.rfqBillCopies,7);
  assert.match(dashboard,/snapshot\.rfqConversionFunnel/);
  assert.match(dashboard,/snapshot\.rfqBillCopies/);
  assert.match(dashboard,/Non rappresentano abbandoni certi/);
  assert.match(dashboard,/non sono conversioni di utenti unici o coorti/);
});

test("BD16: empty data and missing Vercel token do not invent conversions",async()=>{
  const zero=await snapshot([]);
  assert.equal(zero.rfqConversionFunnel.length,6);
  assert.ok(zero.rfqConversionFunnel.every(x=>x.value===0 && x.conversionFromPrevious===null));
  assert.equal(zero.rfqBillCopies,0);
  const missing=await snapshot([],true);
  assert.equal(missing.configured,false);
  assert.equal(missing.ingestion.state,"token_missing");
  assert.equal(missing.rfqBillCopies,0);
  assert.ok(missing.rfqConversionFunnel.every(x=>x.value===0));
});

test("BD16: telemetry has only whitelisted operational counters, no user or supplier identifiers",()=>{
  assert.doesNotMatch(builder,/trackProductEvent\([^\n]+(?:email|user_id|rfq_id|name|price|target_eur)/);
  assert.match(service,/limit: 100/);
  assert.match(service,/RFQ_CONVERSION_FUNNEL/);
  assert.match(dashboard,/BD16 · Conversione calcolatore/);
});
