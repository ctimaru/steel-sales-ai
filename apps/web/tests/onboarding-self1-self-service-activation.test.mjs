import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), "utf8");

const actions = read("../app/(italian)/register/actions.ts");
const sender = read("../lib/registration-outcome-email.server.ts");
const itStatus = read("../app/(italian)/registration/status/page.tsx");
const enStatus = read("../app/(english)/en/registration/status/page.tsx");
const migration = read("../../../supabase/migrations/20261103133000_selfact1_self_service_activation.sql");
const sqlTest = read("../../../supabase/tests/selfact1_self_service_activation.sql");
const ci = read("../../../.github/workflows/p0-required-gate.yml");

test("SELF1 submission asks for self-service activation only after a successful submit", () => {
  const submit = actions.indexOf('rpc("p0a_submit_registration_application"');
  const submitError = actions.indexOf("if (submitError)", submit);
  const self = actions.indexOf('"selfact1_self_activate_registration"');
  const redirectAfter = actions.indexOf("redirect(", self);
  assert.ok(submit > 0 && submitError > submit && self > submitError && redirectAfter > self);
  assert.match(actions, /const selfActivated = !selfError && selfActivation\.activated === true;/);
  assert.match(actions, /selfActivated \? "\?submitted=1&activated=1" : "\?submitted=1"/);
});

test("SELF1 tolerates the database function not being deployed yet", () => {
  // An RPC error leaves selfActivated false and the staff-review redirect unchanged.
  assert.doesNotMatch(actions, /if \(selfError\)[\s\S]{0,80}redirect\(/);
});

test("SELF1 sends the activated email once, from the applicant's own submission", () => {
  assert.match(actions, /selfActivated && !selfActivation\.idempotent_replay && user\.email && applicationId/);
  assert.match(actions, /kind: "activated",\s+recipient: user\.email,/);
  assert.match(sender, /export async function deliverRegistrationOutcomeEmail\(/);
  assert.match(sender, /outcomeIdempotencyKey\(applicationId, kind, input\.decidedAt\)/);
  assert.match(sender, /return deliverRegistrationOutcomeEmail\(\{/);
});

test("SELF1 status pages say the workspace is already active", () => {
  assert.match(itStatus, /workspace attivato subito/);
  assert.match(enStatus, /workspace activated right away/);
});

test("SELF1 migration keeps the staff path permissioned and the cores private", () => {
  for (const wrapper of [
    /function private\.m7_application_candidates_impl\([\s\S]*?require_platform_permission\('registrations\.bridge_network'\);\s+return private\.selfact1_candidates_core/,
    /function private\.m7_bridge_registration_impl\([\s\S]*?require_platform_permission\('registrations\.bridge_network'\);\s+return private\.selfact1_bridge_core/,
    /function private\.hp1_1_activate_registration_application_impl\([\s\S]*?require_platform_permission\('registrations\.activate'\);\s+perform private\.require_platform_permission\('registrations\.bridge_network'\);\s+return private\.selfact1_activation_core/,
  ]) assert.match(migration, wrapper);
  assert.match(migration, /revoke all on function private\.selfact1_activation_core\(uuid,uuid,uuid,text,text\) from public, anon, authenticated;/);
  assert.match(migration, /revoke all on function private\.selfact1_bridge_core\(uuid,uuid,uuid,text,text\) from public, anon, authenticated;/);
  assert.match(migration, /revoke all on function private\.selfact1_candidates_core\(uuid\) from public, anon, authenticated;/);
  assert.match(migration, /revoke all on function public\.selfact1_self_activate_registration\(uuid\) from public, anon;/);
});

test("SELF1 self-service rules send every doubtful case to staff review", () => {
  for (const reason of [
    "status_not_pending_review",
    "email_not_verified",
    "claim_requires_review",
    "vat_invalid",
    "vat_missing",
    "identity_candidates",
    "duplicate_application",
    "already_member",
  ]) assert.ok(migration.includes(`'${reason}'`), reason);
  assert.match(migration, /if v_app\.applicant_user_id <> v_user then/);
  assert.match(migration, /activation_mode = 'self_service'/);
});

test("SELF1 SQL acceptance test runs in the required gate", () => {
  assert.match(ci, /selfact1_self_service_activation\.sql/);
  assert.match(sqlTest, /eligible application is activated through self-service/);
  assert.match(sqlTest, /invalid VAT goes to staff review/);
  assert.match(sqlTest, /not allowed to activate this registration application/);
});
