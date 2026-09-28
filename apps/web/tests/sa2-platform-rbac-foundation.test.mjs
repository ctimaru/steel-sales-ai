import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const platformAdmin = fs.readFileSync(
  new URL("../lib/platform-admin.ts", import.meta.url),
  "utf8",
);
const contract = fs.readFileSync(
  new URL("../lib/platform-access-contract.ts", import.meta.url),
  "utf8",
);
const migration = fs.readFileSync(
  new URL("../../../supabase/migrations/20260928162000_sa2_platform_rbac_foundation.sql", import.meta.url),
  "utf8",
);
const platformLayout = fs.readFileSync(
  new URL("../app/(platform)/platform/layout.tsx", import.meta.url),
  "utf8",
);
const workspaceContext = fs.readFileSync(
  new URL("../lib/workspace-context.ts", import.meta.url),
  "utf8",
);

test("SA2 implements the RBAC schema without turning Platform Owner into a staff role", () => {
  assert.match(migration, /create table public\.platform_permissions/);
  assert.match(migration, /create table public\.platform_roles/);
  assert.match(migration, /create table public\.platform_staff/);
  assert.match(migration, /create table public\.platform_staff_roles/);
  assert.match(migration, /create table public\.platform_staff_invitations/);
  assert.match(migration, /create table public\.platform_access_events/);
  assert.doesNotMatch(migration, /\('platform_owner','Platform Owner'/);
});

test("SA2 preserves the current root authority and adds a fail-closed capability resolver", () => {
  assert.match(migration, /private\.is_platform_superadmin\(\)/);
  assert.match(migration, /private\.has_platform_permission/);
  assert.match(migration, /public\.has_platform_permission/);
  assert.match(migration, /private\.require_platform_permission/);
  assert.match(migration, /unknown permissions fail closed/i);
});

test("SA2 blocks root-only capabilities from staff role mappings", () => {
  assert.match(migration, /sa2_reject_root_only_role_permission/);
  assert.match(migration, /Root-only permission % cannot be assigned/);
  for (const permission of [
    "platform.staff.invite",
    "platform.staff.manage_roles",
    "platform.staff.suspend",
    "platform.settings.manage",
    "tenant_access.break_glass",
  ]) {
    assert.match(migration, new RegExp(permission.replaceAll(".", "\\.")));
  }
});

test("SA2 adds verified-email invitation and lifecycle primitives", () => {
  assert.match(migration, /sa2_create_platform_staff_invitation/);
  assert.match(migration, /sa2_claim_platform_staff_invitation/);
  assert.match(migration, /email_confirmed_at/);
  assert.match(migration, /sa2_set_platform_staff_roles/);
  assert.match(migration, /sa2_set_platform_staff_status/);
  assert.match(migration, /must be re-invited before reactivation/);
});

test("SA2 keeps RBAC state inaccessible through raw authenticated table reads", () => {
  for (const table of [
    "platform_permissions",
    "platform_roles",
    "platform_role_permissions",
    "platform_staff_invitations",
    "platform_staff",
    "platform_staff_roles",
    "platform_access_events",
  ]) {
    assert.match(
      migration,
      new RegExp("revoke all on table public\\." + table + " from public, anon, authenticated"),
    );
  }
});

test("SA2 exposes typed web permission and access-context helpers", () => {
  assert.match(platformAdmin, /PlatformAccessContext/);
  assert.match(platformAdmin, /hasPlatformPermission/);
  assert.match(platformAdmin, /getPlatformAccessContext/);
  assert.match(platformAdmin, /requirePlatformPermission/);
  assert.match(platformAdmin, /PlatformPermissionKey/);
});

test("SA2 does not cut over existing Platform routes before delegated-domain acceptance", () => {
  assert.match(platformLayout, /requirePlatformContext/);
  assert.match(workspaceContext, /rpc\("is_platform_superadmin"\)/);
  assert.doesNotMatch(platformLayout, /requirePlatformPermission/);
});

test("SA2 database seed remains aligned with the SA1 contract", () => {
  for (const role of [
    "registration_admin",
    "network_operations_admin",
    "claims_verification_admin",
    "knowledge_editor",
    "knowledge_publisher",
    "platform_auditor",
  ]) {
    assert.match(contract, new RegExp(role));
    assert.match(migration, new RegExp(role));
  }
  assert.match(migration, /v_permission_count<>31/);
  assert.match(migration, /v_role_count<>6/);
  assert.match(migration, /v_mapping_count<>39/);
});
