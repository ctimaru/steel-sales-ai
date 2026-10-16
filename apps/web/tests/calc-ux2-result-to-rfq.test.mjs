import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";
import ts from "typescript";

const read=p=>readFileSync(new URL(p,import.meta.url),"utf8");
const source=read("../lib/calculator-rfq-handoff.ts");
const calculator=read("../components/public-tube-weight-calculator.tsx");
const it=read("../components/buyer-distinta-builder.tsx");
const en=read("../components/english-rfq-bill-builder.tsx");
const enCopy=read("../lib/rfq-bill-localization.ts");
const enPage=read("../app/en/distinta/page.tsx");
const itPage=read("../app/(public)/distinta/page.tsx");
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const bridge=await import("data:text/javascript;base64,"+Buffer.from(compiled).toString("base64"));
const makeStore=()=>{
  const data=new Map();
  return {getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,String(v)),removeItem:k=>data.delete(k)};
};
const now=Date.UTC(2026,9,12,10);
const example=(patch={})=>({
  family:"rectangular_tube",standard:"en10219",outerDiameter:"",width:"120",height:"80",
  thickness:"5",length:"12",quantity:"7",density:"7850",kgM:13.71,...patch,
});
const sample=(patch={})=>bridge.calculatorRfqFromValues(example(patch),"calc-abc123",now);

test("CALC-UX2 validates and transfers geometry, theoretical mass, full bars, standard and density",()=>{
  const r=sample();
  assert.equal(r?.standard,"en10219");
  assert.equal(r?.family,"rectangular_tube");
  assert.equal(r?.bars,7);
  assert.equal(r?.kgM,13.71);
  const itLine=bridge.calculatorItemToBuyerLine(r,"row1");
  assert.match(itLine.description,/Tubo rettangolare 120 × 80 × 5 mm/);
  assert.equal(itLine.quantityMode,"bars");
  assert.equal(itLine.quantity,"7");
  assert.equal(itLine.barLengthM,"12");
  assert.equal(itLine.standard,"EN 10219");
  assert.equal(itLine.grade,"");
  assert.equal(itLine.targetEurT,"");
  assert.match(itLine.weightKgM,/13,71/);
  assert.match(itLine.note,/teorico/);
  const free=sample({standard:"geometric",density:"8100",kgM:14.65});
  assert.equal(free.density,8100);
  assert.equal(bridge.calculatorItemToBuyerLine(free,"row2").standard,"Calcolo geometrico libero");
});

test("CALC-UX2 rejects invalid handoff payloads, stale storage and inaccurate manual inputs",()=>{
  for(const p of [
    {quantity:"1.5"},{quantity:"0"},{quantity:"-3"},{length:"0"},
    {thickness:"abc"},{thickness:"42"},{width:"10"},{height:"6"},
    {density:"0",standard:"geometric"},{kgM:0},{standard:"random"},
  ])assert.equal(sample(p),null,JSON.stringify(p));
  const good=sample();
  assert.equal(bridge.validatedCalculatorRfqItem({...good,createdAt:now-bridge.CALC_RFQ_HANDOFF_TTL_MS-1},now),null);
  assert.equal(bridge.validatedCalculatorRfqItem({...good,standard:"en10210",density:7900},now),null);
  assert.equal(bridge.validatedCalculatorRfqItem({...good,bars:1.2},now),null);
  assert.equal(bridge.validatedCalculatorRfqItem({...good,id:"../../unsafe"},now),null);
});

test("CALC-UX2 queue is one-time, bounded, distinct and tab scoped",()=>{
  const storage=makeStore();
  const a=sample(),b=bridge.calculatorRfqFromValues(example({standard:"en10210"}),"calc-xyz456",now);
  // enqueue validates age against the current clock, so synthesize fresh records.
  const fresh=Date.now();
  const a2={...a,createdAt:fresh},b2={...b,createdAt:fresh};
  assert.equal(bridge.enqueueCalculatorRfq(storage,a2),true);
  assert.equal(bridge.enqueueCalculatorRfq(storage,b2),true);
  assert.deepEqual(bridge.readCalculatorRfqQueue(storage).map(v=>v.id),["calc-abc123","calc-xyz456"]);
  bridge.consumeCalculatorRfqIds(storage,["calc-abc123"]);
  assert.deepEqual(bridge.readCalculatorRfqQueue(storage).map(v=>v.id),["calc-xyz456"]);
  bridge.consumeCalculatorRfqIds(storage,["calc-xyz456"]);
  assert.equal(storage.getItem(bridge.CALC_RFQ_HANDOFF_KEY),null);
  assert.equal(bridge.readCalculatorRfqQueue(storage).length,0);
  const corrupted=makeStore();
  corrupted.setItem(bridge.CALC_RFQ_HANDOFF_KEY,"{");
  assert.deepEqual(bridge.readCalculatorRfqQueue(corrupted),[]);
});

test("CALC-UX2 two public builders consume the same tab queue without overwriting RFQ work",()=>{
  assert.match(calculator,/calculatorRfqFromValues\(currentSnapshot,/);
  assert.match(calculator,/enqueueCalculatorRfq\(window\.sessionStorage, item\)/);
  assert.match(calculator,/window\.location\.assign\(locale === "it" \? "\/distinta" : `\/\$\{locale\}\/distinta`\)/);
  assert.match(calculator,/disabled=\{!currentSnapshot\}/);
  assert.match(it,/readCalculatorRfqQueue\(window\.sessionStorage\)/);
  assert.match(it,/if \(!draftReady \|\| restoreCandidate\) return;/);
  assert.match(it,/setLines\(\(current\) => \{/);
  assert.match(it,/\.\.\.base, \.\.\.imported\.slice/);
  assert.match(it,/consumeCalculatorRfqIds\(window\.sessionStorage,/);
  assert.match(en,/readCalculatorRfqQueue\(window\.sessionStorage\)/);
  assert.match(en,/storedEnglishBill\(window\.sessionStorage\.getItem/);
  assert.match(en,/\.\.\.previous,\.\.\.additions/);
  assert.match(en,/grade:""/);
  assert.match(en,/densityKgM3: line.standard === "geometric"/);
  assert.match(en,/consumeCalculatorRfqIds\(window\.sessionStorage,/);
  assert.match(itPage,/<BuyerDistintaBuilder/);
  assert.match(itPage,/configured \? createClient\(\) : Promise\.resolve\(null\)/);
  assert.match(itPage,/supabase \? \(await supabase\.auth\.getUser\(\)\)\.data : \{ user: null \}/);
  assert.match(enPage,/<EnglishRfqBillBuilder/);
});

test("CALC-UX2 remains no-login, no-catalog writes, no automatic dispatch and preserves SEO",()=>{
  assert.doesNotMatch(source,/fetch\(|sendRfq|dispatchRfq|createClient\(|supabase|localStorage|document\.cookie/);
  assert.doesNotMatch(calculator,/enqueueCalculatorRfq[^\n]*fetch/);
  assert.match(itPage,/canonical: absoluteUrl\("\/distinta"\)/);
  assert.match(enPage,/canonical: absoluteUrl\("\/en\/distinta"\)/);
  assert.match(calculator,/Copy result|Copia risultato/);
  assert.match(enCopy,/No RFQ has been sent/);
  assert.match(en,/RFQ_BILL_TEXT\[locale\]/);
  assert.match(it,/Nessuna RFQ è stata inviata/);
});
