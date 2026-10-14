/**
 * RQG3.2e - Manual protected self-claim of four approved QA staff invitations.
 *
 * IMPORTANT: authenticate each exact synthetic test user with a PUBLIC
 * publishable key. The existing SECURITY DEFINER RPC checks auth.uid(),
 * confirmed email, owner-created pending invitation, and assigned role.
 * No service-role key, owner credentials, auth.admin, direct row mutation,
 * real-company account, or automatic CI execution is used.
 */
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { createClient } from "@supabase/supabase-js";
import {
  PROJECT_URL,
  PERSONAS,
} from "./rqg32a-provision-auth-personas.mjs";

export const PUBLISHABLE_KEY = "sb_publishable_pW9odHEb0Ui4NQFjxMlb8Q__xwrcyyw";
export const APPROVAL = "RQG32E_CLAIM_FOUR_APPROVED_INVITATIONS";
export const TARGETS = Object.freeze(
  PERSONAS.filter(p => p.staffRole).map(p => ({
    id: p.id,
    key: p.key,
    email: "rqg32-"+p.tag+"@smartsteelsales.test",
    role: p.staffRole,
  })),
);

export function readSelfClaimConfig(env) {
  assert.equal(env.CI,"true","Protected ephemeral runner required");
  assert.equal(env.GITHUB_EVENT_NAME,"workflow_dispatch","Manual workflow only");
  assert.equal(env.GITHUB_REF,"refs/heads/main","Protected main required");
  assert.equal(env.RQG32E_APPROVAL,APPROVAL,"Explicit owner-approved claim required");
  assert.equal(env.RQG32E_SUPABASE_URL,PROJECT_URL,"Supabase project mismatch");
  assert.equal(env.RQG32E_PUBLISHABLE_KEY,PUBLISHABLE_KEY,"Only pinned public key allowed");
  assert.equal(TARGETS.length,4,"Exactly four synthetic staff personas");
  const accounts=TARGETS.map(target=>{
    const password=env["RQG32_"+target.key+"_PASSWORD"]??"";
    assert.ok(password.length>=20&&password.length<=128,
      "Missing or weak QA password: "+target.id);
    return {...target,password};
  });
  assert.equal(new Set(accounts.map(p=>p.email)).size,4);
  assert.equal(new Set(accounts.map(p=>p.password)).size,4,
    "Distinct QA user credentials required");
  return {accounts};
}

function verifyStaffContext(context,account) {
  assert.ok(context && typeof context==="object","Platform context missing");
  assert.equal(context.is_platform_owner,false,"No test account may be owner");
  assert.equal(context.is_platform_staff,true,"QA user must be Platform Staff");
  assert.equal(context.staff_status,"active","Staff role must be active");
  assert.deepEqual(context.roles,[account.role],
    "Exactly one delegated QA role required");
  assert.ok(Array.isArray(context.permissions),"Platform permission set missing");
  assert.ok(context.permissions.includes("platform.console.access"),
    "Delegated QA staff must have scoped console access");
}

export async function selfClaim(config,makeClient,report=console.log) {
  // Validate credentials and identities of all four participants *before*
  // claiming any invitation. Re-running is safe after partial completion.
  const sessions=[];
  try {
    for(const account of config.accounts) {
      const client=makeClient();
      const {data,error}=await client.auth.signInWithPassword({
        email:account.email,password:account.password,
      });
      assert.ifError(error);
      assert.equal(data?.user?.email?.toLowerCase(),account.email,
        "Wrong synthetic Auth identity");
      assert.equal(data.user.app_metadata?.rqg32_suite,"RQG3.2a",
        "Only owned QA identities allowed");
      assert.equal(data.user.app_metadata?.rqg32_persona,account.id,
        "Incorrect QA persona marker");
      const {data:before,error:ctxError}=await client.rpc("platform_access_context");
      assert.ifError(ctxError);
      assert.equal(before?.is_platform_owner,false,"Test account cannot be owner");
      if(before.is_platform_staff) {
        verifyStaffContext(before,account);
      }
      sessions.push({account,client,alreadyActive:before.is_platform_staff});
    }
    for(const {account,client,alreadyActive} of sessions) {
      if(!alreadyActive) {
        const {data:claim,error}=await client.rpc("sa2_claim_platform_staff_invitation");
        assert.ifError(error);
        assert.equal(claim?.claimed,true,"Owner-approved QA invitation missing/expired");
        assert.equal(claim?.staff_status,"active");
        assert.deepEqual(claim?.roles,[account.role],
          "Self-claim produced incorrect role");
      }
      const {data:after,error:ctxError}=await client.rpc("platform_access_context");
      assert.ifError(ctxError);
      verifyStaffContext(after,account);
      report("RQG32E CLAIM PASS: "+account.id+"; exact role; no owner escalation");
    }
    report("RQG32E PASS: 4/4 QA staff accounts self-claimed; NO tenant changes");
    return {activated:4};
  } finally {
    // No sessions uploaded to Actions artifacts, logs or external storage.
    for(const {client} of sessions) {
      try { await client.auth.signOut(); } catch {}
    }
  }
}

async function main() {
  try {
    const config=readSelfClaimConfig(process.env);
    await selfClaim(config,()=>createClient(PROJECT_URL,PUBLISHABLE_KEY,{
      auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
    }));
  } catch(error) {
    // Deliberately withhold Supabase Auth errors and identifiers from CI logs.
    console.error("RQG32E BLOCKED",error instanceof Error?error.name:"Error");
    process.exitCode=1;
  }
}
if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url)await main();
