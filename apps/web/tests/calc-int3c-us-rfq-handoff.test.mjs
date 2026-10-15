import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const read=p=>readFileSync(new URL(p,import.meta.url),"utf8");
const asModule=s=>ts.transpileModule(s,{compilerOptions:{
  module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,
}}).outputText;
const data=s=>"data:text/javascript;base64,"+Buffer.from(s).toString("base64");
const sample=await import(data(asModule(read("../lib/us-pipe-catalog-sample.ts"))));
const engine=await import(data(asModule(read("../lib/international-tube-mass.ts"))));
const source=read("../lib/us-pipe-rfq-handoff.ts");
const compiled=asModule(source)
  .replaceAll('"@/lib/international-tube-mass"',JSON.stringify(data(asModule(read("../lib/international-tube-mass.ts")))))
  .replaceAll('"@/lib/us-pipe-catalog-sample"',JSON.stringify(data(asModule(read("../lib/us-pipe-catalog-sample.ts")))));
const bridge=await import(data(compiled));
const it=read("../components/buyer-distinta-builder.tsx");
const en=read("../components/english-rfq-bill-builder.tsx");
const us=read("../components/us-pipe-sample-calculator.tsx");
const original=read("../lib/calculator-rfq-handoff.ts");

const now=Date.now();
const input={sampleId:"6-40",productStandard:"api5l",lengthM:12,bars:10};
const make=(patch={})=>({...bridge.buildUsPipeRfqItem(input,"us-rfq-123456",now),...patch});
function storage(){
  const s=new Map();
  return {getItem:k=>s.get(k)??null,setItem:(k,v)=>s.set(k,v),removeItem:k=>s.delete(k),inspect:k=>s.get(k)};
}

test("CALC-INT3C separates US v2 from EN/geometric v1, without unsupported API calculations",()=>{
  assert.equal(bridge.US_PIPE_RFQ_KEY,"sss:us-pipe-rfq-handoff:v2");
  assert.equal(bridge.US_PIPE_RFQ_TTL_MS,10*60*1000);
  assert.match(original,/CALC_RFQ_HANDOFF_KEY = "sss:calc-rfq-handoff:v1"/);
  assert.match(original,/version: 1/);
  const invalid=engine.calculateTubeSection({shape:"round",standard:"api5l",outerDiameterMm:168.3,thicknessMm:7.11});
  assert.equal(invalid.ok,false);
});
test("CALC-INT3C source-bound product intent and theoretical mass do not promote published weight",()=>{
  for(const productStandard of ["api5l","astm-a53","astm-a106"]){
    const item=make({productStandard});
    const spec=bridge.usPipeRfqSpecification(item);
    assert.ok(spec);
    assert.match(spec.standardLabel,productStandard==="api5l"?/API/:/ASTM/);
    assert.equal(spec.designation,"NPS 6 Sch/Class 40");
    assert.equal(spec.outerDiameterMm,168.3);
    assert.equal(spec.wallMm,7.11);
    assert.equal(spec.bars,10);
    assert.equal(spec.lengthM,12);
    assert.equal(spec.publishedKgM,28.26);
    const geometric=engine.estimatePublicTubeMass({
      shape:"round",standard:"geometric",outerDiameterMm:168.3,
      thicknessMm:7.11,lengthM:12,bars:10,
    });
    assert.equal(geometric.ok,true);
    assert.equal(spec.theoreticalKgM,geometric.weightKgM);
    assert.match(spec.provenanceNote,/not certified/);
    assert.match(spec.provenanceNote,/p\.49/);
  }
  assert.equal(bridge.buildUsPipeRfqItem({...input,sampleId:"999-40"},"us-rfq-123456",now),null);
  assert.equal(sample.US_PIPE_MANUFACTURER_SAMPLE.length,20);
});
test("CALC-INT3C fails closed on tampering, expiry, fractional bars and unknown standards",()=>{
  for(const patch of [
    {version:1},{id:"bad"},{createdAt:now-bridge.US_PIPE_RFQ_TTL_MS-1},
    {createdAt:now+2000},{sampleId:"6-999"},{productStandard:"__proto__"},
    {productStandard:"asme-b3610"},{bars:0},{bars:1.25},{bars:Infinity},
    {lengthM:0},{lengthM:2000},{lengthM:NaN},
  ]){
    assert.equal(bridge.validUsPipeRfqItem(make(patch),now),null,JSON.stringify(patch));
  }
  assert.equal(bridge.validUsPipeRfqItem(make(),now).version,2);
});
test("CALC-INT3C bounded tab-local queue does not touch v1 or reimport consumed ids",()=>{
  const store=storage();
  store.setItem("sss:calc-rfq-handoff:v1","original-v1");
  const item=make();
  assert.equal(bridge.enqueueUsPipeRfq(store,item),true);
  assert.equal(bridge.enqueueUsPipeRfq(store,item),false);
  assert.equal(bridge.readUsPipeRfqQueue(store,now).length,1);
  assert.equal(store.inspect("sss:calc-rfq-handoff:v1"),"original-v1");
  store.setItem(bridge.US_PIPE_RFQ_KEY,JSON.stringify([item,item,make({id:"valid-two-567"})]));
  assert.equal(bridge.readUsPipeRfqQueue(store,now).length,2);
  bridge.consumeUsPipeRfqIds(store,[item.id]);
  assert.equal(bridge.readUsPipeRfqQueue(store,now).length,1);
  bridge.consumeUsPipeRfqIds(store,["valid-two-567"]);
  assert.equal(bridge.readUsPipeRfqQueue(store,now).length,0);
  assert.equal(store.inspect("sss:calc-rfq-handoff:v1"),"original-v1");
  store.setItem(bridge.US_PIPE_RFQ_KEY,JSON.stringify([make({productStandard:"fake"})]));
  assert.equal(bridge.readUsPipeRfqQueue(store,now).length,0);
});
test("CALC-INT3C wires full US source intent to both RFQ bills but never automatic sends",()=>{
  assert.match(us,/buildUsPipeRfqItem\(/);
  assert.match(us,/enqueueUsPipeRfq\(window\.sessionStorage,item\)/);
  assert.match(us,/window\.location\.assign\(locale === "it" \? "\/distinta" : "\/en\/distinta"\)/);
  assert.match(it,/readUsPipeRfqQueue\(window\.sessionStorage\)/);
  assert.match(it,/usPipeRfqSpecification\(item\)/);
  assert.match(it,/standard:spec\.standardLabel/);
  assert.match(it,/note:`\$\{spec\.provenanceNote\}/);
  assert.match(en,/readUsPipeRfqQueue\(window\.sessionStorage\)/);
  assert.match(en,/usPipeRfqSpecification\(item\)/);
  assert.match(en,/Requested US product specification/);
  assert.match(en,/usProductIntent/);
  assert.match(en,/consumeUsPipeRfqIds\(window\.sessionStorage/);
  assert.match(en,/usProductIntent:geometryChanged \? undefined : line\.usProductIntent/);
  assert.match(original,/calculatorItemToBuyerLine\(/);
  assert.doesNotMatch(source,/dispatchRfq|createClient\(|supabase\.from|fetch\(/);
});
