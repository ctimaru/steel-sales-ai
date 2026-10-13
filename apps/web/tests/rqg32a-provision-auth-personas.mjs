/**
 * RQG3.2a - SAFE & OPT-IN production Auth bootstrap.
 *
 * Scope: seven synthetic GoTrue accounts only. Does NOT grant Platform roles,
 * create organizations, approve registration, create commercial data, or accept
 * legal terms. Those operations remain owner/tenant-governed.
 *
 * Modes: preflight (default, read-only), create, verify, ready.
 * The caller must use the dedicated GitHub Actions secrets; nothing is logged
 * or persisted in CI except coarse PASS/BLOCKED summaries.
 */
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { createClient } from "@supabase/supabase-js";

export const PROJECT_URL = "https://ecrafjdummcdfycznitx.supabase.co";
export const MARKER_A = "RQG32-ORG_A-20261013";
export const MARKER_B = "RQG32-ORG_B-20261013";
export const PERSONAS = Object.freeze([
  { id:"registration", key:"REGISTRATION", tag:"registration", staffRole:"registration_admin" },
  { id:"claims", key:"CLAIMS", tag:"claims", staffRole:"claims_verification_admin" },
  { id:"trust", key:"TRUST", tag:"trust", staffRole:"network_trust_admin" },
  { id:"auditor", key:"AUDITOR", tag:"auditor", staffRole:"platform_auditor" },
  { id:"companyA", key:"COMPANY_A", tag:"company-a", org:"rqg32-company-a", companyRole:"admin" },
  { id:"companyB", key:"COMPANY_B", tag:"company-b", org:"rqg32-company-b", companyRole:"admin" },
  { id:"viewer", key:"VIEWER", tag:"viewer", org:"rqg32-company-a", companyRole:"viewer" },
]);
export const MODES = Object.freeze(["preflight","create","verify","ready"]);

export function readConfiguration(env) {
  const mode = env.RQG32A_MODE ?? "preflight";
  assert.ok(MODES.includes(mode), "Unsupported operation mode");
  const approval = mode === "create"
    ? "RQG32A_CREATE_SEVEN_SYNTHETIC_USERS"
    : "RQG32A_INSPECT_SYNTHETIC_USERS";
  assert.equal(env.RQG32A_APPROVAL,approval,"Explicit mode-specific approval required");
  assert.equal(env.CI,"true","Dedicated ephemeral GitHub CI runner only");
  assert.equal(env.RQG32A_SUPABASE_URL,PROJECT_URL,"Hosted project mismatch");
  assert.ok(env.RQG32A_AUTH_SECRET_KEY?.startsWith("sb_secret_") ||
    env.RQG32A_AUTH_SECRET_KEY?.startsWith("eyJ"),
    "Dedicated server-side Supabase secret required");
  const accounts = PERSONAS.map(p=>{
    const email = (env["RQG32_"+p.key+"_EMAIL"] ?? "").trim().toLowerCase();
    const password = env["RQG32_"+p.key+"_PASSWORD"] ?? "";
    assert.equal(email,"rqg32-"+p.tag+"@smartsteelsales.test",
      "Unexpected synthetic identity for "+p.id);
    assert.ok(password.length>=20 && password.length<=128,
      "Strong dedicated test credential missing: "+p.id);
    return {...p,email,password};
  });
  assert.equal(new Set(accounts.map(a=>a.password)).size,7,
    "Passwords must be distinct for every persona");
  assert.equal(new Set(accounts.map(a=>a.email)).size,7);
  assert.equal(env.RQG32_COMPANY_A_MARKER,MARKER_A,"Synthetic A marker mismatch");
  assert.equal(env.RQG32_COMPANY_B_MARKER,MARKER_B,"Synthetic B marker mismatch");
  return {mode,accounts};
}
export async function getAllUsers(admin) {
  const found=[];
  for(let page=1;page<=10;page++){
    const {data,error}=await admin.auth.admin.listUsers({page,perPage:1000});
    assert.ifError(error);
    assert.ok(Array.isArray(data?.users),"Admin listing not available");
    found.push(...data.users);
    if(data.users.length<1000) return found;
  }
  throw new Error("Account directory too large: safe pagination limit");
}
async function read(admin,table,fields="*") {
  const {data,error}=await admin.from(table).select(fields);
  assert.ifError(error);
  assert.ok(Array.isArray(data),"Missing database view "+table);
  return data;
}
export async function inspect(admin,accounts) {
  const [directory,owners,staff,staffRoles,orgs,memberships,queue]=await Promise.all([
    getAllUsers(admin),
    read(admin,"platform_user_roles","user_id,role,status"),
    read(admin,"platform_staff","user_id,status"),
    read(admin,"platform_staff_roles","user_id,role_key,status"),
    read(admin,"organizations","id,slug,onboarding_status"),
    read(admin,"organization_memberships","user_id,organization_id,role,status"),
    read(admin,"commercial_review_queue","id,organization_id,status,source_text"),
  ]);
  const ownerList=owners.filter(r=>r.role==="platform_superadmin"&&r.status==="active");
  assert.equal(ownerList.length,1,"Exactly one real Platform Owner required");
  const byEmail=new Map(directory.map(u=>[(u.email??"").toLowerCase(),u]));
  const existing=new Map();
  const ids=new Set();
  for(const account of accounts){
    const user=byEmail.get(account.email);
    if(!user) continue;
    assert.equal(user.app_metadata?.rqg32_suite,"RQG3.2a",
      "Name collision: unowned synthetic identity "+account.id);
    assert.equal(user.app_metadata?.rqg32_persona,account.id,
      "Wrong persona marker for "+account.id);
    assert.notEqual(ownerList[0]?.user_id,user.id,"Superadmin cannot be a test persona");
    assert.ok(!ids.has(user.id),"Duplicate Auth identity");
    ids.add(user.id);
    existing.set(account.id,user);
  }
  const reserved=directory.filter(u=>/^rqg32-.*@smartsteelsales\.test$/i.test(u.email??""));
  assert.equal(reserved.length,existing.size,"Unrecognized RQG32 Auth identities exist");
  return {existing,owners:ownerList,staff,staffRoles,orgs,memberships,queue};
}
export function assertReadiness(snapshot,accounts) {
  assert.equal(snapshot.existing.size,7,"All seven Auth accounts must exist first");
  const lookup=new Map(accounts.map(p=>[p.id,snapshot.existing.get(p.id)?.id]));
  const organizations=new Map(snapshot.orgs.filter(o=>o.slug?.startsWith("rqg32-"))
    .map(o=>[o.slug,o]));
  assert.equal(organizations.size,2,"Expected two test-only active organizations");
  for(const slug of ["rqg32-company-a","rqg32-company-b"]){
    assert.equal(organizations.get(slug)?.onboarding_status,"completed",
      "Synthetic company must be activated via governed registration");
  }
  for(const account of accounts){
    const userId=lookup.get(account.id);
    assert.ok(userId);
    const heldRoles=snapshot.staffRoles.filter(r=>r.user_id===userId&&r.status==="active");
    const heldMemberships=snapshot.memberships.filter(m=>m.user_id===userId&&m.status==="active");
    if(account.staffRole){
      assert.equal(snapshot.staff.find(r=>r.user_id===userId)?.status,"active",
        "Platform staff missing activation: "+account.id);
      assert.deepEqual(heldRoles.map(r=>r.role_key),[account.staffRole],
        "Platform role must be granted separately by sole owner: "+account.id);
      assert.equal(heldMemberships.length,0,"Platform staff must not inherit private tenant data");
    }else{
      assert.equal(heldRoles.length,0,"Company identity must not hold Platform staff rights");
      assert.equal(heldMemberships.length,1,"Company identity requires one isolated membership");
      const membership=heldMemberships[0];
      assert.equal(membership.role,account.companyRole);
      assert.equal(membership.organization_id,organizations.get(account.org)?.id,
        "Company account membership is cross-tenant");
    }
  }
  const testRows=snapshot.queue.filter(r=>
    r.source_text===MARKER_A||r.source_text===MARKER_B);
  assert.equal(testRows.length,2,"Exactly two dedicated synthetic pending review rows required");
  for(const [marker,slug] of [[MARKER_A,"rqg32-company-a"],[MARKER_B,"rqg32-company-b"]]){
    const matching=testRows.filter(r=>r.source_text===marker);
    assert.equal(matching.length,1,"No unique Review marker for "+slug);
    assert.equal(matching[0].status,"pending","Never reuse a decided synthetic review row");
    assert.equal(matching[0].organization_id,organizations.get(slug).id,
      "Synthetic Review evidence assigned to wrong tenant");
  }
  return {personas:7,activeSyntheticOrganizations:2,pendingSyntheticReviewRows:2};
}
export async function execute(admin,config,logger=console.log){
  const snapshot=await inspect(admin,config.accounts);
  const preExisting=snapshot.existing.size;
  if(config.mode==="preflight"){
    logger("RQG32A PREFLIGHT PASS: owned synthetic identities="+preExisting+
      "; to create="+(7-preExisting)+"; no writes");
    return {existing:preExisting,created:0,ready:false};
  }
  if(config.mode==="create"){
    let created=0;
    for(const account of config.accounts){
      if(snapshot.existing.has(account.id)) continue;
      const {data,error}=await admin.auth.admin.createUser({
        email:account.email,password:account.password,email_confirm:true,
        app_metadata:{rqg32_suite:"RQG3.2a",rqg32_persona:account.id},
      });
      assert.ifError(error);
      assert.equal(data?.user?.app_metadata?.rqg32_suite,"RQG3.2a",
        "Auth API did not persist trusted test marker; abort");
      created++;
      logger("RQG32A CREATED synthetic identity "+account.id);
    }
    const after=await inspect(admin,config.accounts);
    assert.equal(after.existing.size,7,"Auth identity bootstrap incomplete");
    logger("RQG32A CREATE PASS: newly created="+created+
      "; platform roles, tenant memberships, legal acceptance and Review evidence NOT granted");
    return {existing:7,created,ready:false};
  }
  assert.equal(preExisting,7,"Auth identities missing: run controlled create first");
  if(config.mode==="verify"){
    logger("RQG32A VERIFY PASS: seven tagged Auth identities, one Platform Owner; no writes");
    return {existing:7,created:0,ready:false};
  }
  const summary=assertReadiness(snapshot,config.accounts);
  logger("RQG32A READY PASS: "+summary.personas+" delegated/test accounts; 2 synthetic tenant Review rows");
  return {existing:7,created:0,ready:true};
}
async function main(){
  try{
    const config=readConfiguration(process.env);
    const client=createClient(PROJECT_URL,process.env.RQG32A_AUTH_SECRET_KEY,{
      auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
    });
    await execute(client,config);
  }catch(error){
    // Avoid dumping Supabase error objects, email addresses, or credential-bearing URLs.
    console.error("RQG32A BLOCKED",error instanceof Error?error.name:"Error");
    process.exitCode=1;
  }
}
if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url)await main();
