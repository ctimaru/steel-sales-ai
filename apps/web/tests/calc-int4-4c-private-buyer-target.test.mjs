import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";
import ts from "typescript";

const read=p=>readFileSync(new URL(p,import.meta.url),"utf8");
const compile=code=>ts.transpileModule(code,{compilerOptions:{
  target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,
}}).outputText;
const strip=source=>source.replace(/^import\s+[\s\S]*?\s+from\s+["'][^"']+["'];\s*/gmu,"").replace(/^export /gmu,"");
const pricing=new Function(strip(compile(read("../lib/calculator-commercial-pricing.ts")))+
  "\nreturn {parseCommercialRate,convertCommercialRate};")();
const buyer=new Function(strip(compile(read("../lib/buyer-distinta.ts")))+
  "\nreturn {calculateBuyerDistintaLine};")();
const src=read("../lib/calculator-inline-buyer-target.ts");
const target=new Function("parseCommercialRate","convertCommercialRate","calculateBuyerDistintaLine",
  strip(compile(src))+"\nreturn {captureBuyerTargetCandidate,matchesBuyerTargetWeight,"+
  "assignBuyerTargetToLine,editBuyerTargetForLine,removeBuyerTarget,pruneBuyerTargets,buyerTargetPreview};"
)(pricing.parseCommercialRate,pricing.convertCommercialRate,buyer.calculateBuyerDistintaLine);
const line=(id,kgM="20",patch={})=>({
  id,description:"Tubo quadro 100 × 100 × 5 mm",standard:"EN 10219",
  grade:"",finish:"",quantityMode:"bars",quantity:"4",barLengthM:"12",
  weightKgM:kgM,targetEurT:"",note:"Peso teorico",...patch,
});
const initial={lines:[line("buyer-line01"),line("buyer-line02","30")]};

test("4.4C last-edited €/ton is canonical, computed €/m uses theoretical kg/m",()=>{
  const c=target.captureBuyerTargetCandidate("850,00","tonne",20);
  assert.deepEqual(c,{priceEurT:850,sourceKgM:20});
  assert.equal(target.matchesBuyerTargetWeight(initial.lines[0],c),true);
  assert.equal(target.matchesBuyerTargetWeight(initial.lines[1],c),false);
  const saved=target.assignBuyerTargetToLine(initial,{},"buyer-line01",c);
  assert.equal(saved.ok,true);
  assert.deepEqual(saved.targets,{"buyer-line01":850});
  const preview=target.buyerTargetPreview(initial.lines[0],saved.targets);
  assert.equal(preview.eurT,850);
  assert.equal(preview.eurM,17);
  assert.equal(preview.estimatedTotal,816);
  assert.equal(initial.lines[0].targetEurT,"","original public bill remains price-free");
});
test("4.4C last-edited €/m reverses accurately without displayed rounding feedback",()=>{
  const c=target.captureBuyerTargetCandidate("17,00","metre",20);
  assert.equal(c.priceEurT,850);
  const tiny=target.captureBuyerTargetCandidate("0,1234","metre",19.999);
  assert.ok(tiny && tiny.priceEurT>6.1703 && tiny.priceEurT<6.1704);
  const edited=target.editBuyerTargetForLine(initial,{},"buyer-line02","24,60","metre");
  assert.equal(edited.ok,true);
  const p=target.buyerTargetPreview(initial.lines[1],edited.targets);
  assert.equal(p.eurM,24.60);
  assert.equal(p.eurT,820);
});
test("4.4C rejects zero, invalid rate, invalid kg/m and huge or stale selection",()=>{
  for(const [rate,basis,weight] of [
    ["0","tonne",20],["","tonne",20],["abc","tonne",20],
    ["850","tonne",0],["850","tonne",Number.NaN],
    ["12.345,6,7","tonne",20],["100000001","tonne",20],
  ])assert.equal(target.captureBuyerTargetCandidate(rate,basis,weight),null);
  const candidate=target.captureBuyerTargetCandidate("850","tonne",20);
  assert.deepEqual(target.assignBuyerTargetToLine(initial,{},"buyer-line02",candidate),
    {ok:false,reason:"weight-mismatch"});
  assert.deepEqual(target.assignBuyerTargetToLine(initial,{},"absent0001",candidate),
    {ok:false,reason:"missing"});
});
test("4.4C edit/remove and prune targets are independent between line IDs",()=>{
  const ca=target.captureBuyerTargetCandidate("850","tonne",20);
  const cb=target.captureBuyerTargetCandidate("900","tonne",30);
  const a=target.assignBuyerTargetToLine(initial,{},"buyer-line01",ca);
  const b=target.assignBuyerTargetToLine(initial,a.targets,"buyer-line02",cb);
  assert.equal(b.ok,true);
  const c=target.editBuyerTargetForLine(initial,b.targets,"buyer-line01","920","tonne");
  assert.deepEqual(c.targets,{"buyer-line01":920,"buyer-line02":900});
  const removed=target.removeBuyerTarget(c.targets,"buyer-line01");
  assert.deepEqual(removed,{"buyer-line02":900});
  assert.deepEqual(target.pruneBuyerTargets({lines:[initial.lines[0]]},c.targets),{"buyer-line01":920});
  assert.equal(b.targets["buyer-line01"],850,"previous state unchanged");
  assert.equal(initial.lines[1].targetEurT,"");
});
test("4.4C price never appears in 4.4A session or public copy and is never sent",()=>{
  const experience=read("../components/calculator-inline-distinta-experience.tsx");
  const publicCalc=read("../components/public-tube-weight-calculator.tsx");
  const pricingComponent=read("../components/calculator-commercial-pricing.tsx");
  const bill=read("../lib/calculator-inline-distinta.ts");
  assert.match(bill,/targetEurT: ""/);
  assert.match(bill,/value.targetEurT !== ""/);
  assert.match(experience,/const \[targets, setTargets\] = useState<BuyerTargetState>\(\{\}\)/);
  assert.match(experience,/onChooseBuyerTarget=\{chooseBuyerTarget\}/);
  assert.match(experience,/setTargets\(current => pruneBuyerTargets/);
  assert.match(experience,/buildBuyerDistintaPlainText\(c.quoteTitle, calculated\)/);
  assert.match(publicCalc,/onChooseBuyerTarget=\{onChooseBuyerTarget\}/);
  assert.match(pricingComponent,/data-target-opt-in/);
  for(const file of [src,pricingComponent]){
    assert.doesNotMatch(file,/fetch\(|localStorage|document.cookie|trackProductEvent|sendBuyerDistinta|createBuyerRfqCampaign/);
  }
  assert.doesNotMatch(experience,/persistInlineDistintaSession\([^\n]*targets/);
  assert.doesNotMatch(experience,/JSON.stringify\(targets\)/);
});
