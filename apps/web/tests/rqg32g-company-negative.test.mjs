import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {test} from "node:test";
import {APPROVAL,ACCOUNTS,PROJECT,config,inspect} from "./rqg32g-unassigned-company-preflight.mjs";
const w=readFileSync(new URL("../../../.github/workflows/rqg32g-company-negative-auth.yml",import.meta.url),"utf8");
const src=readFileSync(new URL("./rqg32g-company-negative-chrome.mjs",import.meta.url),"utf8");
function env(){return {CI:"true",GITHUB_EVENT_NAME:"workflow_dispatch",GITHUB_REF:"refs/heads/main",
RQG32G_APPROVAL:APPROVAL,RQG32G_SUPABASE_URL:PROJECT,RQG32G_ADMIN_KEY:"sb_secret_test_only"};}
test("RQG3.2g preflight is pinned to project, owner approval and exact 3 QA identities",()=>{
  assert.equal(config(env()).accounts.length,3);
  assert.deepEqual(ACCOUNTS.map(x=>x.id),["companyA","companyB","viewer"]);
  for(const [key,value] of [["CI","false"],["GITHUB_EVENT_NAME","push"],["GITHUB_REF","refs/heads/develop"],
    ["RQG32G_APPROVAL","incorrect"],["RQG32G_SUPABASE_URL","https://wrong-project.supabase.co"],
    ["RQG32G_ADMIN_KEY",""]]){
    assert.throws(()=>config({...env(),[key]:value}),Error,key);
  }
});
function mock({member=false,legal=false,extraOwner=false,org=false}={}){
  const ids=["a","b","c"];
  const users=[
    {id:"owner",email:"owner@example.org",app_metadata:{}},
    ...[["a","companyA","company-a"],["b","companyB","company-b"],["c","viewer","viewer"],
      ["d","registration","registration"],["e","claims","claims"],
      ["f","trust","trust"],["g","auditor","auditor"]].map(([id,p,tag])=>({
      id,email:"rqg32-"+tag+"@smartsteelsales.test",
      app_metadata:{rqg32_suite:"RQG3.2a",rqg32_persona:p}
    }))
  ];
  const tables={
    platform_user_roles:[{user_id:"owner",role:"platform_superadmin",status:"active"},
      ...(extraOwner?[{user_id:"a",role:"platform_superadmin",status:"active"}]:[])],
    organization_memberships:member?[{user_id:"a",organization_id:"X",status:"active"}]:[],
    user_legal_acceptances:legal?[{user_id:"b"}]:[],
    platform_staff_roles:[],
    organizations:org?[{id:"X",slug:"rqg32-company-a"}]:[],
    commercial_review_queue:[],
  };
  const calls=[];
  return {calls,admin:{
    auth:{admin:{listUsers:async()=>({data:{users},error:null})}},
    from(table){return {select(){calls.push(table);return {in(){
      return {data:tables[table],error:null}
    },then(resolve){resolve({data:tables[table],error:null})}};}}}
  }};
}
test("RQG3.2g preflight read-only succeeds only while three QA company users remain unassigned",async()=>{
  const ok=mock();const output=await inspect(ok.admin);
  assert.deepEqual(output,{actors:3,owners:1,tenantMemberships:0,legalAcceptances:0});
  assert.ok(ok.calls.includes("user_legal_acceptances"));
  assert.ok(ok.calls.includes("organization_memberships"));
  for(const opts of [{member:true},{legal:true},{extraOwner:true},{org:true}]){
    await assert.rejects(inspect(mock(opts).admin));
  }
});
test("RQG3.2g browser only accepts login POST and cannot access either Review domain",()=>{
  assert.match(src,/companyA/);assert.match(src,/companyB/);assert.match(src,/viewer/);
  assert.match(src,/url\.pathname==="\/login"/);
  assert.match(src,/url\.pathname==="\/auth\/v1\/token"/);
  assert.match(src,/method==="GET"\|\|method==="HEAD"/);
  assert.match(src,/route\.abort\("blockedbyclient"\)/);
  assert.match(src,/\/operations\/review/);assert.match(src,/\/platform\/review/);
  assert.match(src,/application mutation requests transmitted=0/);
  assert.doesNotMatch(src,/\.rpc\(|\.insert\(|\.update\(|\.delete\(|signUp\(/);
});
test("RQG3.2g manual protected workflow keeps secrets scoped to guarded steps",()=>{
  assert.match(w,/workflow_dispatch:/);assert.match(w,/environment: production-qa/);
  assert.match(w,/github\.ref == 'refs\/heads\/main'/);
  assert.match(w,/persist-credentials: false/);
  assert.doesNotMatch(w,/^\s+(push|pull_request|schedule):/m);
  assert.doesNotMatch(w.split("    steps:")[0],/SECRET_KEY|PASSWORD|ADMIN_KEY/);
  assert.equal((w.match(/secrets\.RQG32_\w+_PASSWORD/g)||[]).length,3);
  assert.match(w,/secrets\.RQG32A_AUTH_SECRET_KEY/);
  assert.doesNotMatch(w,/upload-artifact|OWNER_PASSWORD/);
});
