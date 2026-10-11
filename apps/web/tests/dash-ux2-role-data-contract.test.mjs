import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (relative) => readFileSync(new URL(relative, import.meta.url), "utf8");
const dashboard = read("../app/(workspace)/dashboard/page.tsx");
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
  for (const name of ["Cerca nello storico", "Crea distinta", "Apri RFQ Hub", "Trova azienda", "Steel Pulse", "Cosa richiede attenzione"]) {
    assert.ok(dashboard.includes(name), name);
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
