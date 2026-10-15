import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const read=p=>readFileSync(new URL(p,import.meta.url),"utf8");
const transpile=s=>ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const mod=s=>"data:text/javascript;base64,"+Buffer.from(transpile(s)).toString("base64");
const engine=await import(mod(read("../lib/international-tube-mass.ts")));
const sample=await import(mod(read("../lib/us-pipe-catalog-sample.ts")));
const src=read("../lib/us-pipe-rfq-handoff.ts");
const bridge=await import("data:text/javascript;base64,"+Buffer.from(transpile(src)
  .replaceAll('"@/lib/international-tube-mass"',JSON.stringify(mod(read("../lib/international-tube-mass.ts"))))
  .replaceAll('"@/lib/us-pipe-catalog-sample"',JSON.stringify(mod(read("../lib/us-pipe-catalog-sample.ts"))))).toString("base64"));
const hssUi=read("../components/us-hss-calculator.tsx");
const usaUi=read("../components/us-pipe-sample-calculator.tsx");
const enBill=read("../components/english-rfq-bill-builder.tsx");
const itBill=read("../components/buyer-distinta-builder.tsx");
const enRoute=read("../app/en/knowledge/tubes/american-pipe/page.tsx");
const itRoute=read("../app/(public)/knowledge/tubes/tubi-americani/page.tsx");
const now=Date.now();
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} !== ${b}`);

test("CALC-INT3D AISC 0.93 wall and 2t_design outside radii, distinct from EN 10219 and 10210",()=>{
  const d=152.4,t=6.35,te=0.93*t;
  const hss=engine.calculateTubeSection({shape:"square",standard:"aisc-a500",widthMm:d,thicknessMm:t});
  assert.equal(hss.ok,true);
  near(hss.outerRadiusMm,2*te);
  near(hss.innerRadiusMm,te);
  const expected=2*te*(2*d-2*te)-(4-Math.PI)*((2*te)**2-te**2);
  near(hss.areaMm2,expected);
  const en19=engine.calculateTubeSection({shape:"square",standard:"en10219",widthMm:d,thicknessMm:t});
  const en10=engine.calculateTubeSection({shape:"square",standard:"en10210",widthMm:d,thicknessMm:t});
  assert.equal(en19.ok,true);assert.equal(en10.ok,true);
  assert.notEqual(hss.weightKgM,en19.weightKgM);
  assert.notEqual(hss.weightKgM,en10.weightKgM);
  near(engine.standardCornerRadii("aisc-a500",te).outerRadiusMm,2*te);
  near(engine.standardCornerRadii("en10210",t).outerRadiusMm,1.5*t);
});

test("CALC-INT3D HSS round and rectangular vectors are computed by shared mass engine",()=>{
  const rd=engine.estimatePublicTubeMass({shape:"round",standard:"aisc-a500",outerDiameterMm:101.6,thicknessMm:6.35,lengthM:12,bars:3});
  assert.equal(rd.ok,true);
  near(rd.weightKgM,Math.PI*(.93*6.35)*(101.6-.93*6.35)*7850/1_000_000);
  const h=engine.estimatePublicTubeMass({shape:"rectangular",standard:"aisc-a500",widthMm:203.2,heightMm:101.6,thicknessMm:6.35,lengthM:12,bars:5});
  assert.equal(h.ok,true);
  near(h.totalKg,h.weightKgM*60);
  assert.ok(h.weightKgM>0);
  assert.equal(engine.estimatePublicTubeMass({shape:"rectangular",standard:"en10219",widthMm:203.2,heightMm:101.6,thicknessMm:6.35,lengthM:12,bars:5}).ok,true);
});

test("CALC-INT3D rejects invalid HSS scope and maintains separate product vs design identities",()=>{
  for(const x of [
    {shape:"square",standard:"aisc-a500",widthMm:600,thicknessMm:6},
    {shape:"rectangular",standard:"aisc-a500",widthMm:500,heightMm:150,thicknessMm:6},
    {shape:"round",standard:"aisc-a500",outerDiameterMm:720,thicknessMm:6},
    {shape:"round",standard:"aisc-a500",outerDiameterMm:100,thicknessMm:25.401},
  ]){
    assert.equal(engine.calculateTubeSection(x).ok,false);
  }
  assert.equal(engine.calculateTubeSection({shape:"square",standard:"aisc-a500",widthMm:152.4,thicknessMm:6.35}).ok,true);
  const reg=read("../lib/calculator-standards-registry.ts");
  assert.match(reg,/id: "astm-a500".*organization: "ASTM"/);
  assert.match(reg,/role: "product", status: "context-only"/);
  assert.match(hssUi,/design wall = 0\.93/);
  assert.match(hssUi,/not certified as-delivered/);
});

test("CALC-INT3D v2 HSS RFQ specification preserves actual shapes and AISC mass",()=>{
  const entries=[
    {hssShape:"square",widthMm:152.4,thicknessMm:6.35},
    {hssShape:"rectangular",widthMm:203.2,heightMm:101.6,thicknessMm:6.35},
    {hssShape:"round",outerDiameterMm:101.6,thicknessMm:6.35},
  ];
  for(const input of entries){
    const item=bridge.buildUsPipeRfqItem({mode:"hss",productStandard:"astm-a500",
      lengthM:12,bars:5,...input},"hss-item-123456",now);
    assert.ok(item);
    const spec=bridge.usPipeRfqSpecification(item);
    assert.ok(spec);
    assert.equal(spec.shape,input.hssShape);
    assert.equal(spec.calculationMethod,"aisc-a500");
    assert.equal(spec.publishedKgM,null);
    assert.match(spec.standardLabel,/ASTM A500/);
    assert.match(spec.designation,/HSS/);
    assert.match(spec.provenanceNote,/0\.93/);
    assert.match(spec.provenanceNote,/not certified/);
    const mass=engine.estimatePublicTubeMass({shape:input.hssShape,standard:"aisc-a500",
      ...input,lengthM:12,bars:5});
    assert.equal(mass.ok,true);
    near(spec.theoreticalKgM,mass.weightKgM);
  }
  assert.match(enBill,/standard:value\.calculationMethod/);
  assert.match(enBill,/value\.shape/);
  assert.match(enBill,/aisc-a500/);
  assert.match(itBill,/spec\.calculationMethod==="aisc-a500"/);
  assert.match(usaUi,/UsHssCalculator locale=\{locale\}/);
});

test("CALC-INT3D forged standards, incompatible A500 NPS catalog, oversized HSS rejected",()=>{
  const base={version:2,id:"hss-item-56789",createdAt:now,mode:"hss",
    productStandard:"astm-a500",hssShape:"square",widthMm:152.4,
    thicknessMm:6.35,lengthM:12,bars:1};
  for(const change of [
    {productStandard:"api5l"},{hssShape:"triangle"},{heightMm:152.4},
    {outerDiameterMm:152.4},{sampleId:"6-40"},{widthMm:0},
    {widthMm:600},{thicknessMm:26},{thicknessMm:85},{bars:0},
    {lengthM:1001},{mode:"custom"},{createdAt:now-bridge.US_PIPE_RFQ_TTL_MS-1},
  ])assert.equal(bridge.validUsPipeRfqItem({...base,...change},now),null,JSON.stringify(change));
  assert.equal(bridge.buildUsPipeRfqItem({mode:"custom",outerDiameterMm:168.3,thicknessMm:7.11,
    lengthM:12,bars:1,productStandard:"astm-a500"},"custom-a500-123",now),null);
  assert.equal(bridge.buildUsPipeRfqItem({sampleId:"6-40",
    lengthM:12,bars:1,productStandard:"astm-a500"},"catalog-a500-123",now),null);
  assert.equal(bridge.buildUsPipeRfqItem({sampleId:"6-40",
    lengthM:12,bars:1,productStandard:"api5l"},"catalog-api5l-123",now)?.sampleId,"6-40");
  assert.equal(sample.US_PIPE_MANUFACTURER_SAMPLE.length,20);
});

test("CALC-INT3D leaves existing SEO routes, EU calculator switch and v1 flow unchanged",()=>{
  assert.match(enRoute,/canonical: absoluteUrl\(path\)/);
  assert.match(itRoute,/canonical: absoluteUrl\(path\)/);
  assert.match(enRoute,/CalculatorRegionSwitch locale="en" initialRegion="us"/);
  assert.match(itRoute,/CalculatorRegionSwitch locale="it" initialRegion="us"/);
  assert.match(read("../lib/calculator-rfq-handoff.ts"),/sss:calc-rfq-handoff:v1/);
  assert.match(src,/sss:us-pipe-rfq-handoff:v2/);
  assert.match(hssUi,/window\.location\.assign\(locale==="it"\?"\/distinta":"\/en\/distinta"\)/);
  assert.doesNotMatch(hssUi,/dispatchRfq|fetch\(|createClient\(/);
});
