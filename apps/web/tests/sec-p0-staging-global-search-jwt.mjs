import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import path from "node:path";
import {createClient} from "@supabase/supabase-js";

const staging = "https://lwrrrphakpbjhbzljqhn.supabase.co";
const worker = "https://steel-sales-worker-staging-staging.up.railway.app";
assert.equal(process.env.CI,"true");
assert.equal(process.env.GITHUB_REF,"refs/heads/main");
assert.equal(process.env.REQUESTED_PROJECT_REF,"lwrrrphakpbjhbzljqhn");
assert.equal(process.env.STAGING_READY2B_SUPABASE_URL,staging);
assert.equal(process.env.STAGING_WORKER_URL,worker);
const token=process.env.STAGING_WORKER_INTERNAL_TOKEN || "";
assert.ok(token.length>=32,"Dedicated staging Worker internal token required");
const anon=process.env.STAGING_SUPABASE_PUBLISHABLE_KEY || "";
assert.ok(anon.length>10,"Staging publishable key required");
const identities=JSON.parse(readFileSync(path.join(process.env.RUNNER_TEMP,"sr2b-personas.json"),"utf8"));
const login = async persona => {
 const client=createClient(staging,anon,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data,error}=await client.auth.signInWithPassword({email:persona.email,password:persona.password});
 assert.ifError(error);
 assert.equal(data.user.id,persona.userId);
 assert.ok(data.session.access_token);
 const {data:claims,error:jwtError}=await client.auth.getClaims(data.session.access_token);
 assert.ifError(jwtError);
 assert.equal(claims.claims.sub,persona.userId,"JWT subject mismatch");
 return claims.claims.sub;
};
const post = async(actorUserId,authorization)=>fetch(worker+"/v1/global-search",{
 method:"POST",
 headers:{"content-type":"application/json","x-worker-token":authorization},
 body:JSON.stringify({actor_user_id:actorUserId,query:"SR2B PRIVATE RFQ",types:["rfq"],limit:20}),
 signal:AbortSignal.timeout(25000)
});
const a=await login(identities[0]); const b=await login(identities[1]);
const bad=await post(a,"invalid-token");
assert.equal(bad.status,401,"Invalid service token must fail closed");
for(const [actor,own,foreign] of [[a,"SR2B BUYER A PRIVATE RFQ","SR2B TRADER B PRIVATE RFQ"],[b,"SR2B TRADER B PRIVATE RFQ","SR2B BUYER A PRIVATE RFQ"]]){
 const response=await post(actor,token);
 assert.equal(response.status,200,"Staging Worker search must succeed (HTTP "+response.status+")");
 const body=await response.json();
 const titles=(body.results||[]).map(x=>x.title||"");
 assert.ok(titles.some(t=>t.includes(own)),"Own synthetic RFQ missing from authorized search");
 assert.ok(!titles.some(t=>t.includes(foreign)),"Cross-tenant RFQ leaked");
 console.log("SEC-P0 Global Search real JWT validated for synthetic persona");
}
console.log("SEC-P0 staging JWT A/B Worker-only PASS (gateway/Vercel not tested)");
