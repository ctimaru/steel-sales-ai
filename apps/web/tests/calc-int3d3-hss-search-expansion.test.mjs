import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const read=p=>readFileSync(new URL(p,import.meta.url),"utf8");
const transpile=s=>ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const uri=s=>"data:text/javascript;base64,"+Buffer.from(transpile(s)).toString("base64");
const lib=await import(uri(read("../lib/us-hss-reference-samples.ts")));
const mass=await import(uri(read("../lib/international-tube-mass.ts")));
const original=read("../lib/us-pipe-rfq-handoff.ts");
const bridge=await import("data:text/javascript;base64,"+Buffer.from(transpile(original)
  .replaceAll('"@/lib/us-hss-reference-samples"',JSON.stringify(uri(read("../lib/us-hss-reference-samples.ts"))))
  .replaceAll('"@/lib/international-tube-mass"',JSON.stringify(uri(read("../lib/international-tube-mass.ts"))))
  .replaceAll('"@/lib/us-pipe-catalog-sample"',JSON.stringify(uri(read("../lib/us-pipe-catalog-sample.ts"))))).toString("base64"));
const ui=read("../components/us-hss-calculator.tsx");
const now=Date.now();

test("CALC-INT3D.3 expands to 30 individually attributed rows: 10 per shape",()=>{
  const newRows={
    "r-12-625":[76.00,3],"r-12-500":[61.47,3],"r-1175-250":[30.73,3],
    "r-1075-375":[41.59,3],"r-9625-250":[25.06,3],
    "s-8-375":[37.69,2],"s-7-250":[22.42,2],"s-6-313":[23.34,2],
    "s-5-250":[15.62,2],"s-45-375":[19.82,2],
    "x-12-10-375":[53.00,3],"x-12-8-250":[32.63,3],
    "x-12-6-375":[42.79,3],"x-12-4-250":[25.82,3],
    "x-10-8-375":[42.79,3],
  };
  assert.equal(lib.HSS_REFERENCE_SAMPLES.length,30);
  assert.equal(new Set(lib.HSS_REFERENCE_SAMPLES.map(row=>row.id)).size,30);
  assert.deepEqual(["round","square","rectangular"].map(shape=>lib.hssReferenceRowsForShape(shape).length),[10,10,10]);
  for(const [id,[lbFt,page]] of Object.entries(newRows)){
    const row=lib.findHssReference(id);
    assert.ok(row,id);
    assert.equal(row.manufacturerNominalLbFt,lbFt);
    assert.equal(row.sourcePage,page);
    assert.match(row.sourceRow,/^HSS /);
    const g=lib.hssReferenceDimensionsMm(row);
    assert.ok(g.thicknessMm>0);
    const calc=mass.estimatePublicTubeMass({
      shape:row.shape,standard:"aisc-a500",outerDiameterMm:g.outerDiameterMm??undefined,
      widthMm:g.widthMm??undefined,heightMm:g.heightMm??undefined,
      thicknessMm:g.thicknessMm,lengthM:12,bars:2,
    });
    assert.equal(calc.ok,true,id);
    assert.notEqual(lib.hssNominalPublishedKgM(row),calc.weightKgM,id);
    assert.ok(lib.hssAtlasSourceUrl(row.shape).startsWith("https://www.atlastube.com/"));
  }
});

test("CALC-INT3D.3 supports dimension fragments, fraction and decimal walls without synthesized rows",()=>{
  assert.deepEqual(lib.searchHssReferences({shape:"square",query:"6x6"}).map(x=>x.id).sort(),
    ["s-6-250","s-6-313","s-6-375"].sort());
  assert.deepEqual(lib.searchHssReferences({shape:"rectangular",query:"6 × 4"}).map(x=>x.id).sort(),
    ["x-6-4-250","x-6-4-375"].sort());
  assert.deepEqual(lib.searchHssReferences({shape:"rectangular",query:"6x4 3/8"}).map(x=>x.id),["x-6-4-375"]);
  assert.deepEqual(lib.searchHssReferences({shape:"round",query:"12.000 0.625"}).map(x=>x.id),["r-12-625"]);
  assert.deepEqual(lib.searchHssReferences({shape:"square",query:"6×6 5/16"}).map(x=>x.id),["s-6-313"]);
  assert.deepEqual(lib.searchHssReferences({shape:"rectangular",query:"12x8",nominalWallIn:0.25}).map(x=>x.id),["x-12-8-250"]);
  assert.deepEqual(lib.searchHssReferences({shape:"square",query:"__proto__"}),[]);
  assert.deepEqual(lib.searchHssReferences({shape:"square",query:"14x14 1/4"}),[]);
  assert.deepEqual(lib.hssAvailableWalls("square"),[0.25,0.313,0.375]);
  assert.deepEqual(lib.hssAvailableWalls("round"),[0.25,0.375,0.5,0.625]);
});

test("CALC-INT3D.3 new reference keeps mass AISC, manufacturer nominal weight and exact source separate in RFQ",()=>{
  for(const id of ["r-12-625","s-6-313","x-12-8-250"]){
    const row=lib.findHssReference(id);
    const g=lib.hssReferenceDimensionsMm(row);
    const item=bridge.buildUsPipeRfqItem({
      mode:"hss",productStandard:"astm-a500",hssShape:row.shape,
      ...(g.outerDiameterMm!=null?{outerDiameterMm:g.outerDiameterMm}:{widthMm:g.widthMm,
        ...(g.heightMm!=null?{heightMm:g.heightMm}:{})}),
      thicknessMm:g.thicknessMm,hssReferenceId:row.id,lengthM:12,bars:4,
    },"hss-new-123456",now);
    assert.ok(item,id);
    const s=bridge.usPipeRfqSpecification(item);
    assert.equal(s.sampleId,id);
    assert.equal(s.calculationMethod,"aisc-a500");
    assert.equal(s.publisherPage,row.sourcePage);
    assert.ok(Math.abs(s.publishedKgM-lib.hssNominalPublishedKgM(row))<1e-9);
    assert.notEqual(s.publishedKgM,s.theoreticalKgM);
    assert.match(s.provenanceNote,/not certified/i);
    assert.equal(bridge.validUsPipeRfqItem({...item,thicknessMm:item.thicknessMm+0.001},now),null);
  }
  const v1=read("../lib/calculator-rfq-handoff.ts");
  assert.match(v1,/sss:calc-rfq-handoff:v1/);
  const api=bridge.buildUsPipeRfqItem({sampleId:"6-40",productStandard:"api5l",lengthM:12,bars:1},"api-old-1234",now);
  assert.ok(api);
  assert.equal(bridge.usPipeRfqSpecification(api).shape,"round");
});

test("CALC-INT3D.3 UI adds accessible source search, wall filter, live count and clear without new network",()=>{
  assert.match(ui,/searchHssReferences\(/);
  assert.match(ui,/hssAvailableWalls\(/);
  assert.match(ui,/type="search"/);
  assert.match(ui,/aria-live="polite"/);
  assert.match(ui,/filteredReferences\.map/);
  assert.match(ui,/t\.clearFilters/);
  assert.ok(ui.includes('setReferenceId("");'));
  assert.match(ui,/referenceOutsideFilter/);
  assert.doesNotMatch(ui,/fetch\(|supabase|router\.push|window\.location\.reload/);
});
