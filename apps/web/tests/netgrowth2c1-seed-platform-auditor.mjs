/**
 * NET-GROWTH2C.1 — isolated Platform audit persona for local-only Chrome CI.
 * Never reuse a buyer/supplier persona; never run against hosted Supabase.
 */
import assert from "node:assert/strict";
import {randomBytes} from "node:crypto";
import {writeFileSync,chmodSync} from "node:fs";
import path from "node:path";
import {createClient} from "@supabase/supabase-js";

const url=process.env.SUPABASE_URL??"";
assert.match(url,/^http:\/\/(?:127\.0\.0\.1|localhost):54321\/?$/);
assert.equal(process.env.FLOW1_LOCAL_PROVIDER,"true");
assert.ok(process.env.RUNNER_TEMP);
const key=process.env.DEMOTEST23_LOCAL_SERVICE_ROLE_KEY;
assert.ok(key&&key.length>20);
const password=randomBytes(24).toString("base64url")+"Aa1!";
const email="netgrowth2c1-auditor@example.test";
const admin=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
const {data,error}=await admin.auth.admin.createUser({email,password,email_confirm:true});
assert.ifError(error);
assert.ok(data?.user?.id);
const temp=process.env.RUNNER_TEMP;
const creds=path.join(temp,"netgrowth2c1-auditor.json");
const vars=path.join(temp,"netgrowth2c1-auditor-vars.sql");
writeFileSync(creds,JSON.stringify({email,password}),{mode:0o600});
writeFileSync(vars,"\\set netgrowth_auditor_user_id '"+data.user.id+"'\n",{mode:0o600});
chmodSync(creds,0o600);chmodSync(vars,0o600);
console.log("NET-GROWTH2C.1 LOCAL PASS: independent synthetic Platform auditor created");
