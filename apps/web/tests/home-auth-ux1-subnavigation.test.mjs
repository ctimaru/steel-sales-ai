import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const home = read("../app/(italian)/(workspace)/dashboard/page.tsx");
const navigation = read("../components/workspace-home-panels.tsx");

test("HOME-AUTH-UX1 local navigation focuses the Home without replacing the global shell", () => {
  for (const label of ["Panoramica", "Da fare", "Attività", "Opportunità", "Steel Pulse"]) {
    assert.ok(navigation.includes('label: "' + label + '"'));
  }
  assert.match(navigation, /lg:grid-cols-\[200px_minmax\(0,1fr\)\]/);
  assert.match(navigation, /aria-pressed=\{selected\}/);
  assert.match(navigation, /hidden=\{active !== view\.id\}/);
  assert.match(navigation, /lg:hidden/);
  assert.match(navigation, /hashchange/);
  assert.match(home, /WorkspaceHomePanels/);
});

test("HOME-AUTH-UX1 routes to actual assistant and existing commercial tools", () => {
  assert.match(home, /href=\{appRoutes\.commercial\.assistant\}/);
  assert.match(home, /href=\{appRoutes\.commercial\.search\}/);
  assert.match(home, /orderedQuickActions\.map/);
  assert.match(home, /href: "\/distinta"/);
  assert.doesNotMatch(navigation, /fetch\(|supabase|service_role|sendEmail/);
});

test("HOME-AUTH-UX1 keeps all permission boundaries at the server and honest KPI/status data", () => {
  assert.match(home, /getWorkspaceContext\(\)/);
  assert.match(home, /getNetworkAccessState\(context\.organizationId\)/);
  assert.match(home, /networkEntitled\s*\?\s*getNetworkActivityFeed/);
  assert.match(home, /getMarketplaceFeed\(context\.organizationId/);
  assert.match(home, /canWriteWorkspace\(context\.role\)/);
  assert.match(home, /mode === "live" && operationalKpis.length > 0/);
  assert.match(home, /Nessun dato dimostrativo viene mostrato come reale/);
  assert.match(home, /activity=\{activity\.items\}/);
});
