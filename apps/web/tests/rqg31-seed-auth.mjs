/**
 * RQG3.1: disposable GoTrue accounts for delegated Platform review acceptance.
 * Hard-blocks any hosted Supabase endpoint and never persists credentials to Git.
 */
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { writeFileSync, chmodSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL ?? "";
assert.match(url, /^http:\/\/(?:127\.0\.0\.1|localhost):54321\/?$/, "LOCAL Supabase only");
assert.ok(process.env.RUNNER_TEMP, "Ephemeral runner required");
const serviceKey = process.env.DEMOTEST23_LOCAL_SERVICE_ROLE_KEY;
assert.ok(serviceKey && serviceKey.length > 20, "Local-only service credential required");
const admin = createClient(url, serviceKey, { auth: { persistSession:false, autoRefreshToken:false } });
const actors = [
  { id:"claimsStaff", type:"claims_verification_admin", email:"rqg31-claims@example.test" },
  { id:"trustStaff", type:"network_trust_admin", email:"rqg31-trust@example.test" },
  { id:"auditor", type:"platform_auditor", email:"rqg31-auditor@example.test" },
];
const vars = [];
for (const actor of actors) {
  const password = randomBytes(24).toString("base64url") + "Aa1!";
  const { data, error } = await admin.auth.admin.createUser({
    email:actor.email, password, email_confirm:true,
  });
  assert.ifError(error);
  assert.ok(data?.user?.id, "GoTrue identity missing: " + actor.id);
  actor.userId = data.user.id;
  actor.password = password;
  vars.push("\\set " + actor.id + "_user_id '" + actor.userId + "'");
}
const p = path.join(process.env.RUNNER_TEMP, "rqg31-personas.json");
const sql = path.join(process.env.RUNNER_TEMP, "rqg31-vars.sql");
writeFileSync(p, JSON.stringify(actors), { mode:0o600 });
writeFileSync(sql, vars.join("\n") + "\n", { mode:0o600 });
chmodSync(p,0o600);
chmodSync(sql,0o600);
console.log("RQG3.1 LOCAL GoTrue personas created: claims, trust, auditor (no hosted users)");
