import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";
import ts from "typescript";
import vm from "node:vm";

const read=p=>readFileSync(new URL(p,import.meta.url),"utf8");
const compiled=(s)=>ts.transpileModule(s,{compilerOptions:{
  module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,
}}).outputText;
function run(src,context={}){
  const exports={};
  vm.runInNewContext(compiled(src),{
    exports,URL,URLSearchParams,AbortSignal,Date,Map,Set,...context,
  });
  return exports;
}
const pure=run(read("../lib/international-rfq-funnel.ts"));
const client=read("../lib/international-rfq-analytics.client.ts");
const bill=read("../components/english-rfq-bill-builder.tsx");
const eu=read("../components/international-steel-calculator.tsx");
const pipe=read("../components/us-pipe-sample-calculator.tsx");
const hss=read("../components/us-hss-calculator.tsx");
const link=read("../components/international-rfq-register-link.tsx");
const dePage=read("../app/(international-calculator)/[locale]/distinta/page.tsx");
const enCta=read("../components/english-conversion-handoff.tsx");
const product=read("../lib/product-analytics-events.client.ts");
const service=read("../lib/platform-product-analytics.ts");
const dashboard=read("../components/product-analytics-dashboard.tsx");
const cookie=read("../components/google-analytics-consent.tsx");

test("CALC-INT3E.4 fixed 16-event vocabulary and low-cardinality EN/DE/FR/ES segmentation",()=>{
  assert.equal(pure.INTERNATIONAL_RFQ_LOCALES.length,4);
  assert.equal(pure.INTERNATIONAL_RFQ_STAGES.length,4);
  const names=new Set();
  for(const locale of pure.INTERNATIONAL_RFQ_LOCALES){
    for(const stage of pure.INTERNATIONAL_RFQ_STAGES)names.add(pure.internationalRfqEventName(stage,locale));
  }
  assert.equal(names.size,16);
  assert.equal(pure.internationalRfqEventName("handoff","de"),"intl_rfq_handoff_de");
  assert.equal(pure.internationalRfqSource([],[]).system,"direct");
  assert.equal(pure.internationalRfqSource([],[]).standard,"unknown");
  assert.equal(pure.internationalRfqSource([{standard:"en10219"}],[]).standard,"en10219");
  assert.equal(pure.internationalRfqSource([],[{productStandard:"astm-a500"}]).system,"us");
  assert.equal(pure.internationalRfqSource([],[{productStandard:"api5l"}]).standard,"api5l");
  assert.equal(pure.internationalRfqSource([{standard:"en10210"}],[{productStandard:"api5l"}]).standard,"mixed");
  assert.equal(pure.internationalRfqSource([{standard:"en10210"},{standard:"en10219"}],[]).system,"eu");
  assert.equal(pure.internationalRfqSource([{standard:"en10210"},{standard:"en10219"}],[]).standard,"mixed");
  assert.ok(pure.INTERNATIONAL_RFQ_LOCALES.every(l=>l!=="it"));
});

test("CALC-INT3E.4 events require explicit valid consent and have no PII, payload or persisted IDs",()=>{
  assert.match(client,/record\?\.decision!=="granted"/);
  assert.match(client,/analyticsConsentRecordIsCurrent\(record\)/);
  assert.match(client,/trackProductEvent\(internationalRfqEventName\(stage,locale\)/);
  assert.match(client,/system:segment\.system/);
  assert.match(client,/standard:segment\.standard/);
  assert.doesNotMatch(client,/sessionStorage|sendBeacon|fetch\(|gtag\(/);
  assert.doesNotMatch(client,/emailAddress|company_id|buyer_id|user_id|price|document\.cookie/);
  assert.match(product,/InternationalRfqEventName/);
  for(const lang of ["de","fr","es"])assert.ok(cookie.includes('pathname.startsWith("/'+lang+'/")'));
  assert.match(eu,/trackInternationalRfq\("handoff",locale,\{system:"eu",standard\}\)/);
  assert.match(pipe,/if\(locale!=="it"\)trackInternationalRfq\("handoff",locale,\{system:"us",standard:productStandard\}\)/);
  assert.match(hss,/if\(locale!=="it"\)trackInternationalRfq\("handoff",locale,\{system:"us",standard:"astm-a500"\}\)/);
});

test("CALC-INT3E.4 bill opening uses validated queues and copy only after clipboard success",()=>{
  assert.match(bill,/const segment=internationalRfqSource\(accepted,acceptedUs\)/);
  assert.match(bill,/trackInternationalRfq\("bill_opened",locale,segment\)/);
  assert.match(bill,/viewTracked\.current=true/);
  assert.match(bill,/readCalculatorRfqQueue\(window\.sessionStorage\)/);
  assert.match(bill,/readUsPipeRfqQueue\(window\.sessionStorage\)/);
  const copied=bill.slice(bill.indexOf("async function copyRfq()"),bill.indexOf("\n  return (",bill.indexOf("async function copyRfq()")));
  assert.ok(copied.indexOf('await navigator.clipboard.writeText(emailText)')<
    copied.indexOf('trackInternationalRfq("email_copied",locale,analyticsSegment)'));
  assert.ok(copied.indexOf('trackInternationalRfq("email_copied",locale,analyticsSegment)')<copied.indexOf("} catch {"));
  assert.match(link,/onClick=\{\(\)=>trackInternationalRfq\("registration_click",locale\)\}/);
  assert.match(link,/href="\/en\/register"/);
  assert.match(enCta,/context === "rfq"/);
  assert.match(enCta,/InternationalRfqRegisterLink locale="en"/);
  assert.match(dePage,/InternationalRfqRegisterLink locale=\{language\}/);
  assert.doesNotMatch(bill,/createClient\(|supabase\.from|dispatchRfq|sendRfq\(/);
});

async function snapshot(rows=[],token=true){
  const exports={};
  const js=compiled(service);
  const globals={
    exports,URL,URLSearchParams,AbortSignal,Date,Map,Set,
    process:{env:token?{VERCEL_ANALYTICS_TOKEN:"fixture",VERCEL_ANALYTICS_PROJECT_ID:"test"}:{}},
    fetch:async url=>{
      const endpoint=new URL(url).pathname.split("/web-analytics/")[1];
      const data=endpoint==="visits/count"?{pageviews:20,visitors:8}
        :endpoint==="events/count"?{count:rows.reduce((n,x)=>n+x.count,0),visitors:8}
          :endpoint==="events/aggregate"?rows:[];
      return {ok:true,json:async()=>({data})};
    },
  };
  vm.runInNewContext(js,globals);
  return exports.getPlatformAnalyticsSnapshot("7d");
}
test("CALC-INT3E.4 superadmin aggregates EN/DE/FR/ES without additional Vercel queries",async()=>{
  const rows=[
    {eventName:"intl_rfq_handoff_de",count:12,visitors:10},
    {eventName:"intl_rfq_bill_opened_de",count:15,visitors:11},
    {eventName:"intl_rfq_email_copied_de",count:3,visitors:3},
    {eventName:"intl_rfq_registration_click_de",count:2,visitors:2},
    {eventName:"intl_rfq_handoff_fr",count:8,visitors:7},
    {eventName:"intl_rfq_bill_opened_fr",count:2,visitors:2},
    {eventName:"intl_rfq_email_copied_fr",count:4,visitors:4},
    {eventName:"intl_rfq_registration_click_fr",count:1,visitors:1},
  ];
  const r=await snapshot(rows);
  assert.deepEqual(Array.from(r.internationalRfqFunnel.map(x=>x.locale)),["en","de","fr","es"]);
  assert.equal(r.internationalRfqFunnel[0].handoff,0);
  assert.equal(r.internationalRfqFunnel[1].handoff,12);
  assert.equal(r.internationalRfqFunnel[1].billOpened,15); // Direct entries also count.
  assert.equal(r.internationalRfqFunnel[1].emailCopied,3);
  assert.equal(r.internationalRfqFunnel[1].registrationClicks,2);
  assert.equal(r.internationalRfqFunnel[2].emailCopied,4);
  assert.match(dashboard,/snapshot\.internationalRfqFunnel\.map/);
  assert.match(dashboard,/NON la creazione effettiva di un account/);
  assert.match(dashboard,/NON un&apos;attribuzione paese/);
  assert.equal((service.match(/vercelAnalyticsQuery</g)||[]).length,8); // 1 declaration + 7 reads
});
test("CALC-INT3E.4 no token = empty and truthful funnel",async()=>{
  const r=await snapshot([],false);
  assert.equal(r.configured,false);
  assert.equal(r.internationalRfqFunnel.length,4);
  assert.ok(r.internationalRfqFunnel.every(row=>row.handoff===0&&row.billOpened===0&&row.emailCopied===0&&row.registrationClicks===0));
});
