/**
 * NET-PERF1.A: fail-fast local-only PostgREST contract smoke.
 * Prints only SQLSTATE/status and shape; no company data, credentials or tokens.
 */
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import path from "node:path";
import {createClient} from "@supabase/supabase-js";

assert.equal(process.env.NEXT_PUBLIC_SUPABASE_URL,"http://127.0.0.1:54321");
assert.ok(process.env.RUNNER_TEMP);
const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
assert.ok(key&&key.length>20);
const users=JSON.parse(readFileSync(path.join(process.env.RUNNER_TEMP,"perf1-personas.json"),"utf8"));
const owner=users.find(x=>x.id==="owner");
assert.ok(owner?.email&&owner?.password);
const client=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,key,{
  auth:{persistSession:false,autoRefreshToken:false},
});
const {error:loginError}=await client.auth.signInWithPassword({
 email:owner.email,password:owner.password
});
assert.ifError(loginError);

const organization="00000000-0000-0000-0000-000000023301";
const {data:entitlement,error:entitlementError}=await client.rpc("pa1_3_network_access_state",{
  p_organization_id:organization,
});
console.log("NETPERF1A LOCAL ENTITLEMENT",JSON.stringify({
  error:entitlementError?.code??null,canAccess:entitlement?.can_access_network===true,
  status:entitlementError?.status??null,
}));
assert.ifError(entitlementError);
assert.equal(entitlement?.can_access_network,true);

const {data,error,status}=await client.rpc("netlaunch4b_browse_page",{
  p_organization_id:organization,p_access:"pro",p_source:"published",
  p_query:null,p_role:null,p_region:null,p_persona:null,p_page:1,p_limit:18,
});
console.log("NETPERF1A LOCAL BROWSE CONTRACT",JSON.stringify({
  sqlstate:typeof error?.code==="string"?error.code.slice(0,10):null,
  httpStatus:status,contract:data?.contract??null,
  source:data?.source??null,total:Number.isInteger(data?.total)?data.total:null,
  itemCount:Array.isArray(data?.items)?data.items.length:null,
  // Whitelisted error class only. No freeform server message is logged.
  faultClass:error?.code==="42501"?"permission":
    error?.code==="42883"?"function_resolution":
    error?.code==="42P01"?"missing_relation":
    error?.code==="42703"?"missing_column":
    error?.code==="PGRST202"?"schema_cache":
    error?"other_sql_or_gateway":"none",
}));
assert.ifError(error);
assert.equal(data?.contract,"netlaunch4b-page-v1");
assert.ok(data?.total>=24,"Synthetic company fixture not visible through published browse");
console.log("NET-PERF1.A LOCAL RPC PREFLIGHT PASS");
