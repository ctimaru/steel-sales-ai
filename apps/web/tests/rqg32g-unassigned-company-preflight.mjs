/**
 * RQG3.2g - READ-ONLY production guard for UNASSIGNED synthetic company users.
 * Must fail closed if a synthetic company joins any tenant, records legal acceptance
 * or gains Platform authority. Uses protected short-lived Auth Admin key to INSPECT,
 * never to create users, assign roles or amend business records.
 */
import assert from "node:assert/strict";
import {pathToFileURL} from "node:url";
import {createClient} from "@supabase/supabase-js";
export const PROJECT="https://ecrafjdummcdfycznitx.supabase.co";
export const APPROVAL="RQG32G_INSPECT_UNASSIGNED_COMPANY_TEST_USERS";
export const ACCOUNTS=[
  {id:"companyA",email:"rqg32-company-a@smartsteelsales.test"},
  {id:"companyB",email:"rqg32-company-b@smartsteelsales.test"},
  {id:"viewer",email:"rqg32-viewer@smartsteelsales.test"},
];
const ORGS=["rqg32-company-a","rqg32-company-b"];
const MARKERS=["RQG32-ORG_A-20261013","RQG32-ORG_B-20261013"];
export function config(env){
  assert.equal(env.CI,"true");
  assert.equal(env.GITHUB_EVENT_NAME,"workflow_dispatch");
  assert.equal(env.GITHUB_REF,"refs/heads/main");
  assert.equal(env.RQG32G_APPROVAL,APPROVAL);
  assert.equal(env.RQG32G_SUPABASE_URL,PROJECT);
  assert.ok(env.RQG32G_ADMIN_KEY?.startsWith("sb_secret_")||
    env.RQG32G_ADMIN_KEY?.startsWith("eyJ"),
    "Protected Supabase Auth Admin secret required");
  return {accounts:ACCOUNTS};
}
async function load(admin,table,columns,filterKey,values){
  let query=admin.from(table).select(columns);
  if(filterKey)query=query.in(filterKey,values);
  const {data,error}=await query;
  assert.ifError(error);
  assert.ok(Array.isArray(data));
  return data;
}
export async function inspect(admin){
  const users=[];
  for(let page=1;page<=10;page++){
    const {data,error}=await admin.auth.admin.listUsers({page,perPage:1000});
    assert.ifError(error);
    assert.ok(Array.isArray(data?.users));
    users.push(...data.users);
    if(data.users.length<1000)break;
    assert.ok(page<10,"Identity directory too large for bounded inspection");
  }
  const qaUsers=users.filter(u=>/^rqg32-.*@smartsteelsales\.test$/.test(u.email??""));
  assert.equal(qaUsers.length,7,"Exactly seven tagged test identities required");
  for(const u of qaUsers)assert.equal(u.app_metadata?.rqg32_suite,"RQG3.2a");
  const actors=ACCOUNTS.map(persona=>{
    const found=qaUsers.filter(u=>u.email===persona.email);
    assert.equal(found.length,1,"Synthetic company persona missing");
    assert.equal(found[0].app_metadata?.rqg32_persona,persona.id);
    return found[0];
  });
  const ids=actors.map(u=>u.id);
  const [owners, memberships,acceptances,staffRoles,orgs,queue]=await Promise.all([
    load(admin,"platform_user_roles","user_id,role,status"),
    load(admin,"organization_memberships","user_id,organization_id,status","user_id",ids),
    load(admin,"user_legal_acceptances","user_id","user_id",ids),
    load(admin,"platform_staff_roles","user_id,role_key,status","user_id",ids),
    load(admin,"organizations","id,slug","slug",ORGS),
    load(admin,"commercial_review_queue","id,source_text","source_text",MARKERS),
  ]);
  const activeOwners=owners.filter(x=>x.role==="platform_superadmin"&&x.status==="active");
  assert.equal(activeOwners.length,1,"Exactly one real Owner");
  assert.ok(ids.every(id=>id!==activeOwners[0].user_id),"Test user became Owner");
  assert.equal(memberships.length,0,"Company users already joined a tenant: stop negative suite");
  assert.equal(acceptances.length,0,"Recorded legal acceptance exists: stop negative suite");
  assert.equal(staffRoles.filter(x=>x.status==="active").length,0,
    "Synthetic Company identity gained Platform role");
  assert.equal(orgs.length,0,"Demo tenant exists: use later company-positive acceptance");
  assert.equal(queue.length,0,"Synthetic Review markers already exist");
  return {actors:3,owners:1,tenantMemberships:0,legalAcceptances:0};
}
async function main(){
  try{
    const cfg=config(process.env);
    const admin=createClient(PROJECT,process.env.RQG32G_ADMIN_KEY,{
      auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}
    });
    const result=await inspect(admin);
    assert.equal(cfg.accounts.length,result.actors);
    console.log("RQG32G PREFLIGHT PASS: 3 company QA identities unassigned, no legal acceptance; 1 Owner; read-only");
  }catch(e){
    console.error("RQG32G PREFLIGHT BLOCKED",e instanceof Error?e.name:"Error");
    process.exitCode=1;
  }
}
if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url)await main();
