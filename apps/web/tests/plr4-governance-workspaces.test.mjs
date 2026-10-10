import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");

test("PLR4: all governance workspaces use the same permission-scoped selector", () => {
  const component = read("components/governance-workspace-nav.tsx");
  const entries = [
    ["registrations", "registrations.read"],
    ["company-discovery", "discovery.read"],
    ["company-claims", "claims.read"],
    ["network-trust", "network_trust.read"],
    ["knowledge", "knowledge.read_drafts"],
  ];
  assert.match(component, /GOVERNANCE_WORKSPACES\.filter\(\(item\) => permissions\.includes\(item\.permission\)\)/);
  assert.match(component, /aria-current=\{item\.key === current \? "page"/);
  assert.match(component, /Torna al cockpit/);
  for (const [area, permission] of entries) {
    assert.ok(component.includes('permission: "' + permission + '"'));
    const page = read("app/(platform)/platform/" + area + "/page.tsx");
    assert.match(page, /GovernanceWorkspaceNav/);
    assert.match(page, /permissions=\{access\?\.permissions \?\? \[\]\}/);
    assert.ok(page.includes('requirePlatformPermission("' + permission + '")'));
  }
});

test("PLR4: governance switcher never grants additional platform permissions or executes mutations", () => {
  const component = read("components/governance-workspace-nav.tsx");
  assert.doesNotMatch(component, /\b(action|fetch|rpc|supabase|useEffect)\b/);
  assert.match(component, /aria-label="Aree di governance autorizzate"/);
  assert.equal((component.match(/href: "\/platform\//g) ?? []).length, 5);
});
