import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const contract = fs.readFileSync(
  new URL("../lib/platform-access-contract.ts", import.meta.url),
  "utf8",
);

const architecture = fs.readFileSync(
  new URL("../../../docs/architecture/sa1-platform-identity-authorization-contract.md", import.meta.url),
  "utf8",
);

test("SA1 keeps the root authority singleton and non-assignable to staff", () => {
  assert.match(contract, /legacyRoleKey: "platform_superadmin"/);
  assert.match(contract, /targetRoleKey: "platform_owner"/);
  assert.match(contract, /singleton: true/);
  assert.match(contract, /assignableToStaff: false/);
  assert.match(architecture, /exactly one active root authority remains allowed/);
});

test("SA1 separates platform authority from tenant membership", () => {
  assert.match(architecture, /Platform authority does \*\*not\*\* imply tenant membership/);
  assert.match(architecture, /Tenant membership does \*\*not\*\* imply Platform authority/);
  assert.match(architecture, /private Commercial Memory/);
  assert.match(contract, /tenant_access\.break_glass/);
});

test("SA1 freezes the initial role templates", () => {
  for (const role of [
    "registration_admin",
    "network_operations_admin",
    "claims_verification_admin",
    "knowledge_editor",
    "knowledge_publisher",
    "platform_auditor",
  ]) {
    assert.match(contract, new RegExp(role));
  }
});

test("SA1 keeps root-only powers out of delegated staff templates", () => {
  const templateSection = contract.split("export const ROOT_ONLY_PERMISSIONS")[0];
  for (const permission of [
    "platform.staff.invite",
    "platform.staff.manage_roles",
    "platform.staff.suspend",
    "platform.settings.manage",
    "tenant_access.break_glass",
  ]) {
    const occurrences = templateSection.split(permission).length - 1;
    assert.equal(
      occurrences,
      1,
      permission + " should appear in the permission catalog but not in any staff role template",
    );
  }
});

test("SA1 separates Knowledge editing from publishing", () => {
  const editor = contract.match(
    /key: "knowledge_editor"[\s\S]*?permissions: \[([\s\S]*?)\][\s\S]*?\},/,
  );
  const publisher = contract.match(
    /key: "knowledge_publisher"[\s\S]*?permissions: \[([\s\S]*?)\][\s\S]*?\},/,
  );
  assert.ok(editor);
  assert.ok(publisher);
  assert.doesNotMatch(editor[1], /knowledge\.publish/);
  assert.match(editor[1], /knowledge\.edit/);
  assert.match(publisher[1], /knowledge\.publish/);
  assert.doesNotMatch(publisher[1], /knowledge\.edit/);
});

test("SA1 maps current platform routes to explicit read permissions", () => {
  for (const pair of [
    ["/platform/registrations", "registrations.read"],
    ["/platform/company-discovery", "discovery.read"],
    ["/platform/company-claims", "claims.read"],
    ["/platform/knowledge", "knowledge.read_drafts"],
    ["/platform/people", "platform.staff.read"],
    ["/platform/audit", "platform.audit.read"],
  ]) {
    assert.match(contract, new RegExp(pair[0].replaceAll("/", "\\/")));
    assert.match(contract, new RegExp(pair[1].replaceAll(".", "\\.")));
  }
});

test("SA1 maps high-impact existing actions to dedicated capabilities", () => {
  for (const permission of [
    "registrations.approve",
    "registrations.activate",
    "registrations.bridge_network",
    "discovery.publish",
    "discovery.enrich",
    "claims.approve",
    "claims.revoke",
  ]) {
    assert.match(contract, new RegExp(permission.replaceAll(".", "\\.")));
  }
});

test("SA1 establishes database-authoritative, fail-closed enforcement", () => {
  assert.match(architecture, /The database is authoritative/);
  assert.match(architecture, /return 42501 for authorization failure/);
  assert.match(architecture, /platform authorization must fail closed for unknown permission keys/);
  assert.match(architecture, /staff cannot self-elevate/);
});

test("SA1 forbids arbitrary per-user permission overrides in v1", () => {
  assert.match(architecture, /No custom per-user overrides in v1/);
  assert.match(architecture, /effective permissions = union\(role template permissions\)/);
});

test("SA1 leaves runtime authorization unchanged until SA2", () => {
  assert.match(architecture, /does \*\*not\*\* yet change production authorization behavior/);
  assert.match(architecture, /The existing platform_user_roles remains the root bootstrap/);
});
