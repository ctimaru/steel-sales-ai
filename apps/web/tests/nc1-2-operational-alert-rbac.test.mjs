import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (p) => fs.readFileSync(new URL(p, import.meta.url), "utf8");
const page = read("../app/(workspace)/alerts/page.tsx");
const actions = read("../app/(workspace)/alerts/actions.ts");
const migration = read("../../../supabase/migrations/20261008093000_nc12_operational_alert_authorization_audit.sql");
const sqlAcceptance = read("../../../supabase/tests/nc12_operational_alert_authorization_audit.sql");
const workflow = read("../../../.github/workflows/p0-required-gate.yml");

test("NC1.2: server actions and UI only grant mutation controls to the organization admin", () => {
  assert.match(actions, /membership\.role !== "admin"/);
  assert.match(actions, /\.select\("organization_id,role,is_default,status"\)/);
  assert.match(actions, /revalidatePath\("\/operations\/alerts"\)/);
  assert.match(page, /const canManage = membership\.role === "admin"/);
  assert.match(page, /\{canManage \? <OperationalAlertActions/);
  assert.match(page, /Consultazione in sola lettura/);
});

test("NC1.2: database enforces tenant role, not client role claims", () => {
  assert.match(migration, /m\.user_id=v_actor and m\.status='active' and m\.role='admin'/);
  assert.match(migration, /m\.organization_id=a\.organization_id/);
  assert.match(migration, /alert unavailable or insufficient privileges/);
  assert.match(migration, /is_organization_member\(p_organization_id,false\)/);
  assert.doesNotMatch(migration, /user_metadata|raw_user_meta_data/);
});

test("NC1.2: immutable audit is trigger-based and tenant scoped", () => {
  assert.match(migration, /create table if not exists public\.operational_alert_action_audit/);
  assert.match(migration, /enable row level security/);
  assert.match(migration, /revoke all on public\.operational_alert_action_audit from public, anon, authenticated, service_role/);
  assert.match(migration, /before update or delete/);
  assert.match(migration, /after update of status/);
  assert.match(migration, /p1_operational_alert_audit_read/);
  assert.match(migration, /m\.status='active' and m\.role='admin'/);
  assert.match(page, /Storico operazioni/);
});

test("NC1.2: SQL acceptance exercises roles, cross-tenant, idempotency and rollback", () => {
  assert.match(sqlAcceptance, /begin;/);
  assert.match(sqlAcceptance, /rollback;/);
  assert.match(sqlAcceptance, /member may read tenant alerts/);
  assert.match(sqlAcceptance, /viewer may read tenant alerts/);
  assert.match(sqlAcceptance, /wrong org/);
  assert.match(sqlAcceptance, /repeat acknowledge idempotent/);
  assert.match(sqlAcceptance, /repeat resolve idempotent/);
  assert.match(sqlAcceptance, /audit immutable and not deleted/);
  assert.match(workflow, /nc12_operational_alert_authorization_audit\.sql/);
});
