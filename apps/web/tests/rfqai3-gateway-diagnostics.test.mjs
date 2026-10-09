import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import ts from "typescript";

const protocol = fs.readFileSync(new URL("../lib/rfq-ai-gateway-protocol.ts",import.meta.url),"utf8");
const action = fs.readFileSync(new URL("../app/(workspace)/rfq-hub/distinta/ai-actions.ts",import.meta.url),"utf8");
const js = ts.transpileModule(protocol, {
  compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}
}).outputText.replace(/^export /gm,"");
const gateway=new Function(js+"\nreturn {RFQAI3_RESPONSE_FORMAT,RfqAiGatewayOutputError,readRfqAiGatewayOutput,rfqAiGatewayHttpFailure,rfqAiGatewayOutputFailure};")();

test("RFQAI3 requests strict schema, with explicit all-fields-strings and no unapproved commercial overrides",()=>{
  const format=gateway.RFQAI3_RESPONSE_FORMAT;
  assert.equal(format.type,"json_schema");
  assert.equal(format.json_schema.strict,true);
  const root=format.json_schema.schema;
  assert.deepEqual(root.required,["intent","lines"]);
  assert.equal(root.additionalProperties,false);
  assert.equal(root.properties.lines.items.additionalProperties,false);
  const line=root.properties.lines.items;
  assert.equal(line.required.length,Object.keys(line.properties).length);
  assert.ok(line.required.includes("sourceText"));
  assert.ok(line.required.includes("quantity"));
  assert.equal(line.properties.lengthMm.type,"string");
  assert.equal(line.properties.standard.type,"string");
  assert.ok(!line.properties.approvalState);
  assert.ok(!line.properties.targetEurT);
  assert.ok(!line.properties.weightKgM);
  assert.ok(!root.properties.organizationId);
  assert.match(action,/reasoning: \{ effort: "none" \}/);
  assert.match(action,/temperature: 0\.2/);
  assert.match(action,/max_tokens: 5000/);
  assert.match(action,/controller\.abort\(\), 45_000/);
});

test("RFQAI3 accepts JSON string body and exact fenced JSON, never executes source text",()=>{
  const value={intent:"buyer_request",lines:[]};
  for(const content of [JSON.stringify(value),"```json\n"+JSON.stringify(value)+"\n```"]){
    assert.deepEqual(gateway.readRfqAiGatewayOutput({
      choices:[{finish_reason:"stop",message:{content}}]
    }),value);
  }
});

test("RFQAI3 classifies empty, truncated, malformed or missing Chat Completion bodies",()=>{
  const cases=[
    [{choices:[{finish_reason:"length",message:{content:'{"lines":[]}'}}]}],"truncated"],
    [{choices:[{finish_reason:"stop",message:{content:""}}]},"empty"],
    [{choices:[{finish_reason:"stop",message:{content:"bad"}}]},"invalid_json"],
    [{choices:[{finish_reason:"stop",message:{content:"[1,2]"}}]},"invalid_envelope"],
    [{hello:true},"empty"],
  ];
  for(const [payload,kind] of cases){
    assert.throws(()=>gateway.readRfqAiGatewayOutput(payload),{name:"Error",kind});
  }
  assert.match(gateway.rfqAiGatewayOutputFailure("truncated"),/non ha completato/);
  assert.match(gateway.rfqAiGatewayOutputFailure("empty"),/vuota/);
});

test("RFQAI3 maps credential, credits, format, rate limits, model and upstream errors to distinct actionable statuses",()=>{
  const expected=[
    [400,"request"],[401,"credential"],[403,"credential"],[402,"budget"],
    [404,"model"],[408,"timeout"],[422,"request"],[429,"rate_limit"],
    [500,"upstream"],[503,"upstream"],
  ];
  for(const [code,kind] of expected){
    const out=gateway.rfqAiGatewayHttpFailure(code);
    assert.equal(out.kind,kind,String(code));
    assert.ok(out.message.length>20);
    assert.doesNotMatch(out.message,/Bearer |sk-|key_[A-Za-z0-9]{8,}/);
  }
  assert.match(action,/diagnostic\(failure.kind, response.status\)/);
  assert.match(action,/if \(controller.signal.aborted\)/);
  assert.match(action,/phase === "candidate_validation"/);
  assert.doesNotMatch(action,/console\.(warn|error|log)\([^\n]*(?:token|text|answer|content)/);
});
