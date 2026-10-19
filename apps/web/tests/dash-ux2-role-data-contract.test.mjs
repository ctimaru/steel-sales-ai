import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (relative) => readFileSync(new URL(relative, import.meta.url), "utf8");
const dashboard = read("../app/(workspace)/dashboard/page.tsx");
const dashboardPulse = read("../components/dashboard-steel-pulse.tsx");
const data = read("../lib/commercial-data.ts");
const contract = read("../lib/dashboard-role-contract.ts");
const policy = read("../lib/access-policy.ts");

test("DASH-UX2 fails closed when live dashboard metrics are unavailable", () => {
  assert.match(data, /mode: "awaiting_assignment",\s*metrics: emptyDashboardMetrics,\s*recent: \[\]/);
  assert.match(data, /const emptyDashboardMetrics: typeof archiveMetrics/);
  assert.match(dashboard, /mode === "awaiting_assignment"/);
  assert.match(dashboard, /Nessun dato dimostrativo viene mostrato come reale/);
});

test("DASH-UX2 retains existing quick actions and operational surfaces", () => {
  for (const name of ["Cerca nello storico", "Crea distinta", "Gestisci richieste e offerte", "Trova azienda", "Steel Pulse", "Cosa richiede attenzione"]) {
    assert.ok((dashboard + dashboardPulse).includes(name), name);
  }
  assert.match(dashboard, /getNetworkAccessState/);
  assert.match(dashboard, /getWorkspaceContext/);
});

test("DASH-UX2 uses canonical permission policy and does not derive access from company sector", () => {
  assert.match(dashboard, /canWriteWorkspace\(context\.role\)/);
  assert.match(contract, /canWriteWorkspace\(role\)/);
  assert.match(contract, /export function normalizeCompanySector/);
  assert.match(contract, /return "unknown"/);
  assert.match(policy, /viewer: new Set\(\["commercial_read", "network_read"\]\)/);
});

const sectorSource = read("../lib/dashboard-company-sector.ts");

test("DASH-UX2.5 uses the existing governed organization-to-company link", () => {
  assert.match(sectorSource, /m8_my_network_company/);
  assert.match(sectorSource, /p3_7_managed_profile_state/);
  assert.match(sectorSource, /company\.organization_id !== organizationId/);
  assert.match(sectorSource, /primaries\.length !== 1/);
  assert.match(sectorSource, /return "unknown"/);
  for (const key of ["producer", "trader_distributor", "processor_service_provider", "end_user"]) {
    assert.ok(contract.includes(key), key);
  }
});

test("DASH-UX2.5 only changes shortcut ordering and retains all four destinations", () => {
  assert.match(dashboard, /getDashboardCompanySector\(context\.organizationId\)/);
  assert.match(dashboard, /orderedQuickActions\.map/);
  assert.match(dashboard, /networkEntitled \? getDashboardCompanySector/);
});

test("DASH-UX2 sector has no authorization authority", () => {
  assert.match(contract, /sector: CompanySector/);
  assert.match(contract, /canWrite: canWriteWorkspace\(role\)/);
  assert.doesNotMatch(contract, /sector\s*===\s*"utilizzatore"\s*\?\s*true/);
});
