import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {test} from "node:test";
import {APPROVAL,PROJECT,LEGAL_VERSION,parseScope,config,inspect}
  from "./rqg32i-production-company-preflight.mjs";

const workflow=readFileSync(new URL(
  "../../../.github/workflows/rqg32i-production-company-pilot.yml",import.meta.url),"utf8");
const chrome=readFileSync(new URL(
  "./rqg32i-production-company-chrome.mjs",import.meta.url),"utf8");
const uid="00000000-0000-4000-8000-0000000000a1";
const oid="00000000-0000-4000-8000-0000000000b1";
const email="pilot-admin@example.com";
const scope={adminEmail:email,adminUserId:uid,organizationId:oid,
  reviewId:1234567,authorizationRef:"PILOT-APPROVED-001"};
const env={CI:"true",GITHUB_EVENT_NAME:"workflow_dispatch",GITHUB_REF:"refs/heads/main",
  RQG32I_APPROVAL:APPROVAL,RQG32I_SUPABASE_URL:PROJECT,
  RQG32I_ADMIN_KEY:"sb_secret_test_only",
  RQG32I_PILOT_SCOPE_JSON:JSON.stringify(scope)};

test("RQG3.2i requires exact main, workflow_dispatch, manual approval, approved protected scope",()=>{
  assert.deepEqual(config(env),scope);
  assert.deepEqual(parseScope(JSON.stringify(scope)),scope);
  for(const [k,v] of [["CI","false"],["GITHUB_EVENT_NAME","push"],
    ["GITHUB_REF","refs/heads/feature"],["RQG32I_APPROVAL","wrong"],
    ["RQG32I_SUPABASE_URL","https://example.supabase.co"],
    ["RQG32I_ADMIN_KEY",""],["RQG32I_PILOT_SCOPE_JSON",""]]){
    assert.throws(()=>config({...env,[k]:v}),Error,k);
  }
  for(const modified of [
    {...scope,adminEmail:"rqg32-company-a@smartsteelsales.test"},
    {...scope,adminUserId:"bad"},{...scope,organizationId:"bad"},
    {...scope,reviewId:0},{...scope,authorizationRef:""},
    {...scope,extra:"unexpected"}
  ]) assert.throws(()=>parseScope(JSON.stringify(modified)));
});

function mock(change={}){
  const user={id:uid,email,email_confirmed_at:"2026-10-10",
    app_metadata:{},...(change.user??{})};
  const tables={
    platform_user_roles:[{user_id:"owner",role:"platform_superadmin",status:"active"},
      ...(change.extraOwner?[{user_id:"other",role:"platform_superadmin",status:"active"}]:[]),
      ...(change.pilotPlatformRole?[{user_id:uid,role:"platform_superadmin",status:"active"}]:[])],
    platform_staff_roles:change.staff?[{user_id:uid,role_key:"registration_admin",status:"active"}]:[],
    organization_memberships:[
      {user_id:uid,organization_id:change.otherMembership?oid+"x":oid,
        role:change.viewer?"viewer":"admin",status:"active"},
      ...(change.dualMembership?[{user_id:uid,organization_id:"another",role:"admin",status:"active"}]:[])
    ],
    organizations:[{id:oid,slug:change.fakeOrg?"rqg32-company-a":"real-pilot",
      onboarding_status:change.inactiveOrg?"pending":"completed"}],
    user_legal_acceptances:change.noLegal?[]:[{
      user_id:uid,privacy_notice_version:LEGAL_VERSION,
      terms_version:change.staleTerms?"old":LEGAL_VERSION,
      privacy_acknowledged_at:"2026-10-10",terms_accepted_at:"2026-10-10",
      acceptance_source:"first_login"
    }],
    commercial_review_queue:[{id:scope.reviewId,
      organization_id:change.wrongReviewOrg?"another-org":oid,
      status:change.decided?"confirmed":"pending"}]
  };
  const calls=[];
  return {calls,admin:{
    auth:{admin:{getUserById:async()=>({data:{user},error:null})}},
    from(table){return {select(fields){
      calls.push({table,fields});
      const filters=[];
      const q={eq(col,val){filters.push([col,val]);return q},
        then(resolve,reject){return Promise.resolve({
          data:(tables[table]??[]).filter(row=>filters.every(([k,v])=>row[k]===v)),error:null
        }).then(resolve,reject)}};
      return q;
    }}}
  }};
}
test("RQG3.2i validates real Owner, current legal acceptance, one admin tenant and own pending Review",async()=>{
  const x=mock();
  assert.deepEqual(await inspect(x.admin,scope),{
    approved:true,companyAdmin:true,legalCurrent:true,ownPendingReview:true,
    solePlatformOwner:true,applicationWrites:0
  });
  for(const opts of [{extraOwner:true},{pilotPlatformRole:true},{staff:true},
    {viewer:true},{dualMembership:true},{otherMembership:true},
    {fakeOrg:true},{inactiveOrg:true},{noLegal:true},{staleTerms:true},
    {wrongReviewOrg:true},{decided:true},
    {user:{email_confirmed_at:null}},
    {user:{app_metadata:{rqg32_suite:"RQG3.2a"}}}]){
    await assert.rejects(inspect(mock(opts).admin),undefined,JSON.stringify(opts));
  }
  assert.ok(x.calls.every(x=>!x.fields.includes("source_text")),
    "Never download the body of live commercial Review evidence");
});
test("RQG3.2i Chrome uses real user-JWT GET and an isolated, read-only browser",()=>{
  assert.match(chrome,/signInWithPassword/);
  assert.match(chrome,/scope\.adminUserId/);
  assert.match(chrome,/from\("commercial_review_queue"\)/);
  assert.match(chrome,/\.eq\("id",scope\.reviewId\)/);
  assert.match(chrome,/\/operations\/review/);
  assert.match(chrome,/\/platform\/review/);
  assert.match(chrome,/method==="GET"\|\|method==="HEAD"/);
  assert.match(chrome,/url\.pathname==="\/login"/);
  assert.match(chrome,/route\.abort\("blockedbyclient"\)/);
  assert.match(chrome,/!process\.env\.RQG32I_ADMIN_KEY/);
  assert.match(chrome,/application writes transmitted=0/);
  assert.doesNotMatch(chrome,/auth\.admin|\.insert\(|\.update\(|\.delete\(|\.upsert\(|signUp\(/);
});
test("RQG3.2i workflow stays manual, protected, production-qa and zero artifacts",()=>{
  assert.match(workflow,/workflow_dispatch:/);
  assert.match(workflow,/environment: production-qa/);
  assert.match(workflow,/github\.ref == 'refs\/heads\/main'/);
  assert.match(workflow,/persist-credentials: false/);
  assert.doesNotMatch(workflow,/^\s+(push|pull_request|schedule):/m);
  assert.match(workflow,/secrets\.RQG32A_AUTH_SECRET_KEY/);
  assert.match(workflow,/secrets\.RQG32I_PILOT_SCOPE_JSON/);
  assert.match(workflow,/secrets\.RQG32I_PILOT_PASSWORD/);
  assert.match(workflow,/secrets\.RQG32I_PUBLISHABLE_KEY/);
  const separated=workflow.split("- name: Install ephemeral Chrome without production secrets");
  assert.equal(separated.length,2);
  assert.ok(separated[0].includes("RQG32I_ADMIN_KEY"));
  assert.ok(!separated[1].includes("RQG32I_ADMIN_KEY"));
  assert.doesNotMatch(workflow,/upload-artifact|OWNER_PASSWORD|NEXT_PUBLIC_SERVICE_ROLE/);
});
