/**
 * RQG3.2i — Production Company Pilot PREFLIGHT (read-only).
 * No user creation, legal acknowledgement, Review decisions or test fixtures.
 * This is a gate for a dedicated, voluntarily approved live pilot account only.
 */
import assert from "node:assert/strict";
import {pathToFileURL} from "node:url";
import {createClient} from "@supabase/supabase-js";

export const PROJECT="https://ecrafjdummcdfycznitx.supabase.co";
export const APPROVAL="RQG32I_APPROVE_CONSENTED_PILOT_READ_ONLY";
export const LEGAL_VERSION="2026-10-04-lr5-v1";
const UUID=/^[\da-f]{8}-[\da-f]{4}-[1-8][\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i;

export function parseScope(raw){
  assert.ok(raw && raw.length<4096,"Approved pilot scope is required");
  const scope=JSON.parse(raw);
  assert.ok(scope && typeof scope==="object" && !Array.isArray(scope));
  assert.deepEqual(Object.keys(scope).sort(),
    ["adminEmail","adminUserId","authorizationRef","organizationId","reviewId"].sort(),
    "Unexpected scope keys");
  assert.match(scope.adminUserId??"",UUID);
  assert.match(scope.organizationId??"",UUID);
  assert.match(scope.adminEmail??"",/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
  assert.ok(!/smartsteelsales\.test$/i.test(scope.adminEmail),
    "Unconsented RQG32 synthetic identities cannot be treated as a real pilot");
  assert.ok(Number.isSafeInteger(scope.reviewId)&&scope.reviewId>0);
  assert.match(scope.authorizationRef??"",/^[A-Za-z0-9/_-]{8,80}$/,
    "The participant's out-of-band pilot authorization reference is mandatory");
  return scope;
}
export function config(env){
  assert.equal(env.CI,"true");
  assert.equal(env.GITHUB_EVENT_NAME,"workflow_dispatch");
  assert.equal(env.GITHUB_REF,"refs/heads/main");
  assert.equal(env.RQG32I_APPROVAL,APPROVAL);
  assert.equal(env.RQG32I_SUPABASE_URL,PROJECT);
  assert.ok(env.RQG32I_ADMIN_KEY?.startsWith("sb_secret_")||
    env.RQG32I_ADMIN_KEY?.startsWith("eyJ"),"Protected production Admin key required");
  return parseScope(env.RQG32I_PILOT_SCOPE_JSON);
}
async function rows(admin,table,fields,filters){
  let q=admin.from(table).select(fields);
  for(const [column,value] of filters)q=q.eq(column,value);
  const {data,error}=await q;
  assert.ifError(error);
  assert.ok(Array.isArray(data),"Missing scoped read");
  return data;
}
export async function inspect(admin,scope){
  const {data:auth,error:authError}=await admin.auth.admin.getUserById(scope.adminUserId);
  assert.ifError(authError);
  assert.equal(auth?.user?.email?.toLowerCase(),scope.adminEmail.toLowerCase(),
    "Approved pilot identity mismatch");
  assert.ok(auth?.user?.email_confirmed_at,"Pilot Auth email must be verified");
  assert.notEqual(auth?.user?.app_metadata?.rqg32_suite,"RQG3.2a");

  const [owners,platformRoles,staffRoles,membership,org,legal,review]=await Promise.all([
    rows(admin,"platform_user_roles","user_id,role,status",[]),
    rows(admin,"platform_user_roles","role,status",[["user_id",scope.adminUserId]]),
    rows(admin,"platform_staff_roles","role_key,status",[["user_id",scope.adminUserId]]),
    rows(admin,"organization_memberships","organization_id,role,status",
      [["user_id",scope.adminUserId]]),
    rows(admin,"organizations","id,slug,onboarding_status",[["id",scope.organizationId]]),
    rows(admin,"user_legal_acceptances",
      "privacy_notice_version,terms_version,privacy_acknowledged_at,terms_accepted_at,acceptance_source",
      [["user_id",scope.adminUserId],["privacy_notice_version",LEGAL_VERSION],["terms_version",LEGAL_VERSION]]),
    rows(admin,"commercial_review_queue","id,organization_id,status",[["id",scope.reviewId]]),
  ]);
  assert.equal(owners.filter(x=>x.role==="platform_superadmin"&&x.status==="active").length,1,
    "Exactly one production Owner required");
  assert.ok(!platformRoles.some(x=>x.status==="active"),
    "Company pilot identity may not hold any active Platform role");
  assert.ok(!staffRoles.some(x=>x.status==="active"),
    "Company pilot identity may not hold Platform staff permissions");
  const active=membership.filter(x=>x.status==="active");
  assert.equal(active.length,1,"Pilot must have exactly one active tenant membership");
  assert.equal(active[0].organization_id,scope.organizationId);
  assert.equal(active[0].role,"admin","Pilot must be a Company admin, not Viewer");
  assert.equal(org.length,1,"Approved organization missing");
  assert.equal(org[0].onboarding_status,"completed","Company must be governed and active");
  assert.ok(!/^rqg32-/i.test(org[0].slug??""),"Synthetic QA organizations not eligible");
  assert.ok(legal.some(x=>x.privacy_acknowledged_at&&x.terms_accepted_at&&x.acceptance_source),
    "Genuine current-version acceptance must already exist");
  assert.equal(review.length,1,"Pilot Review evidence not found");
  assert.equal(review[0].organization_id,scope.organizationId,"Review evidence from another tenant");
  assert.equal(review[0].status,"pending","Pilot Review must remain pending");
  return {approved:true,companyAdmin:true,legalCurrent:true,ownPendingReview:true,
    solePlatformOwner:true,applicationWrites:0};
}
async function main(){
  try{
    const scope=config(process.env);
    const admin=createClient(PROJECT,process.env.RQG32I_ADMIN_KEY,{
      auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}
    });
    await inspect(admin,scope);
    console.log("RQG32I PREFLIGHT PASS: 1 approved real company admin; current legal acceptance; own pending Review; sole Owner; zero writes");
  }catch(e){
    console.error("RQG32I PREFLIGHT BLOCKED",e instanceof Error?e.name:"Error");
    process.exitCode=1;
  }
}
if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url)await main();
