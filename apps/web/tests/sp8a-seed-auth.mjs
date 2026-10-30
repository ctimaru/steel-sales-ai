import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

assert.equal(process.env.CI, "true");
assert.equal(process.env.SUPABASE_URL, "http://127.0.0.1:54321", "Only ephemeral local Supabase allowed");
const key = process.env.SP8A_LOCAL_SERVICE_ROLE_KEY;
assert.ok(key && key.length > 20 && process.env.RUNNER_TEMP);
const admin = createClient(process.env.SUPABASE_URL, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const actors = [];
for (const actor of [{ id: "owner", email: "sp8a-owner@example.test" },
                     { id: "ordinary", email: "sp8a-ordinary@example.test" }]) {
  const password = randomBytes(24).toString("base64url") + "Aa1!";
  const { data, error } = await admin.auth.admin.createUser({
    email: actor.email, password, email_confirm: true,
  });
  assert.ifError(error);
  assert.ok(data?.user?.id);
  actors.push({ ...actor, user_id: data.user.id, password });
}
writeFileSync(path.join(process.env.RUNNER_TEMP, "sp8a-users.json"), JSON.stringify(actors), { mode: 0o600 });
writeFileSync(path.join(process.env.RUNNER_TEMP, "sp8a-vars.sql"),
  actors.map(x => "\\set " + x.id + "_user_id '" + x.user_id + "'").join("\n")+"\n", { mode: 0o600 });
console.log("SP8.A local-only GoTrue identities created: owner and unauthorized actor (credentials redacted)");
