import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import ts from "typescript";

const read=p=>readFileSync(new URL(p,import.meta.url),"utf8");
function load(source,requireFn=()=>{throw Error("Unexpected external dependency")}){
 const compiled=ts.transpileModule(source,{compilerOptions:{
   module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,
 }}).outputText;
 const exports={};
 new Function("exports","require",compiled)(exports,requireFn);
 return exports;
}
const parser=load(read("../lib/network-intent-parser.ts"));
const ai=load(read("../lib/network-ai-contract.ts"),name=>{
 if(name!=="@/lib/network-intent-parser")throw Error("Unexpected module "+name);
 return parser;
});
const euCountries=load(read("../lib/network-eu-countries.ts"));
const euRegions=load(read("../lib/network-eu-regions.ts"));
const baseRegions=["Lombardia","Veneto","Piemonte"];
const countries=[...euCountries.EU_MEMBER_COUNTRIES,...euCountries.OTHER_NETWORK_COUNTRIES].map(item=>({
 code:item.code,name:item.name,aliases:item.code==="DE"?["germany","deutschland"]:
 item.code==="FR"?["france"]:item.code==="PL"?["poland","polska"]:
 item.code==="GR"?["greece"]:[],
}));
const europeanRegions=euRegions.EUROPE_NUTS2024_REGIONS.filter(x=>x.country!=="IT")
  .map(x=>({code:x.code,country:x.country,name:x.name,
    aliases:x.code==="DE2"?["Baviera","Bavaria"]:x.code==="FR10"?["Île-de-France"]:[]}));
const taxonomy={regions:baseRegions,countries,europeanRegions,
 products:[{canonical_key:"tubes_pipes",display_name:"Tubi e tubazioni"}]};
const {interpretNetworkIntent,networkIntentHref}=parser;
const {validateNetworkAIOutput,mergeNetworkFollowup}=ai;
const candidate=(changes={})=>({
 intent:"browse",role:"trader_distributor",region:"DE2",country:"DE",
 product:"tubes_pipes",capability:"",market:"",uncertain:false,unhandled:[],...changes,
});
test("EUROPE1E recognizes Bavaria by italian alias and official NUTS name, never invents companies",()=>{
 for(const phrase of ["Cerco commercianti di tubi in Baviera","Manufacturers in Bayern"]){
   const p=interpretNetworkIntent(phrase,taxonomy);
   assert.equal(p.status,"ready",phrase);
   assert.equal(p.filters.region,"DE2");
   assert.equal(p.filters.country,"DE");
   assert.ok(networkIntentHref(p)?.includes("region=DE2"));
   assert.equal("count" in p,false);
 }
});
test("EUROPE1E routes Île-de-France, inferred region country, Poland and Greece",()=>{
 const f=interpretNetworkIntent("Mostrami i produttori in Île-de-France",taxonomy);
 assert.equal(f.status,"ready");
 assert.deepEqual([f.filters.country,f.filters.region,f.filters.role],["FR","FR10","producer"]);
 for(const name of ["Polonia","poland","polska"]){
   const result=interpretNetworkIntent("Quanti commercianti in "+name,taxonomy);
   assert.equal(result.status,"ready",name);
   assert.equal(result.filters.country,"PL");
   assert.equal(result.intent,"count");
 }
 const g=interpretNetworkIntent("Produttori in Grecia",taxonomy);
 assert.equal(g.status,"ready");assert.equal(g.filters.country,"GR");
});
test("EUROPE1E fail-closed on contradictory or multiple foreign areas and unknown city",()=>{
 for(const q of [
   "Produttori in Germania e Île-de-France",
   "Commercianti in Baviera e Lombardia",
   "Produttori in Baviera e Île-de-France",
   "Commercianti a Lipsia",
 ]){
   const res=interpretNetworkIntent(q,taxonomy);
   assert.equal(res.status,"unsupported",q);
   assert.equal(networkIntentHref(res),null);
 }
});
test("EUROPE1E validates AI region codes and country relation against official catalog",()=>{
 const ok=validateNetworkAIOutput(candidate(),"Cerco commercianti di tubi in Baviera",taxonomy);
 assert.ok(ok);assert.equal(ok.filters.region,"DE2");
 for(const invalid of [
   candidate({region:"DE99"}),candidate({region:"FR10"}),
   candidate({country:"FR"}),candidate({country:"ZZ"}),
   candidate({region:"Lombardia"}),candidate({region:"Berlin"}),
 ]){
   assert.equal(validateNetworkAIOutput(invalid,"Cerco commercianti di tubi in Baviera",taxonomy),null);
 }
 const noCity=validateNetworkAIOutput(candidate({product:"",region:"DE3"}),
   "Commercianti a Berlino",taxonomy);
 assert.equal(noCity,null);
});
test("EUROPE1E carries role/product to Bavaria but clears outdated region on Poland follow-up",()=>{
 const first=validateNetworkAIOutput(candidate(),"Cerco commercianti di tubi in Baviera",taxonomy);
 assert.ok(first);
 const next=interpretNetworkIntent("E invece in Polonia?",taxonomy);
 assert.equal(next.status,"ready");
 const follow=mergeNetworkFollowup({
   intent:next.intent,filters:next.filters,chips:next.chips,technicalOnly:next.technicalOnly,
   href:networkIntentHref(next),
 },first.filters,"E invece in Polonia?",taxonomy);
 assert.equal(follow.filters.country,"PL");
 assert.equal(follow.filters.region,undefined);
 assert.equal(follow.filters.role,"trader_distributor");
 assert.equal(follow.filters.product,"tubes_pipes");
 const bav=interpretNetworkIntent("E invece in Baviera?",taxonomy);
 const after=mergeNetworkFollowup({
   intent:bav.intent,filters:bav.filters,chips:bav.chips,technicalOnly:bav.technicalOnly,
   href:networkIntentHref(bav),
 },follow.filters,"E invece in Baviera?",taxonomy);
 assert.equal(after.filters.country,"DE");assert.equal(after.filters.region,"DE2");
 assert.equal(after.filters.role,"trader_distributor");
});
test("EUROPE1E keeps server access, budget and regional search as source of truth",()=>{
 const action=read("../app/(italian)/(workspace)/network/conversation-actions.ts");
 const db=read("../lib/network-compact-directory.ts");
 const sql=read("../../../supabase/migrations/20261020110000_net_europe1c_regional_intelligence.sql");
 const ui=read("../components/network-conversation.tsx");
 assert.match(action,/europeanIntentTaxonomy\(\)/);
 assert.match(action,/europeRegionForCountry\(safe.country,input.region\)/);
 assert.match(action,/getNetworkAccessState\(context.organizationId\)/);
 assert.match(action,/db.rpc\("netux6c_claim_ai_budget"\)/);
 assert.match(action,/validateNetworkAIOutput\(candidate,query,taxonomy\)/);
 assert.match(db,/getEuropeRegionalSearch\(organizationId,access,filters/);
 assert.match(sql,/publication_status='published'/);
 assert.match(ui,/Cerco commercianti di tubi in Baviera/);
 assert.doesNotMatch(action,/service_role|SUPABASE_SERVICE_ROLE_KEY|createBuyerRfqCampaign/);
});
