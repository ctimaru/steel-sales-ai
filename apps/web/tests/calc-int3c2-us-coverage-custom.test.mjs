import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const read=p=>readFileSync(new URL(p,import.meta.url),"utf8");
const trans=s=>ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const data=s=>"data:text/javascript;base64,"+Buffer.from(trans(s)).toString("base64");
const dataset=await import(data(read("../lib/us-pipe-catalog-sample.ts")));
const mass=await import(data(read("../lib/international-tube-mass.ts")));
const bridgeSource=read("../lib/us-pipe-rfq-handoff.ts");
const bridge=await import("data:text/javascript;base64,"+Buffer.from(trans(bridgeSource)
  .replaceAll('"@/lib/international-tube-mass"',JSON.stringify(data(read("../lib/international-tube-mass.ts"))))
  .replaceAll('"@/lib/us-pipe-catalog-sample"',JSON.stringify(data(read("../lib/us-pipe-catalog-sample.ts"))))).toString("base64"));
const ui=read("../components/us-pipe-sample-calculator.tsx");
const buyer=read("../components/buyer-distinta-builder.tsx");
const en=read("../components/english-rfq-bill-builder.tsx");
const switcher=read("../components/calculator-region-switch.tsx");
const metadataIt=read("../app/(public)/knowledge/tubes/tubi-americani/page.tsx");
const metadataEn=read("../app/en/knowledge/tubes/american-pipe/page.tsx");
const now=Date.now();
const close=(a,b)=>assert.ok(Math.abs(a-b)<=0.03,`expected ${b}, got ${a}`);

test("CALC-INT3C.2 20 curated manufacturer sizes across 8 NPS bands with per-row provenance",()=>{
  const expected=[
    ["2-80","2", "80", 60.33,5.54,5.03],
    ["2-160","2","160",60.33,8.74,7.47],
    ["2.5-40","2 1/2","40",73.03,5.16,5.80],
    ["2.5-80","2 1/2","80",73.03,7.01,7.67],
    ["2.5-160","2 1/2","160",73.03,9.53,10.02],
    ["3-40","3","40",88.9,5.49,7.58],
    ["4-40","4","40",114.3,6.02,10.80],
  ];
  assert.equal(dataset.US_PIPE_MANUFACTURER_SAMPLE.length,20);
  assert.equal(new Set(dataset.US_PIPE_MANUFACTURER_SAMPLE.map(x=>x.id)).size,20);
  assert.deepEqual(dataset.availableUsNps(),["2","2 1/2","3","4","6","8","10","12"]);
  for(const [id,nps,schedule,od,wall,lbFt] of expected) {
    const row=dataset.findUsPipeSample(id);
    assert.ok(row,id);
    assert.equal(row.nps,nps);
    assert.equal(row.schedule,schedule);
    close(row.outerDiameterMm,od);
    close(row.thicknessMm,wall);
    assert.equal(row.publishedWeightLbFt,lbFt);
    assert.ok(row.sourceLocation?.startsWith("Pipe Tables · NPS"));
    assert.equal(row.sourcePage,undefined);
    close(row.publishedWeightKgM,row.publishedWeightLbFt*dataset.US_PIPE_MASS_CONVERSION);
  }
  assert.match(dataset.US_PIPE_MANUFACTURER_WEB_SOURCE,/ussteel\.com/);
  assert.equal(dataset.findUsPipeSample("2-40"),null,"Do not invent missing catalog schedules");
});

test("CALC-INT3C.2 every additional size uses shared theoretical mass, not published mass",()=>{
  for(const row of dataset.US_PIPE_MANUFACTURER_SAMPLE) {
    const m=mass.estimatePublicTubeMass({
      shape:"round",standard:"geometric",outerDiameterMm:row.outerDiameterMm,
      thicknessMm:row.thicknessMm,lengthM:6,bars:5,densityKgM3:7850});
    assert.equal(m.ok,true,row.id);
    assert.ok(m.weightKgM>0 && m.totalTonnes>0);
    assert.ok(Math.abs(m.weightKgM - Math.PI*row.thicknessMm*(row.outerDiameterMm-row.thicknessMm)*7850/1e6)<1e-9);
    const item=bridge.buildUsPipeRfqItem({sampleId:row.id,productStandard:"api5l",lengthM:6,bars:5},"catalog-"+row.id+"-rfq",now);
    assert.ok(item,row.id);
    const spec=bridge.usPipeRfqSpecification(item);
    assert.equal(spec.theoreticalKgM,m.weightKgM);
    assert.equal(spec.publishedKgM,row.publishedWeightKgM);
    assert.match(spec.provenanceNote,/not certified/);
    assert.match(spec.provenanceNote,/U\.S\. Steel/);
  }
});

test("CALC-INT3C.2 custom mm or inch geometry is strictly user-supplied and survives v2 RFQ",()=>{
  const selection={mode:"custom",productStandard:"astm-a53",outerDiameterMm:114.3,thicknessMm:6.02,lengthM:12,bars:8};
  const item=bridge.buildUsPipeRfqItem(selection,"custom-us-123456",now);
  assert.ok(item);
  assert.equal(item.mode,"custom");
  assert.equal(item.sampleId,undefined);
  const spec=bridge.usPipeRfqSpecification(item);
  assert.ok(spec);
  assert.match(spec.designation,/User dimensions OD 114\.3/);
  assert.match(spec.designation,/no NPS\/Schedule verification/);
  assert.equal(spec.publishedKgM,null);
  assert.equal(spec.publisherPage,null);
  assert.match(spec.provenanceNote,/User-entered geometry with no manufacturer dimension source/);
  const m=mass.estimatePublicTubeMass({shape:"round",standard:"geometric",
    outerDiameterMm:114.3,thicknessMm:6.02,lengthM:12,bars:8,densityKgM3:7850});
  assert.equal(spec.theoreticalKgM,m.weightKgM);
  assert.equal(bridge.buildUsPipeRfqItem({...selection,sampleId:"4-40"},"custom-us-123456",now),null);
  assert.match(ui,/factor=units==="in"\?25\.4:1/);
  assert.match(ui,/setMeasurementUnit/);
  assert.match(ui,/copy\.noPublished/);
  assert.match(ui,/mode:"custom" as const/);
  assert.match(buyer,/spec\.publishedKgM != null/);
  assert.match(en,/usProductIntent/);
});

test("CALC-INT3C.2 v2 rejects hostile custom geometries and out-of-range quantities",()=>{
  const base={version:2,id:"custom-valid-123",createdAt:now,productStandard:"api5l",
    mode:"custom",outerDiameterMm:114.3,thicknessMm:6.02,lengthM:12,bars:10};
  for(const patch of [
    {mode:"unknown"},{sampleId:"4-40"},{outerDiameterMm:0},{outerDiameterMm:Infinity},
    {outerDiameterMm:2500.01},{thicknessMm:0},{thicknessMm:250.01},
    {thicknessMm:60},{thicknessMm:NaN},{bars:0},{bars:1.5},
    {lengthM:1001},{createdAt:now-bridge.US_PIPE_RFQ_TTL_MS-1},
    {productStandard:"__proto__"},
  ]){
    assert.equal(bridge.validUsPipeRfqItem({...base,...patch},now),null,JSON.stringify(patch));
  }
  // Existing catalog payload is still valid with no 'mode' property.
  const old=bridge.buildUsPipeRfqItem({sampleId:"6-40",productStandard:"api5l",lengthM:12,bars:3},"catalog-old-123",now);
  assert.ok(old);
  assert.equal(old.mode,undefined);
  assert.equal(bridge.validUsPipeRfqItem(old,now).sampleId,"6-40");
});

test("CALC-INT3C.2 SEO landings and cinematic region switching remain independent",()=>{
  assert.match(metadataIt,/canonical: absoluteUrl\(path\)/);
  assert.match(metadataEn,/canonical: absoluteUrl\(path\)/);
  assert.match(metadataIt,/CalculatorRegionSwitch locale="it" initialRegion="us"/);
  assert.match(metadataEn,/CalculatorRegionSwitch locale="en" initialRegion="us"/);
  assert.match(switcher,/UsPipeSampleCalculator locale=\{locale\}/);
  assert.match(ui,/window\.location\.assign\(locale === "it" \? "\/distinta" : "\/en\/distinta"\)/);
  assert.doesNotMatch(ui,/dispatchRfq|createClient\(|supabase\.from/);
});
