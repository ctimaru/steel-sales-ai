import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import ts from "typescript";

const read=p=>readFileSync(new URL(p,import.meta.url),"utf8");
function loadTS(path,deps={}){
 const compiled=ts.transpileModule(read(path),{compilerOptions:{
  target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,
 }}).outputText;
 const module={exports:{}};
 new Function("module","exports","require",compiled)(module,module.exports,
  name=>{if(name in deps)return deps[name];throw Error("Unexpected dependency "+name);});
 return module.exports;
}
const actualBuyer=loadTS("../lib/buyer-distinta.ts",{
 "@/lib/buyer-distinta-documents":{formatBuyerDocumentRequirements:()=>""},
});
const {networkReviewedHandoffKey,serializeNetworkReviewedHandoff,parseNetworkReviewedHandoff}=loadTS(
 "../lib/network-reviewed-rfq-handoff.ts",{"@/lib/buyer-distinta":actualBuyer});

const userA="00000000-0000-0000-0000-0000000000a1";
const userB="00000000-0000-0000-0000-0000000000b1";
const companyA="00000000-0000-0000-0000-0000000000c1";
const companyB="00000000-0000-0000-0000-0000000000d1";
const line={
 id:"text-1",description:"Tubo quadro 100 × 100 × 5 mm",standard:"EN 10219",
 grade:"S235JRH",finish:"",quantityMode:"bars",quantity:"40",
 barLengthM:"3",weightKgM:"14,6",targetEurT:"",note:"",
};
test("COMPACT6D user and tenant scoped keys never collide",()=>{
 assert.notEqual(networkReviewedHandoffKey(userA,companyA),networkReviewedHandoffKey(userB,companyA));
 assert.notEqual(networkReviewedHandoffKey(userA,companyA),networkReviewedHandoffKey(userA,companyB));
 assert.throws(()=>networkReviewedHandoffKey("unknown",companyA));
});
test("COMPACT6D complete, explicitly reviewed lines can transfer for only 15 min",()=>{
 assert.equal(actualBuyer.calculateBuyerDistintaLine(line).complete,true);
 const now=1792411200000;
 const raw=serializeNetworkReviewedHandoff([line],now);
 assert.ok(raw);
 assert.deepEqual(parseNetworkReviewedHandoff(raw,now+60_000)?.lines,[line]);
 assert.equal(parseNetworkReviewedHandoff(raw,now+15*60*1000+1),null);
 assert.equal(parseNetworkReviewedHandoff(raw,now-65_000),null);
});
test("COMPACT6D rejects invalid geometries, missing grades, invalid norms, unknown fields, many lines",()=>{
 for(const invalid of [
  {...line,quantity:"0"}, {...line,quantity:"0.5"},{...line,barLengthM:"0"},
  {...line,weightKgM:""},{...line,grade:""},{...line,standard:"EN 10216-2"},
  {...line,secretSupplierEmail:"foo@example.test"},
  {...line,description:"X".repeat(600)},{...line,quantityMode:"pieces"},
 ])assert.equal(serializeNetworkReviewedHandoff([invalid]),null);
 assert.equal(serializeNetworkReviewedHandoff([]),null);
 assert.equal(serializeNetworkReviewedHandoff(Array.from({length:31},(_,i)=>({...line,id:"l"+i}))),null);
 assert.equal(serializeNetworkReviewedHandoff([line,line]),null);
});
test("COMPACT6D refuses tampering and storage payload escalation",()=>{
 const raw=serializeNetworkReviewedHandoff([line]);
 assert.ok(raw);
 const data=JSON.parse(raw);
 assert.equal(parseNetworkReviewedHandoff("{oops"),null);
 assert.equal(parseNetworkReviewedHandoff(raw+" ".repeat(50000)),null);
 data.lines[0].quantityMode="boxes";
 assert.equal(parseNetworkReviewedHandoff(JSON.stringify(data)),null);
});
test("COMPACT6D reuses existing verified RFQAI3 parser and human approval UI",()=>{
 const bridge=read("../components/network-rfq-bridge.tsx");
 const chat=read("../components/network-conversation.tsx");
 const review=read("../components/rfq-ai-text-review.tsx");
 const aiAction=read("../app/(italian)/(workspace)/rfq-hub/distinta/ai-actions.ts");
 assert.match(bridge,/analyzeRfqAiFreeText\(sourceText\)/);
 assert.match(bridge,/<RfqAiTextReview/);
 assert.match(bridge,/serializeNetworkReviewedHandoff\(lines\)/);
 assert.match(bridge,/parseNetworkReviewedHandoff\(window.sessionStorage.getItem\(key\)\)/);
 assert.match(bridge,/router.push\("\/commercial\?compose=1&source=network#commercial-compose"\)/);
 assert.match(chat,/sourceText:query/);
 assert.match(chat,/<NetworkRfqBridge key=\{latestAssistant\?\.id\} sourceText=\{rfqSource\}/);
 assert.match(chat,/const rfqSource=latestAssistant\?\.result\?\.status==="rfq"/);
 assert.match(review,/confirmed\[candidate.candidateId\] && canConfirm\(candidate\)/);
 assert.match(review,/calculateBuyerDistintaLine\(row.proposedLine\).complete/);
 assert.match(aiAction,/requireWorkspaceWriteRole/);
 assert.doesNotMatch(bridge,/createBuyerRfqCampaign|sendBuyerDistinta|createPrivateRfqOneStep/);
});
test("COMPACT6D Commerciale shows a separate import decision and only appends to existing Distinta",()=>{
 const builder=read("../components/buyer-distinta-builder.tsx");
 const commercial=read("../app/(italian)/(workspace)/commercial/page.tsx");
 const free=read("../components/free-network-directory.tsx");
 const pro=read("../app/(italian)/(workspace)/network/page.tsx");
 const network=read("../components/network-compact-experience.tsx");
 assert.match(builder,/parseNetworkReviewedHandoff\(raw\)/);
 assert.match(builder,/networkReviewedHandoffKey\(userId,organizationId\)/);
 assert.match(builder,/insertRfqAiTextLines\(networkHandoff.lines\)/);
 assert.match(builder,/data-testid="network-reviewed-rfq-import"/);
 assert.match(builder,/Scarta passaggio/);
 assert.match(builder,/const base = recyclable \? \[\] : current/);
 assert.match(commercial,/organizationId=\{context.organizationId\}/);
 assert.match(pro,/canCompose=\{canWriteWorkspace\(context.role\)\}/);
 assert.match(free,/userId=\{userId\} organizationId=\{organizationId\} canCompose=\{canCompose\}/);
 assert.match(network,/<NetworkConversation userId=\{userId\} organizationId=\{organizationId\} canCompose=\{canCompose\}\/>/);
});
test("COMPACT6D text is not exposed in the URL and no RFQ is sent autonomously",()=>{
 const bridge=read("../components/network-rfq-bridge.tsx");
 const handoff=read("../lib/network-reviewed-rfq-handoff.ts");
 assert.doesNotMatch(bridge,/localStorage|fetch\(|createBuyerRfqCampaign|sendBuyerDistinta/);
 assert.match(handoff,/MAX_AGE_MS=15\*60\*1000/);
 assert.match(bridge,/Nessun testo commerciale viene inserito nell\x27URL/);
 assert.match(bridge,/Non si crea né si invia alcuna RFQ/);
});
