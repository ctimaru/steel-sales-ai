import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
import ts from "typescript";
const read=p=>readFileSync(new URL(p,import.meta.url),"utf8");
const compile=s=>ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const strip=s=>s.replace(/^import\s+[\s\S]*?\s+from\s+["'][^"']+["'];\s*/gmu,"").replace(/^export /gmu,"");
const buyer=new Function(strip(compile(read("../lib/buyer-distinta.ts")))+"\nreturn {calculateBuyerDistintaLine};")();
const projection=new Function(strip(compile(read("../lib/buyer-distinta-supplier-redaction.ts")))+"\nreturn supplierVisibleBuyerLines;")();
const privateSource=read("../lib/calculator-inline-private-rfq.ts");
const redactionSource=read("../app/(italian)/(public)/distinta/actions.ts");
const billSource=read("../components/calculator-inline-distinta-experience.tsx");
const portalSource=read("../app/(italian)/(public)/rfq/respond/[token]/page.tsx");
const row=(id,kgM="20")=>({id,description:"Tubo tondo Ø 168,3 × 6",standard:"EN 10219",grade:"",
 finish:"",quantityMode:"bars",quantity:"4",barLengthM:"12",weightKgM:kgM,targetEurT:"",note:""});
const inlineBuyerLines=state=>state.lines.length?state.lines.map(v=>({...v,targetEurT:""})):null;
const targetPreview=(line,targets)=>{
 const price=targets[line.id];
 if(!price||price<=0||!Number.isFinite(price))return null;
 const result=buyer.calculateBuyerDistintaLine({...line,targetEurT:String(price)});
 return result.complete?{eurT:result.targetEurT,eurM:result.targetEurM,estimatedTotal:result.targetTotalEur}:null;
};
const fn=new Function("calculateBuyerDistintaLine","inlineDistintaBuyerLines","buyerTargetPreview",
 strip(compile(privateSource))+"\nreturn {prepareInlinePrivateRfq,privateRfqSnapshotSignature};");
const {prepareInlinePrivateRfq,privateRfqSnapshotSignature}=fn(buyer.calculateBuyerDistintaLine,inlineBuyerLines,targetPreview);
const state={lines:[row("line-a0001"),row("line-b0002","30")]};
test("4.4D private snapshot defaults to technical-only without consent",()=>{
 const result=prepareInlinePrivateRfq(state,{"line-a0001":850},false);
 assert.equal(result.ok,true);
 assert.equal(result.withTargets,0);
 assert.deepEqual(result.snapshot.lines.map(x=>x.targetEurT),["",""]);
 assert.equal(state.lines[0].targetEurT,"");
});
test("4.4D explicit consent adds only selected valid buyer target",()=>{
 const result=prepareInlinePrivateRfq(state,{"line-a0001":850},true);
 assert.equal(result.ok,true);
 assert.equal(result.withTargets,1);
 assert.equal(result.snapshot.lines[0].targetEurT,"850");
 assert.equal(result.snapshot.lines[1].targetEurT,"");
 assert.equal(buyer.calculateBuyerDistintaLine(result.snapshot.lines[0]).targetEurM,17);
 assert.equal(result.snapshot.title,"Richiesta di offerta dal calcolatore");
});
test("4.4D incomplete, empty or broken rows block RFQ creation",()=>{
 assert.equal(prepareInlinePrivateRfq({lines:[]},{},false).ok,false);
 const broken={lines:[{...row("line-invalid"),quantity:"0"}]};
 // The canonical 4.4A adapter will reject this; the builder still guards.
 assert.equal(prepareInlinePrivateRfq(broken,{},false).ok,false);
});
test("4.4D snapshot signature changes on content or target opt-in, no state is mutated",()=>{
 const a=prepareInlinePrivateRfq(state,{ "line-a0001":850 },true);
 const b=prepareInlinePrivateRfq(state,{ "line-a0001":850 },false);
 assert.notEqual(privateRfqSnapshotSignature(a.snapshot),privateRfqSnapshotSignature(b.snapshot));
 const c=prepareInlinePrivateRfq({lines:[{...state.lines[0],quantity:"8"},state.lines[1]]},{ "line-a0001":850 },true);
 assert.notEqual(privateRfqSnapshotSignature(a.snapshot),privateRfqSnapshotSignature(c.snapshot));
 assert.equal(state.lines[0].targetEurT,"");
});
test("4.4D supplier email projection removes ALL private buyer target numbers",()=>{
 const priced=buyer.calculateBuyerDistintaLine({...row("line-a0001"),targetEurT:"850"});
 const publicLine=projection([priced])[0];
 assert.equal(priced.targetEurT,850);
 assert.equal(priced.targetEurM,17);
 assert.equal(publicLine.targetEurT,null);
 assert.equal(publicLine.targetEurM,null);
 assert.equal(publicLine.targetTotalEur,null);
 assert.equal(publicLine.weightKgM,priced.weightKgM);
 assert.match(redactionSource,/supplierVisibleBuyerLines\(exportLines\)/);
 assert.match(redactionSource,/buildBuyerDistintaPlainText\(title, supplierVisibleBuyerLines\(exportLines\), documents, false\)/);
 assert.match(redactionSource,/buildBuyerDistintaHtml\(title, supplierVisibleBuyerLines\(exportLines\), documents, false\)/);
 const formatSrc=read("../lib/buyer-distinta.ts");
 assert.match(formatSrc,/includeBuyerTargets = true/);
 assert.match(formatSrc,/includeBuyerTargets/);
 assert.doesNotMatch(portalSource,/target_eur_t|target_eur_m|target_total_eur/);
});
test("4.4D browser redaction remains 4.4A while auth is click-only and RFQ never auto-dispatches",()=>{
 assert.match(billSource,/createPrivateRfqOneStep\(\{/);
 assert.match(billSource,/await inlinePrivateRfqAccess\(\)/);
 assert.match(billSource,/includePrivateTargets, setIncludePrivateTargets\] = useState\(false\)/);
   assert.match(billSource,/data-create-inline-private-rfq[\s\S]*?onClick=\{\(\)\s*=>\s*\{\s*void createPrivateRfq\(\);\s*\}\}/);
 assert.match(billSource,/savedSnapshotRef\.current\?\.signature === signature/);
 assert.match(billSource,/createBuyerRfqCampaign\(savedId\)/);
 assert.match(billSource,/router\.push\(appRoutes\.rfqHub\.campaign\(result\.rfqId\)\)/);
  assert.match(billSource,/encodeURIComponent\(CALCULATOR_ROUTES\[locale\]\+"\\?resume=rfq"\)/);
 assert.doesNotMatch(billSource,/sendBuyerDistinta|sendSupplier|launchCampaign|publishMarketplace/);
 assert.doesNotMatch(privateSource,/sessionStorage|localStorage|cookie|fetch\(|sendBuyerDistinta/);
 const server=read("../app/(italian)/(public)/knowledge/tubes/actions.ts");
 assert.match(server,/supabase\.auth\.getUser\(\)/);
 assert.match(server,/\.from\("organization_memberships"\)/);
 assert.match(server,/\.eq\("status","active"\)/);
});
