import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import {
  PERSONAS,MARKER_A,MARKER_B,readConfiguration,inspect,
  assertReadiness,execute,PROJECT_URL,
} from "./rqg32a-provision-auth-personas.mjs";

const fixture=(mode="preflight")=>{
  const env={
    CI:"true",GITHUB_REF:"refs/heads/main",RQG32A_MODE:mode,
    RQG32A_APPROVAL:mode==="create"
      ?"RQG32A_CREATE_SEVEN_SYNTHETIC_USERS":"RQG32A_INSPECT_SYNTHETIC_USERS",
    RQG32A_SUPABASE_URL:PROJECT_URL,
    RQG32A_AUTH_SECRET_KEY:"sb_"+"secret_"+"unit_test_never_used",
    RQG32_COMPANY_A_MARKER:MARKER_A,RQG32_COMPANY_B_MARKER:MARKER_B,
  };
  PERSONAS.forEach((p,i)=>{
    env["RQG32_"+p.key+"_EMAIL"]="rqg32-"+p.tag+"@smartsteelsales.test";
    env["RQG32_"+p.key+"_PASSWORD"]="unit-test-synthetic-password-unique-"+i;
  });
  return env;
};
function mock(adminUsers=[]) {
  const tables={
    platform_user_roles:[{user_id:"single-owner",role:"platform_superadmin",status:"active"}],
    platform_staff:[],
    platform_staff_roles:[],
    organizations:[],
    organization_memberships:[],
    commercial_review_queue:[],
  };
  const calls={created:[],tableReads:[]};
  const admin={
    auth:{admin:{
      listUsers:async()=>({data:{users:adminUsers},error:null}),
      createUser:async(fields)=>{
        calls.created.push(fields);
        const user={
          id:"synthetic-user-"+calls.created.length,email:fields.email,
          app_metadata:fields.app_metadata,
        };
        adminUsers.push(user);
        return {data:{user},error:null};
      },
    }},
    from:(table)=>({
      select:()=>{calls.tableReads.push(table);return {
        data:tables[table],error:null,
        in:(column,values)=>({data:tables[table].filter(row=>values.includes(row[column])),error:null}),
      };},
    }),
  };
  return {admin,calls,tables};
}
test("RQG3.2a explicit approval, fixed project, exact .test identities and unique credentials",()=>{
  assert.equal(readConfiguration(fixture()).accounts.length,7);
  for(const [key,val] of [
    ["RQG32A_APPROVAL","none"],
    ["RQG32A_SUPABASE_URL","https://another-project.supabase.co"],
    ["CI","false"],
    ["GITHUB_REF","refs/heads/dev"],
    ["RQG32_REGISTRATION_EMAIL","someone@company.com"],
    ["RQG32_COMPANY_A_MARKER","WRONG"],
    ["RQG32A_AUTH_SECRET_KEY","not-a-secret"],
  ]){
    assert.throws(()=>readConfiguration({...fixture(),[key]:val}),Error,key);
  }
  assert.throws(()=>readConfiguration({...fixture("create"),RQG32A_APPROVAL:"RQG32A_INSPECT_SYNTHETIC_USERS"}));
});
test("RQG3.2a preflight never creates users or roles",async()=>{
  const {admin,calls}=mock();
  const result=await execute(admin,readConfiguration(fixture()),()=>{});
  assert.deepEqual(result,{existing:0,created:0,ready:false});
  assert.deepEqual(calls.created,[]);
  assert.ok(calls.tableReads.includes("platform_user_roles"));
});
test("RQG3.2a apply creates exactly seven tagged Auth identities, never grants privileges, is idempotent",async()=>{
  const actors=[];const {admin,calls}=mock(actors);
  const config=readConfiguration(fixture("create"));
  const output=await execute(admin,config,()=>{});
  assert.equal(output.created,7);
  assert.equal(calls.created.length,7);
  for(const c of calls.created){
    assert.equal(c.email_confirm,true);
    assert.equal(c.app_metadata.rqg32_suite,"RQG3.2a");
    assert.equal(c.app_metadata.role,undefined);
  }
  const repeat=await execute(admin,config,()=>{});
  assert.equal(repeat.created,0);
  assert.equal(calls.created.length,7);
});
test("RQG3.2a rejects collisions and any existing additional Platform Owner",async()=>{
  const {admin}=mock([{
    id:"untrusted",email:"rqg32-registration@smartsteelsales.test",app_metadata:{},
  }]);
  await assert.rejects(execute(admin,readConfiguration(fixture()),()=>{}));
  const x=mock();
  x.tables.platform_user_roles.push({user_id:"owner-two",role:"platform_superadmin",status:"active"});
  await assert.rejects(inspect(x.admin,readConfiguration(fixture()).accounts));
});
test("RQG3.2a ready requires governed staff/company assignments and dedicated Review evidence",()=>{
  const accounts=readConfiguration(fixture()).accounts;
  const existing=new Map(accounts.map(p=>[p.id,{id:p.id}]));
  const orgs=[
    {id:"A",slug:"rqg32-company-a",onboarding_status:"completed"},
    {id:"B",slug:"rqg32-company-b",onboarding_status:"completed"},
  ];
  const ready={existing,orgs,
    staff:accounts.filter(p=>p.staffRole).map(p=>({user_id:p.id,status:"active"})),
    staffRoles:accounts.filter(p=>p.staffRole).map(p=>({user_id:p.id,role_key:p.staffRole,status:"active"})),
    memberships:accounts.filter(p=>p.companyRole).map(p=>({
      user_id:p.id,organization_id:p.org==="rqg32-company-a"?"A":"B",
      role:p.companyRole,status:"active",
    })),
    queue:[
      {id:980321,organization_id:"A",status:"pending",source_text:MARKER_A},
      {id:980322,organization_id:"B",status:"pending",source_text:MARKER_B},
    ],
  };
  assert.equal(assertReadiness(ready,accounts).pendingSyntheticReviewRows,2);
  const bad={...ready,staffRoles:ready.staffRoles.filter(r=>r.user_id!=="auditor")};
  assert.throws(()=>assertReadiness(bad,accounts));
  const swapped={...ready,queue:ready.queue.map(row=>({...row,organization_id:row.organization_id==="A"?"B":"A"}))};
  assert.throws(()=>assertReadiness(swapped,accounts));
});
test("RQG3.2a production evidence SQL never creates users, staff roles or real-customer data",()=>{
  const seed=readFileSync(new URL("../../../supabase/ops/rqg32a_synthetic_review_seed.sql",import.meta.url),"utf8");
  const cleanup=readFileSync(new URL("../../../supabase/ops/rqg32a_synthetic_review_cleanup.sql",import.meta.url),"utf8");
  const workflow=readFileSync(new URL("../../../.github/workflows/rqg32a-controlled-persona-auth.yml",import.meta.url),"utf8");
  assert.match(seed,/begin;[\s\S]*commit;/);
  assert.match(seed,/exactly one Platform Owner required/);
  assert.match(seed,/rqg32-company-a@smartsteelsales\.test/);
  assert.match(seed,/rqg32-company-b@smartsteelsales\.test/);
  assert.doesNotMatch(seed,/insert into auth\.users|insert into public\.platform_staff|insert into public\.platform_user_roles/i);
  assert.match(cleanup,/status='pending'/);
  assert.doesNotMatch(cleanup,/delete from auth\.users|delete from public\.organizations/i);
  assert.match(workflow,/workflow_dispatch:/);
  assert.match(workflow,/environment: production-qa/);
  assert.doesNotMatch(workflow,/^\s+(pull_request|push|schedule):/m);
  assert.match(workflow,/RQG32A_AUTH_SECRET_KEY: \$\{\{ secrets\.RQG32A_AUTH_SECRET_KEY \}\}/);
});
