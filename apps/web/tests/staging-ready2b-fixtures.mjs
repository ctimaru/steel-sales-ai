/**
 * STAGING-READY2B — exact staging project, disposable Auth personas.
 * No production API, no owner or platform privilege, no provider messages.
 * Only invokes GoTrue administrative create/delete for three reserved .test users.
 */
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { chmodSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const REF = "lwrrrphakpbjhbzljqhn";
const STAGING_URL = "https://" + REF + ".supabase.co";
const PERSONAS = [
  { id: "adminA", email: "sr2b-admin-a@smartsteelsales.test", role: "admin" },
  { id: "adminB", email: "sr2b-admin-b@smartsteelsales.test", role: "admin" },
  { id: "viewerA", email: "sr2b-viewer-a@smartsteelsales.test", role: "viewer" },
];
const mode = process.argv[2] || "preflight";
assert.ok(["preflight", "setup", "cleanup"].includes(mode), "Invalid fixture mode");
assert.equal(process.env.CI, "true", "Staging fixtures require CI");
assert.equal(process.env.GITHUB_REF, "refs/heads/main", "Protected main is required");
assert.equal(process.env.GITHUB_EVENT_NAME, "workflow_dispatch", "Manual dispatch required");
assert.equal(process.env.STAGING_READY2B_SUPABASE_URL, STAGING_URL, "Production/unknown project refused");
assert.equal(process.env.REQUESTED_PROJECT_REF, REF, "Database project must equal Auth project");
assert.ok(process.env.RUNNER_TEMP, "Temporary CI directory required");
const secret = process.env.STAGING_READY2B_AUTH_SECRET_KEY || "";
assert.ok(secret.startsWith("sb_secret_") || secret.startsWith("eyJ"), "Dedicated staging admin key absent");
const admin = createClient(STAGING_URL, secret, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const temp = process.env.RUNNER_TEMP;
const personasPath = path.join(temp, "sr2b-personas.json");
const varsPath = path.join(temp, "sr2b-vars.psql");

async function listUsers() {
  const results = [];
  for (let page = 1; page <= 4; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    assert.ifError(error);
    assert.ok(Array.isArray(data?.users), "Admin listing unavailable");
    results.push(...data.users);
    if (data.users.length < 1000) return results;
  }
  throw new Error("Staging Auth inventory too large; stop");
}
const all = await listUsers();
const expected = new Set(PERSONAS.map(p => p.email));
const existing = all.filter(u => expected.has((u.email || "").toLowerCase()));

if (mode === "preflight") {
  assert.equal(all.length, 0, "Staging Auth is not empty; no account provisioning allowed");
  console.log("STAGING-READY2B Auth preflight PASS: empty staging directory");
}
if (mode === "setup") {
  assert.equal(all.length, 0, "Refuse account creation on a nonempty staging Auth project");
  const created = [];
  try {
    for (const persona of PERSONAS) {
      const password = randomBytes(32).toString("base64url") + "Aa1!";
      const { data, error } = await admin.auth.admin.createUser({
        email: persona.email, password, email_confirm: true,
        user_metadata: { qa_marker: "STAGING_READY2B_ONLY" },
      });
      assert.ifError(error);
      assert.ok(data?.user?.id && data.user.email?.toLowerCase() === persona.email);
      created.push({ ...persona, password, userId: data.user.id });
    }
    const variables = [
      ["admin_a_user_id", created[0].userId],
      ["admin_b_user_id", created[1].userId],
      ["viewer_a_user_id", created[2].userId],
    ].map(([k, v]) => "\\set " + k + " '" + v + "'");
    writeFileSync(personasPath, JSON.stringify(created), { mode: 0o600 });
    writeFileSync(varsPath, variables.join("\n") + "\n", { mode: 0o600 });
    chmodSync(personasPath, 0o600);
    chmodSync(varsPath, 0o600);
    console.log("STAGING-READY2B created three synthetic Auth accounts; credentials are ephemeral");
  } catch (error) {
    // Do not log auth credentials, sessions or GoTrue full responses.
    console.error("STAGING-READY2B Auth setup failed; cleanup is required");
    throw new Error("Staging Auth setup failed (" + (error?.name || "Error") + ")");
  }
}
if (mode === "cleanup") {
  // A previous run may have partially created some identities. Only exact,
  // intentionally reserved synthetic accounts may be deleted.
  for (const user of existing) {
    assert.equal(user.user_metadata?.qa_marker, "STAGING_READY2B_ONLY",
      "Reserved test identity has unexpected provenance; manual investigation required");
    const { error } = await admin.auth.admin.deleteUser(user.id);
    assert.ifError(error);
  }
  const after = await listUsers();
  assert.equal(after.filter(u => expected.has((u.email || "").toLowerCase())).length, 0);
  console.log("STAGING-READY2B GoTrue cleanup PASS; reserved identities absent");
}
