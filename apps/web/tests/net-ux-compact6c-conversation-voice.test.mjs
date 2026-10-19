import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import ts from "typescript";

const read=p=>readFileSync(new URL(p,import.meta.url),"utf8");
const source=read("../lib/network-ai-contract.ts");
const modules={};
function loadModule(){
 const result=ts.transpileModule(source,{compilerOptions:{
  target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,
 }}).outputText;
 const exports={};
 const require=(name)=>{
  if(name==="../lib/network-intent-parser"||name==="./network-intent-parser"||name==="@/lib/network-intent-parser"){
   // Using the real deterministic interpreter, no mocks for safety decisions.
   const parser=read("../lib/network-intent-parser.ts");
   const compiled=ts.transpileModule(parser,{compilerOptions:{
      target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,
   }}).outputText;
   const obj={exports:{}};
   new Function("module","exports",compiled)(obj,obj.exports);
   return obj.exports;
  }
  throw Error("Unrecognized module "+name);
 };
 new Function("exports","require",result)(exports,require);
 return exports;
}
const {validateNetworkAIOutput,looksLikeRfqRequest,mergeNetworkFollowup,
  NETWORK_AI_FORMAT}=loadModule();
const taxonomy={regions:["Lombardia","Veneto","Piemonte"],
 products:[{canonical_key:"tubes_pipes",display_name:"Tubi e tubazioni"}],
 capabilities:[{canonical_key:"laser_cutting",display_name:"Taglio laser"}],
 markets:[{canonical_key:"automotive",display_name:"Automotive"}]};
const candidate=(changes={})=>({intent:"browse",role:"trader_distributor",country:"IT",
 region:"Lombardia",product:"",capability:"",market:"",uncertain:false,unhandled:[],...changes});

test("COMPACT6C rejects all hallucinated taxonomy keys and cities",()=>{
 for(const change of [
   {product:"super_tubes"},{capability:"unverified_laser"},
   {market:"market_unknown"},{country:"XX"},{region:"Milano"},
   {role:"platform_owner"},
 ]){
   assert.equal(validateNetworkAIOutput(candidate(change),"Cerco commercianti in Lombardia",taxonomy),null);
 }
});
test("COMPACT6C accepts grounded candidate and retains authoritative browse link",()=>{
 const result=validateNetworkAIOutput(candidate(),"Cerco commercianti in Lombardia",taxonomy);
 assert.ok(result);
 assert.equal(result.filters.role,"trader_distributor");
 assert.match(result.href,/region=Lombardia/);
 assert.equal("company_names" in result,false);
 assert.equal("count" in result,false);
});
test("COMPACT6C refuses unhandled, uncertain, malformed, partial and contradictory candidates",()=>{
 for(const c of [
  candidate({unhandled:["delivery tomorrow"]}),candidate({uncertain:true}),
  candidate({region:"Lombardia",country:"DE"}),candidate({role:"producer"}),
  candidate({region:"Veneto"}),{intent:"browse"},
  candidate({product:"tubes_pipes",unhandled:["3m"]}),
 ]){
  assert.equal(validateNetworkAIOutput(c,"Cerco commercianti in Lombardia",taxonomy),null);
 }
});
test("COMPACT6C treats measurement queries as RFQ without automating dispatch",()=>{
 for(const query of [
   "40 tubi EN 10219 S235 da 3 metri",
   "40 pipes at 3 meters EN10219",
   "tubi 100x100x5 EN 10219",
 ]){
   assert.equal(looksLikeRfqRequest(query),true,query);
 }
 assert.equal(looksLikeRfqRequest("Quanti commercianti in Lombardia?"),false);
});
test("COMPACT6C only inherits previous filters for explicit follow-up and validates them",()=>{
 const result=validateNetworkAIOutput(candidate({role:"",region:"Veneto"}),
   "E in Veneto?",taxonomy);
 assert.ok(result);
 const merged=mergeNetworkFollowup(result,{role:"trader_distributor",country:"IT",
   region:"Lombardia"},"E in Veneto?",taxonomy);
 assert.equal(merged.filters.role,"trader_distributor");
 assert.equal(merged.filters.region,"Veneto");
 assert.match(merged.href,/role=trader_distributor/);
 const unrelated=mergeNetworkFollowup(result,{role:"producer"},"Veneto",taxonomy);
 assert.equal(unrelated.filters.role,undefined);
});
test("COMPACT6C strict response schema never asks the model for a company answer",()=>{
 const fmt=NETWORK_AI_FORMAT.json_schema.schema;
 assert.equal(fmt.additionalProperties,false);
 assert.equal(fmt.required.length,9);
 assert.equal(fmt.properties.intent.enum.includes("rfq"),true);
 assert.equal(fmt.properties.intent.enum.includes("send_email"),false);
 assert.equal("companies" in fmt.properties,false);
 assert.equal("total" in fmt.properties,false);
});
test("COMPACT6C gateway action must enforce auth, budget, timeout and no private state in prompt",()=>{
 const action=read("../app/(italian)/(workspace)/network/conversation-actions.ts");
 for(const needle of [
   "getWorkspaceContext()","getNetworkAccessState(context.organizationId)",
   'db.rpc("netux6c_claim_ai_budget")',"NETUX6C_AI_ENABLED",
   "18_000","AI_GATEWAY_API_KEY","validateNetworkAIOutput(candidate,query,taxonomy)",
   'mode:"safe_fallback"','/commercial?compose=1#commercial-compose',
 ]){
   assert.ok(action.includes(needle),needle);
 }
 assert.doesNotMatch(action,/service_role|SUPABASE_SERVICE_ROLE_KEY/);
 assert.doesNotMatch(action,/console\.log\(.+query/);
 assert.match(action,/networkIntentHref\(parsed\)/);
});
test("COMPACT6C UI supports opt-in speech and local transcript with accessible controls",()=>{
 const ui=read("../components/network-conversation.tsx");
 const surface=read("../components/network-compact-experience.tsx");
 assert.match(surface,/<NetworkConversation userId=\{userId\} organizationId=\{organizationId\} canCompose=\{canCompose\}\/>/);
 assert.match(ui,/data-testid="network-conversational-discovery"/);
 assert.match(ui,/window.isSecureContext/);
 assert.match(ui,/webkitSpeechRecognition/);
 assert.match(ui,/engine.start\(\)/);
 assert.match(ui,/engine.onerror=/);
 assert.match(ui,/new SpeechSynthesisUtterance/);
 assert.match(ui,/recognition.current\?\.stop\(\)/);
 assert.match(ui,/window.speechSynthesis.cancel\(\)/);
 assert.match(ui,/aria-label="Chat Network"/);
 assert.match(ui,/aria-live="polite"/);
 assert.match(ui,/Nessuna RFQ viene inviata/);
  assert.doesNotMatch(ui,/(?:window\.|globalThis\.)?(?:localStorage|sessionStorage)\.(?:setItem|getItem)|navigator\.mediaDevices\.getUserMedia/);
});
test("COMPACT6C SQL budget has bounded daily global and user caps, no prompt content",()=>{
 const sql=read("../../../supabase/migrations/20261019153000_netux6c_ai_budget.sql");
 assert.match(sql,/pg_advisory_xact_lock/);
 assert.match(sql,/coalesce\(v_user_used,0\)>=5/);
 assert.match(sql,/coalesce\(v_global_used,0\)>=60/);
 assert.match(sql,/auth.uid\(\)/);
 assert.match(sql,/enable row level security/);
 assert.match(sql,/revoke all on function public.netux6c_claim_ai_budget\(\) from public,anon/);
 assert.match(sql,/grant execute on function public.netux6c_claim_ai_budget\(\) to authenticated/);
 assert.doesNotMatch(sql,/prompt_text|message_body|transcript/);
});
