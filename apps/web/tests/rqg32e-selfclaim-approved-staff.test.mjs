import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { APPROVAL,TARGETS,PUBLISHABLE_KEY,readSelfClaimConfig,selfClaim } from "./rqg32e-selfclaim-approved-staff.mjs";

const wf=readFileSync(new URL("../../../.github/workflows/rqg32e-selfclaim-approved-staff.yml",import.meta.url),"utf8");
const source=readFileSync(new URL("./rqg32e-selfclaim-approved-staff.mjs",import.meta.url),"utf8");

function env() {
  const vars={
    CI:"true",GITHUB_EVENT_NAME:"workflow_dispatch",
    GITHUB_REF:"refs/heads/main",RQG32E_APPROVAL:APPROVAL,
    RQG32E_SUPABASE_URL:"https://ecrafjdummcdfycznitx.supabase.co",
    RQG32E_PUBLISHABLE_KEY:PUBLISHABLE_KEY,
  };
  TARGETS.forEach((t,i)=>vars["RQG32_"+t.key+"_PASSWORD"]="synthetic-password-unit-test-"+i);
  return vars;
}
test("RQG3.2e requires exact 4 fixed synthetic staff identities, protected main and explicit approval",()=>{
  const e=env();
  const cfg=readSelfClaimConfig(e);
  assert.equal(cfg.accounts.length,4);
  assert.deepEqual(cfg.accounts.map(a=>a.role),[
    "registration_admin","claims_verification_admin","network_trust_admin","platform_auditor"]);
  for(const [name,value] of [
    ["CI","false"],["GITHUB_EVENT_NAME","push"],["GITHUB_REF","refs/heads/dev"],
    ["RQG32E_APPROVAL","fake"],["RQG32E_SUPABASE_URL","https://evil.test"],
    ["RQG32E_PUBLISHABLE_KEY","not-pinned"],["RQG32_AUDITOR_PASSWORD",""],
  ]) assert.throws(()=>readSelfClaimConfig({...e,[name]:value}),Error,name);
});
function mockClient(account,{alreadyActive=false,role=account.role,authOk=true}={}) {
  const calls={claimed:0,logout:0};
  let activated=alreadyActive;
  const client={
    auth:{
      signInWithPassword:async ({email,password})=>({
        data:{user:{email:authOk?email:"not-qa@example.org",
          app_metadata:{rqg32_suite:"RQG3.2a",rqg32_persona:account.id}}},
        error:null,
      }),
      signOut:async ()=>{calls.logout++;},
    },
    rpc:async (name)=>{
      if(name==="sa2_claim_platform_staff_invitation"){
        calls.claimed++;activated=true;
        return {data:{claimed:true,staff_status:"active",roles:[role]},error:null};
      }
      assert.equal(name,"platform_access_context");
      return {data:activated
        ? {is_platform_owner:false,is_platform_staff:true,staff_status:"active",
          roles:[role],permissions:["platform.console.access"]}
        : {is_platform_owner:false,is_platform_staff:false,staff_status:null,
          roles:[],permissions:[]},error:null};
    },
  };
  return {client,calls};
}
test("RQG3.2e claims four owner-approved invitations as four separate user sessions",async()=>{
  const accounts=readSelfClaimConfig(env()).accounts;
  const mocks=accounts.map(a=>mockClient(a));
  let i=0;
  const result=await selfClaim({accounts},()=>mocks[i++].client,()=>{});
  assert.equal(result.activated,4);
  assert.deepEqual(mocks.map(m=>m.calls.claimed),[1,1,1,1]);
  assert.deepEqual(mocks.map(m=>m.calls.logout),[1,1,1,1]);
});
test("RQG3.2e is idempotent and never claims an already correctly active role",async()=>{
  const accounts=readSelfClaimConfig(env()).accounts;
  const mocks=accounts.map(a=>mockClient(a,{alreadyActive:true}));
  let i=0;
  await selfClaim({accounts},()=>mocks[i++].client,()=>{});
  assert.ok(mocks.every(m=>m.calls.claimed===0));
});
test("RQG3.2e rejects incorrect role or account before any invitation claim",async()=>{
  const accounts=readSelfClaimConfig(env()).accounts;
  const mocks=accounts.map((a,i)=>mockClient(a,i===2?{authOk:false}:{}));
  let i=0;
  await assert.rejects(selfClaim({accounts},()=>mocks[i++].client,()=>{}));
  assert.ok(mocks.every(m=>m.calls.claimed===0));
});
test("RQG3.2e protected workflow cannot acquire superadmin or send privileged DB writes",()=>{
  assert.match(wf,/workflow_dispatch:/);
  assert.match(wf,/environment: production-qa/);
  assert.match(wf,/if: github.ref == 'refs\/heads\/main'/);
  assert.doesNotMatch(wf,/^\s+(push|pull_request|schedule):/m);
  assert.match(wf,/RQG32E_CLAIM_FOUR_APPROVED_INVITATIONS/);
  assert.doesNotMatch(wf,/RQG32A_AUTH_SECRET_KEY|service_role|OWNER_PASSWORD|upload-artifact/);
  assert.doesNotMatch(source,/admin\.createUser|service_role|\.insert\(|\.update\(|\.delete\(/);
  assert.match(source,/signInWithPassword/);
  assert.match(source,/sa2_claim_platform_staff_invitation/);
  assert.match(source,/platform_access_context/);
  assert.doesNotMatch(wf.split("    steps:")[0],/RQG32_.*PASSWORD/);
  assert.equal((wf.match(/secrets\.RQG32_\w+_PASSWORD/g)??[]).length,4);
});
