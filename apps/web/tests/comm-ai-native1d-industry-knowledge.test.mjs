import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const src = read("../lib/commercial-industry-knowledge.ts");
const compiled = ts.transpileModule(src, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { parseIndustryRequest, rankIndustryCompany, rankIndustryResults } = await import(
  "data:text/javascript;base64," + Buffer.from(compiled).toString("base64")
);
const intentSource = read("../lib/commercial-ai-native-intent.ts");
const routed = ts.transpileModule(intentSource, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { routeCommercialAiIntent } = await import("data:text/javascript;base64," + Buffer.from(routed).toString("base64"));
const action = read("../app/(italian)/(workspace)/commercial/ai-native-actions.ts");
const server = read("../lib/commercial-industry-knowledge-server.ts");
const shell = read("../components/commercial-ai-native-shell.tsx");

const claim = (value) => ({ verification_status: "verified", provenance_kind: "public_web", ...value });
const producer = {
  id: "00000000-0000-4000-8000-000000000101",
  legal_name: "Synthetic Tube Producer",
  trading_name: null, country_code: "IT", website_url: null, website_domain: null,
  verification_status: "unverified", claimed_status: "unclaimed",
  roles: [{key:"producer",name:"Producer",is_primary:true}],
  products: [{key:"tubes_pipes",name:"Tubes & pipes",relationship_type:"produces"}],
  markets:[],capabilities:[],facility_countries:["IT"],
};
const scope = {
  key:"tubes_pipes",relationship_type:"produces",facility_id:null,
  standards:[claim({code:"EN 10219"})],
  grades:[claim({designation:"S355J2H",standard_code:"EN 10219"})],
  dimensions:[
    claim({dimension_type:"outer_diameter",min_mm:400,max_mm:700}),
    claim({dimension_type:"wall_thickness",min_mm:4,max_mm:20}),
  ],
};
const req = input => {
  const routed = routeCommercialAiIntent(input);
  assert.equal(routed.intent,"industry_search");
  return parseIndustryRequest(input,routed.entities,routed.missing);
};

test("D distinguishes producer, trader, carpenterie, country and missing parameters", () => {
  const request=req("Chi produce tubo S355 Ø608?");
  assert.equal(request.role,"producer");
  assert.equal(request.tubes,true);
  assert.deepEqual(request.missing,["norma","spessore"]);
  assert.equal(req("Cerca carpenterie in Romania").role,"processor_service_provider");
  assert.equal(req("Cerca carpenterie in Romania").country,"RO");
  assert.equal(req("Trova commercianti di tubi in Italia").role,"trader_distributor");
});

test("D only calls documented a supported product AND matching standard/grade/OD/WT", () => {
  const complete=req("Chi produce tubo S355J2H Ø608x10 EN 10219 in Italia?");
  const matched=rankIndustryCompany(producer,complete,[scope]);
  assert.equal(matched.match,"documented");
  assert.equal(matched.reasons.length,4);
  assert.equal(matched.sourceUrl,"/network/"+producer.id);
  assert.equal(matched.evidenceDate,null);
  assert.equal(matched.roleLabel,"Produttore censito");
  assert.equal(matched.reasons[0].provenance,"public_web");
  assert.equal(rankIndustryCompany(producer,complete,[
    {
      ...scope,
      standards:scope.standards.map(c=>({...c,verification_status:"unverified"})),
      grades:scope.grades.map(c=>({...c,verification_status:"unverified"})),
      dimensions:scope.dimensions.map(c=>({...c,verification_status:"unverified"})),
    },
  ]).match,"potential","Unverified technical claims must never be labeled documented");
  assert.equal(rankIndustryCompany(producer,complete,[
    {...scope,dimensions:[claim({dimension_type:"outer_diameter",min_mm:21.3,max_mm:219.1})]},
  ]),null,"Explicitly out-of-range producer must not be suggested");
  assert.equal(rankIndustryCompany(producer,complete,[
    {...scope,standards:[claim({code:"EN 10210"})]},
  ]),null,"Wrong standard must be excluded, not presented as a match");
  assert.equal(rankIndustryCompany(producer,complete,[
    {...scope,grades:[claim({designation:"S235JRH"})]},
  ]),null,"Wrong grade must be excluded");
  assert.equal(rankIndustryCompany(producer,complete,[
    {...scope,grades:[claim({designation:"S355J2H",standard_code:"EN 10210"})]},
  ]),null,"A grade asserted under EN 10210 cannot prove EN 10219");
  assert.equal(rankIndustryCompany(producer,complete,[
    {...scope,grades:[claim({designation:"S355J2H"})]},
  ]).match,"potential","Missing grade-standard link is not complete evidence");
});

test("D partial match remains potential; Ø608 with missing norm/thickness is never confirmed", () => {
  const missing=req("Chi produce tubo S355 Ø608?");
  assert.equal(rankIndustryCompany(producer,missing,[scope]).match,"potential");
  assert.equal(rankIndustryCompany(producer,missing,[scope]).missing.includes("norma"),true);
  assert.equal(rankIndustryCompany(producer,missing,null).match,"potential");
  const full=req("Chi produce tubo S355J2H Ø608x10 EN 10219?");
  assert.equal(rankIndustryCompany(producer,full,[{...scope,standards:[],grades:[],dimensions:[]}]).match,"potential");
});

test("D producer search cannot classify trading stock as manufacturing capacity", () => {
  const request=req("Chi produce tubo S355 Ø608x10 EN 10219?");
  const traded={...producer,products:[{key:"tubes_pipes",name:"Tubes",relationship_type:"stocks"}]};
  assert.equal(rankIndustryCompany(traded,request,[{...scope,relationship_type:"stocks"}]),null);
  const notTube={...producer,products:[{key:"steel_plates",name:"Steel plates",relationship_type:"produces"}]};
  assert.equal(rankIndustryCompany(notTube,request,null),null);
  const otherCountry={...producer,country_code:"RO",facility_countries:["RO"]};
  const italian=req("Chi produce tubo S355 Ø608x10 EN 10219 in Italia?");
  assert.equal(rankIndustryCompany(otherCountry,italian,[scope]),null);
});

test("D ranking favors documented over potential and caps the response", () => {
  const request=req("Chi produce tubo S355J2H Ø608x10 EN 10219?");
  const other={...producer,id:"00000000-0000-4000-8000-000000000102",legal_name:"B Synthetic"};
  const list=rankIndustryResults([other,producer],request,{
    [producer.id]:[scope],
    [other.id]:null,
  },2);
  assert.deepEqual(list.map(item=>item.match),["documented","potential"]);
  assert.equal(rankIndustryResults([other,producer],request,{},1).length,1);
});

test("D stays source-first, authorization-guarded and non-mutating", () => {
  assert.match(server,/getNetworkAccessState\(organizationId\)/);
  assert.match(server,/access\.can_access_network/);
  assert.match(server,/access\.organization_id !== organizationId/);
  assert.match(server,/searchNetwork\(/);
  assert.match(server,/p3_7e_public_product_scope/);
  assert.doesNotMatch(server,/service_role|\.insert\(|\.update\(|dispatchRfq|sendBuyerDistinta/);
  assert.match(action,/industryAnswer\(question, routed, context\.organizationId\)/);
  assert.match(shell,/commercial-ai-native-industry-results/);
  assert.match(shell,/commercial-ai-native-industry-company/);
  assert.match(shell,/company\.sourceUrl/);
  assert.doesNotMatch(action,/\.insert\(|\.update\(|dispatchRfq|sendBuyerDistinta/);
});
