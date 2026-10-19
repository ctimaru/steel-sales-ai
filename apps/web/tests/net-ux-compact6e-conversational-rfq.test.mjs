import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import ts from "typescript";
const read=p=>readFileSync(new URL(p,import.meta.url),"utf8");
const src=read("../lib/network-rfq-guidance.ts");
const js=ts.transpileModule(src,{compilerOptions:{
  target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,
}}).outputText;
const module={exports:{}};
new Function("module","exports",js)(module,module.exports);
const {networkRfqQuestions,appendNetworkRfqDictation,networkRfqTextValid,NETWORK_RFQ_MAX_TEXT}=module.exports;
const issue=(code)=>({code,severity:"warning",field:code});
const candidate=(id,codes,quote="")=>({
  candidateId:id,sourceExcerpt:quote,issues:codes.map(issue),
});
test("COMPACT6E clarification questions are strictly sourced from existing RFQAI3 missing fields",()=>{
  const proposed={candidates:[
    candidate("a",["missing_dimensions","missing_bar_length","missing_grade"],"40 tubi da 3 metri"),
    candidate("b",["missing_quantity","missing_standard","ambiguous_geometry"],"Tubo tondo 60,3x3"),
  ]};
  const questions=networkRfqQuestions(proposed);
  assert.equal(questions.length,2);
  assert.equal(questions[0].questions.length,3);
  assert.ok(questions[0].questions.some(q=>q.includes("forma")));
  assert.ok(questions[0].questions.some(q=>q.includes("ogni singola barra")));
  assert.ok(questions[1].questions.some(q=>q.includes("norma")));
  assert.ok(questions[1].questions.some(q=>q.includes("geometria")));
  assert.doesNotMatch(JSON.stringify(questions),/S355|S235|100.?100/);
});
test("COMPACT6E no false missing question for complete data and no fabricated provenance",()=>{
 const questions=networkRfqQuestions({candidates:[
   candidate("one",[],"testo esatto"),candidate("two",["unsupported_standard"],""),
 ]});
 assert.equal(questions.length,1);
 assert.equal(questions[0].candidateId,"two");
 assert.match(questions[0].label,/provenienza da verificare/);
 assert.match(questions[0].questions[0],/norma/);
});
test("COMPACT6E multiple voice turns append as distinct source lines, never overwrite",()=>{
 const first="40 tubi quadri 100x100x5 EN 10219 S235JRH da 3 metri";
 const added=appendNetworkRfqDictation(first,"20 tubi tondi 60,3x3 EN 10210 S355J2H da 6 metri");
 assert.ok(added);
 assert.equal(added.split("\n").length,2);
 assert.ok(added.startsWith(first));
 assert.ok(added.includes("20 tubi tondi"));
 assert.equal(appendNetworkRfqDictation("", "  40 tubi   quadri  "), "40 tubi quadri");
});
test("COMPACT6E rejects empty dictation, overlong text and NUL",()=>{
 assert.equal(appendNetworkRfqDictation("abc"," \t \n "),null);
 assert.equal(appendNetworkRfqDictation("a".repeat(NETWORK_RFQ_MAX_TEXT),"b"),null);
 assert.ok(appendNetworkRfqDictation("","a".repeat(NETWORK_RFQ_MAX_TEXT)));
 assert.equal(networkRfqTextValid("a".repeat(11)),false);
 assert.equal(networkRfqTextValid("a".repeat(12)),true);
 assert.equal(networkRfqTextValid("a".repeat(NETWORK_RFQ_MAX_TEXT+1)),false);
 assert.equal(networkRfqTextValid("40 tubi\u0000 quadri EN10219"),false);
});
test("COMPACT6E uses existing RFQAI3 secure action and human review: no autonomous dispatch",()=>{
 const bridge=read("../components/network-rfq-bridge.tsx");
 const action=read("../app/(italian)/(workspace)/rfq-hub/distinta/ai-actions.ts");
 const reviewer=read("../components/rfq-ai-text-review.tsx");
 assert.match(bridge,/analyzeRfqAiFreeText\(snapshot\)/);
 assert.match(bridge,/networkRfqQuestions\(result\)/);
 assert.match(bridge,/<RfqAiTextReview result=\{result\}/);
 assert.match(bridge,/serializeNetworkReviewedHandoff\(lines\)/);
 assert.match(action,/requireWorkspaceWriteRole/);
 assert.match(reviewer,/confirmed\[candidate.candidateId\] && canConfirm\(candidate\)/);
 assert.doesNotMatch(bridge,/createBuyerRfqCampaign|sendBuyerDistinta|createPrivateRfqOneStep/);
 assert.match(bridge,/Non si crea né si invia alcuna RFQ/);
});
test("COMPACT6E voice is opt-in; transcripts remain editable and do not auto trigger AI",()=>{
 const bridge=read("../components/network-rfq-bridge.tsx");
 assert.match(bridge,/window.isSecureContext/);
 assert.match(bridge,/webkitSpeechRecognition/);
 assert.match(bridge,/engine.start\(\);setRecording\(true\)/);
 assert.match(bridge,/appendNetworkRfqDictation\(textRef.current,transcript\)/);
 assert.match(bridge,/if\(next!==null\)changeText\(next\)/);
 assert.match(bridge,/onClick=\{analyze\}/);
 assert.match(bridge,/requestVersion.current!==version/);
 assert.match(bridge,/role="alert"/);
 assert.match(bridge,/maxLength=\{NETWORK_RFQ_MAX_TEXT\}/);
 assert.match(bridge,/disabled=\{pending\|\|!networkRfqTextValid\(rfqText\)\}/);
 assert.doesNotMatch(bridge,/localStorage|fetch\(/);
});
