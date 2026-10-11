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

test("DASH-UX3.2 reuses the fetched operational snapshot for compact KPI cards", () => {
  assert.match(home, /const \{ metrics, recent, mode, operational \} = commercial/);
  assert.match(home, /operational\.rfqs/);
  assert.match(home, /operational\.offers/);
  assert.match(home, /operational\.orders/);
  assert.match(home, /mode === "live" \? \[/);
  assert.match(home, /grid grid-cols-3 gap-2 sm:gap-3/);
});

test("DASH-UX3.2 recent RFQ deep link is gated by live data and write capability", () => {
  assert.match(home, /recentRfq && canWrite/);
  assert.match(home, /recentRfq\.operationalHref!/);
  assert.match(home, /Stato e scadenze nel dettaglio/);
});

test("DASH-UX3.3 reads lifecycle from one governed procurement snapshot", () => {
  assert.match(home, /rfqh10_procurement_inbox/);
  assert.match(home, /p_limit: 5/);
  assert.match(home, /canWrite \? createClient/);
  assert.match(home, /procurementSummary\.active_rfqs/);
  assert.match(home, /procurementSummary\.attention_total/);
  assert.match(home, /procurementSummary\.urgent/);
  assert.match(home, /procurementActions/);
  assert.match(home, /appRoutes\.rfqHub\.campaign/);
  assert.match(home, /procurement\.error/);
});

test("DASH-UX3.4 prioritizes buyer actions only by order and preserves permitted cards", () => {
  assert.match(home, /presentation\.audience === "demand"/);
  assert.match(home, /\.\.\.\(prioritizeProcurement \? procurementPriorityCards : \[\]\)/);
  assert.match(home, /\.\.\.\(!prioritizeProcurement \? procurementPriorityCards : \[\]\)/);
  assert.match(home, /getNetworkAccessState/);
  assert.match(home, /canWriteWorkspace/);
});

test("DASH-UX3.4 maintains mobile two-column actions, compact KPI grid and focus styles", () => {
  assert.match(home, /grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4/);
  assert.match(home, /grid grid-cols-3 gap-2 sm:gap-3/);
  assert.match(home, /focus-visible:outline/);
});

test("DASH-UX3 acceptance: viewer never receives buyer inbox queries or write links", () => {
  assert.match(home, /const canWrite = canWriteWorkspace\(context\.role\)/);
  assert.match(home, /canWrite \? createClient\(\)\.then/);
  assert.match(home, /recentRfq && canWrite/);
  assert.match(home, /canWrite\s*\? \{/);
});

test("DASH-UX3 acceptance: responsive hierarchy and data unavailable states remain accessible", () => {
  assert.match(home, /aria-labelledby="quick-actions"/);
  assert.match(home, /aria-labelledby="daily-priorities"/);
  assert.match(home, /aria-labelledby="recent-activity"/);
  assert.match(home, /aria-label="RFQ lifecycle"/);
  assert.match(home, /aria-label="Indicatori commerciali"/);
  assert.match(home, /mode === "awaiting_assignment"/);
  assert.match(home, /sm:grid-cols-2 lg:grid-cols-3/);
});
