import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const read=p=>readFileSync(new URL(p,import.meta.url),"utf8");
const trans=s=>ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const uri=s=>"data:text/javascript;base64,"+Buffer.from(trans(s)).toString("base64");
const lib=await import(uri(read("../lib/us-hss-reference-samples.ts")));
const mass=await import(uri(read("../lib/international-tube-mass.ts")));
const source=read("../lib/us-pipe-rfq-handoff.ts");
const bridgeJs=trans(source)
  .replaceAll('"@/lib/us-hss-reference-samples"',JSON.stringify(uri(read("../lib/us-hss-reference-samples.ts"))))
  .replaceAll('"@/lib/international-tube-mass"',JSON.stringify(uri(read("../lib/international-tube-mass.ts"))))
  .replaceAll('"@/lib/us-pipe-catalog-sample"',JSON.stringify(uri(read("../lib/us-pipe-catalog-sample.ts"))));
const bridge=await import("data:text/javascript;base64,"+Buffer.from(bridgeJs).toString("base64"));
const ui=read("../components/us-hss-calculator.tsx");
const eu=read("../lib/calculator-rfq-handoff.ts");
const enBill=read("../components/english-rfq-bill-builder.tsx");
const itBill=read("../components/buyer-distinta-builder.tsx");
const now=Date.now();

test("CALC-INT3D.2 15 unique source-located manufacturer HSS nominal weights across three shapes",()=>{
  const expected={
    "r-6-250":15.37,"r-6625-250":17.04,"r-6625-375":25.06,"r-8625-375":33.07,"r-10-250":26.06,
    "s-4-250":12.21,"s-4-375":17.27,"s-6-250":19.02,"s-6-375":27.48,"s-8-250":25.82,
    "x-6-4-250":15.62,"x-6-4-375":22.37,"x-8-4-250":19.02,"x-10-6-250":25.82,"x-12-8-375":47.90,
  };
  assert.equal(lib.HSS_REFERENCE_SAMPLES.length,15);
  assert.equal(new Set(lib.HSS_REFERENCE_SAMPLES.map(x=>x.id)).size,15);
  for(const [id,weight] of Object.entries(expected)){
    const row=lib.findHssReference(id);
    assert.ok(row,id);
    assert.equal(row.manufacturerNominalLbFt,weight);
    assert.ok(row.sourcePage>=2 && row.sourcePage<=9);
    assert.match(row.sourceRow,/^HSS /);
    const m=lib.hssReferenceDimensionsMm(row);
    assert.equal(m.shape,row.shape);
    assert.ok(m.thicknessMm>0);
    assert.ok(lib.hssAtlasSourceUrl(row.shape).includes("atlastube.com"));
    assert.ok(Math.abs(lib.hssNominalPublishedKgM(row)-weight*1.48816394357)<1e-8);
  }
  assert.deepEqual(["round","square","rectangular"].map(x=>lib.hssReferenceRowsForShape(x).length),[5,5,5]);
  assert.equal(lib.findHssReference("__proto__"),null);
  assert.equal(lib.findHssReference("s-4-999"),null);
});

test("CALC-INT3D.2 design mass always separate from Atlas nominal catalog weight",()=>{
  let different=0;
  for(const row of lib.HSS_REFERENCE_SAMPLES){
    const geom=lib.hssReferenceDimensionsMm(row);
    const r=mass.estimatePublicTubeMass({
      shape:row.shape,standard:"aisc-a500",
      outerDiameterMm:geom.outerDiameterMm??undefined,
      widthMm:geom.widthMm??undefined,heightMm:geom.heightMm??undefined,
      thicknessMm:geom.thicknessMm,lengthM:12,bars:2,densityKgM3:7850,
    });
    assert.equal(r.ok,true,row.id);
    const reference=lib.hssNominalPublishedKgM(row);
    assert.ok(reference>0 && r.weightKgM>0);
    if(Math.abs(reference-r.weightKgM)>0.01)different++;
  }
  assert.ok(different>=12,"catalog weights must not be silently treated as AISC design masses");
  assert.match(ui,/hssNominalPublishedKgM/);
  assert.match(ui,/t\.sourceWeight/);
  assert.match(ui,/t\.comparison/);
  assert.match(ui,/t\.libraryCaveat/);
  assert.match(ui,/hssAtlasSourceUrl/);
});

test("CALC-INT3D.2 RFQ v2 binds manufacturer weight only when exact documented geometry matches",()=>{
  const item=bridge.buildUsPipeRfqItem({
    mode:"hss",productStandard:"astm-a500",hssShape:"rectangular",
    widthMm:152.4,heightMm:101.6,thicknessMm:6.35,
    lengthM:12,bars:10,hssReferenceId:"x-6-4-250",
  },"hss-ref-123456",now);
  assert.ok(item);
  assert.equal(item.hssReferenceId,"x-6-4-250");
  const spec=bridge.usPipeRfqSpecification(item);
  assert.equal(spec.shape,"rectangular");
  assert.equal(spec.calculationMethod,"aisc-a500");
  assert.equal(spec.sampleId,"x-6-4-250");
  assert.equal(spec.publisherPage,6);
  assert.ok(Math.abs(spec.publishedKgM-15.62*1.48816394357)<1e-8);
  assert.match(spec.provenanceNote,/Atlas Tube nominal catalog reference/);
  assert.match(spec.provenanceNote,/not certified/i);
  assert.match(spec.provenanceNote,/15\.62 lb\/ft/);
  const estimated=mass.estimatePublicTubeMass({shape:"rectangular",standard:"aisc-a500",
    widthMm:152.4,heightMm:101.6,thicknessMm:6.35,lengthM:12,bars:10});
  assert.equal(spec.theoreticalKgM,estimated.weightKgM);
  assert.notEqual(spec.publishedKgM,spec.theoreticalKgM);

  for(const patch of [
    {widthMm:153},{heightMm:101.599},{thicknessMm:6.4},
    {hssShape:"square"},{hssReferenceId:"s-4-250"},
    {hssReferenceId:"bogus"},{hssReferenceId:42},
    {outerDiameterMm:152.4},
  ]){
    assert.equal(bridge.validUsPipeRfqItem({...item,...patch},now),null,JSON.stringify(patch));
  }
  const manual=bridge.buildUsPipeRfqItem({mode:"hss",productStandard:"astm-a500",hssShape:"square",
    widthMm:101.6,thicknessMm:6.35,lengthM:12,bars:1},"hss-manual-1234",now);
  assert.ok(manual);
  assert.equal(bridge.usPipeRfqSpecification(manual).publishedKgM,null);
  assert.equal(manual.hssReferenceId,undefined);
});

test("CALC-INT3D.2 UI revokes Atlas reference on any dimensional edit; v1 and pipe v2 unchanged",()=>{
  assert.ok(ui.includes('setReferenceId("");'));
  assert.ok(ui.includes('setReferenceId("");setStatus("");'));
  assert.match(ui,/\.\.\.\(reference \? \{hssReferenceId:reference\.id\}/);
  assert.match(enBill,/value\.calculationMethod/);
  assert.match(itBill,/spec\.publishedKgM != null/);
  assert.match(eu,/sss:calc-rfq-handoff:v1/);
  const old=bridge.buildUsPipeRfqItem({sampleId:"6-40",productStandard:"api5l",
    lengthM:12,bars:4},"legacy-api-1234",now);
  assert.ok(old);
  assert.equal(old.mode,undefined);
  assert.equal(bridge.usPipeRfqSpecification(old).publishedKgM>0,true);
});
