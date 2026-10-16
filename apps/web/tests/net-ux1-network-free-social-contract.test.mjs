import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import ts from "typescript";

const source = fs.readFileSync(new URL("../lib/network-experience.ts", import.meta.url), "utf8");
const javascript = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const domain = await import("data:text/javascript;base64," + Buffer.from(javascript).toString("base64"));

test("NET-UX1 recommends counterparties without suppressing any company role", () => {
  assert.deepEqual(domain.recommendedNetworkRoles("end_user"), [
    "trader_distributor", "processor_service_provider", "producer", "end_user",
  ]);
  assert.deepEqual(domain.recommendedNetworkRoles("trader_distributor"), [
    "end_user", "processor_service_provider", "producer", "trader_distributor",
  ]);
  for (const role of domain.NETWORK_COMPANY_ROLES) {
    assert.deepEqual(new Set(domain.recommendedNetworkRoles(role)), new Set(domain.NETWORK_COMPANY_ROLES));
  }
});

test("NET-UX1 keeps explicit search relevance and stable multifaceted ordering", () => {
  const items = [
    { id: "manufacturer", roles: [{ key: "producer" }] },
    { id: "multirole", roles: [{ key: "producer" }, { key: "trader_distributor" }] },
    { id: "unknown", roles: [] },
    { id: "processor", roles: [{ key: "processor_service_provider" }] },
    { id: "merchant", roles: [{ key: "trader_distributor" }] },
  ];
  assert.deepEqual(domain.orderNetworkDiscovery(items, "end_user", false).map(({ id }) => id),
    ["multirole", "merchant", "processor", "manufacturer", "unknown"]);
  assert.deepEqual(domain.orderNetworkDiscovery(items, "end_user", true), items);
  assert.deepEqual(domain.orderNetworkDiscovery(items, null, false), items);
  assert.equal(domain.orderNetworkDiscovery(items, "end_user", false).length, items.length);
});

test("NET-UX1 Free discovery fails closed until backend verification is explicit", () => {
  const baseline = { authenticated: true, activeOrganization: true, networkProEntitled: false, freeReadBackendVerified: false };
  assert.equal(domain.resolveNetworkExperience(baseline).basicDirectory, false);
  assert.equal(domain.resolveNetworkExperience({ ...baseline, freeReadBackendVerified: true }).basicDirectory, true);
  assert.equal(domain.resolveNetworkExperience({ ...baseline, freeReadBackendVerified: true }).advancedTechnicalFilters, false);
  assert.equal(domain.resolveNetworkExperience({ ...baseline, networkProEntitled: true }).advancedTechnicalFilters, true);
  for (const partial of [{ authenticated: false }, { activeOrganization: false }]) {
    const entitlements = domain.resolveNetworkExperience({ ...baseline, ...partial, freeReadBackendVerified: true, networkProEntitled: true });
    assert.equal(entitlements.basicDirectory, false);
    assert.equal(entitlements.basicCompanyProfiles, false);
    assert.equal(entitlements.intelligence, false);
  }
  assert.equal(domain.resolveNetworkExperience({ ...baseline, freeReadBackendVerified: true }).connectionRequests, false);
});

test("NET-UX1 denies self-connections, inactive companies, blocked and duplicate requests", () => {
  const ready = {
    sourceOrganizationActive: true,
    sourceCanManageConnections: true,
    sourceNetworkCompanyId: "a",
    targetNetworkCompanyId: "b",
    targetPublished: true,
    targetOrganizationActiveAndLinked: true,
    relation: "none",
  };
  assert.deepEqual(domain.connectionRequestEligibility(ready), { allowed: true, reason: "ready" });
  assert.equal(domain.connectionRequestEligibility({ ...ready, targetOrganizationActiveAndLinked: false }).reason, "target_unavailable");
  assert.equal(domain.connectionRequestEligibility({ ...ready, targetNetworkCompanyId: "a" }).reason, "self_connection");
  assert.equal(domain.connectionRequestEligibility({ ...ready, sourceCanManageConnections: false }).reason, "source_not_ready");
  for (const relation of ["connected", "outgoing_pending", "incoming_pending", "declined", "blocked"]) {
    assert.equal(domain.connectionRequestEligibility({ ...ready, relation }).allowed, false);
  }
});

test("NET-UX1 never replaces existing PA1.3 enforcement in production", () => {
  const page = fs.readFileSync(new URL("../app/(workspace)/network/page.tsx", import.meta.url), "utf8");
  const access = fs.readFileSync(new URL("../lib/network-access.ts", import.meta.url), "utf8");
  assert.match(page, /if \(!access\.can_access_network\)/);
  assert.match(access, /pa1_3_network_access_state/);
  assert.match(source, /freeReadBackendVerified/);
  assert.doesNotMatch(source, /from "next\/navigation"/);
});
