import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");
const workspaces = [
  ["registrations", "registrations.read"],
  ["company-discovery", "discovery.read"],
  ["company-claims", "claims.read"],
  ["network-trust", "network_trust.read"],
  ["knowledge", "knowledge.read_drafts"],
];
test("PLR4.5 delegated staff navigation is explicitly permission-scoped", () => {
  const nav = read("components/governance-workspace-nav.tsx");
  assert.match(nav, /GOVERNANCE_WORKSPACES\.filter\(\(item\) => permissions\.includes\(item\.permission\)\)/);
  assert.match(nav, /if \(!selected\) return null/);
  for (const [section, permission] of workspaces) {
    assert.ok(nav.includes('permission: "' + permission + '"'));
    const page = read("app/(platform)/platform/" + section + "/page.tsx");
    assert.ok(page.includes('requirePlatformPermission("' + permission + '")'));
    assert.match(page, /GovernanceWorkspaceNav/);
    assert.match(page, /GovernanceQueueControls/);
  }
});
test("PLR4.5 owner-only staff administration cannot be delegated via role mapping", () => {
  const ia = read("lib/platform-ia-contract.ts");
  const migration = read("../../../supabase/migrations/20260928162000_sa2_platform_rbac_foundation.sql");
  assert.match(ia, /key: "people"[\s\S]*?access: \{ kind: "owner_only" \}/);
  assert.match(migration, /sa2_reject_root_only_role_permission/);
});
test("PLR4.5 discovery mutations continue to require distinct server capabilities", () => {
  const actions = read("app/(platform)/platform/company-discovery/actions.ts");
  for (const key of ["discovery.run", "discovery.review", "discovery.publish", "discovery.enrich", "discovery.close_duplicates"])
    assert.ok(actions.includes('requirePlatformPermission("' + key + '")'));
});
