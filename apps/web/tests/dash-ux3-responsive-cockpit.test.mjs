import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const home = fs.readFileSync(new URL("../app/(workspace)/dashboard/page.tsx", import.meta.url), "utf8");

test("DASH-UX3 prioritizes quick actions before secondary feeds", () => {
  const actions = home.indexOf('<section aria-labelledby="quick-actions">');
  const attention = home.indexOf('<section aria-labelledby="daily-priorities">');
  const recent = home.indexOf('<section aria-labelledby="recent-activity">');
  const pulse = home.indexOf('<section aria-label="Steel Pulse"');
  assert.ok(actions > 0 && attention > 0 && recent > 0 && pulse > 0);
  assert.ok(actions < attention && attention < recent && recent < pulse);
});

test("DASH-UX3 keeps mobile actions compact and visible", () => {
  assert.match(home, /grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4/);
  assert.match(home, /min-w-0 rounded-xl border p-3/);
  assert.match(home, /sm:block/);
});

test("DASH-UX3 preserves secure pathways and onboarding", () => {
  for (const fragment of [
    "getWorkspaceContext", "getNetworkAccessState", "getDashboardCompanySector",
    "canWriteWorkspace", "setupIncomplete", "Crea distinta", "Apri RFQ Hub",
    "Trova azienda", "Cosa richiede attenzione", "Ultimi movimenti commerciali",
    "Steel Pulse", "awaiting_assignment",
  ]) assert.ok(home.includes(fragment), fragment);
});
