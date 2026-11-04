import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const home = fs.readFileSync(new URL("../app/(workspace)/dashboard/page.tsx", import.meta.url), "utf8");
const pulse = fs.readFileSync(new URL("../components/dashboard-steel-pulse.tsx", import.meta.url), "utf8");

test("DASH-FEED2 keeps compact shortcuts above personalized news", () => {
  // HOME-FEED1 (founder decision, 4 Nov 2026): Home is a three-column feed; superseded layout checks rewritten.
  const left = home.indexOf('data-testid="home-left-rail"');
  const recent = home.indexOf('<section aria-labelledby="recent-activity"');
  const feed = home.indexOf("<HomeFeed ");
  assert.ok(left > 0 && recent > left && feed > recent);
});

test("DASH-FEED2 attention contains only actionable work and disappears when empty", () => {
  // HOME-FOCUS1 (founder decision, 4 Nov 2026): the Home RFQ box and the "Cosa richiede attenzione" strip were removed; superseded checks rewritten.
  assert.doesNotMatch(home, /attentionCount|Cosa richiede attenzione/);
  assert.doesNotMatch(home, /metrics\.reviewFlags > 0|href: appRoutes\.operations\.review/);
  assert.doesNotMatch(home, /recentRfq && canWrite/);
  assert.doesNotMatch(home, /title: "Aggiornamenti Network"/);
});

test("DASH-FEED2 retains viewer isolation and approved Network entitlement", () => {
  for (const pattern of [
    /getWorkspaceContext/, /getNetworkAccessState/, /canWriteWorkspace\(context\.role\)/,
    /canWrite \? createClient\(\)\.then/,
  ]) assert.match(home, pattern);
});

test("DASH-FEED2 puts existing KPIs in a subordinate Workspace sidebar", () => {
  assert.match(home, /const \{ recent, mode, operational \} = commercial/);
  assert.match(home, /operational\.rfqs/);
  assert.match(home, /operational\.offers/);
  assert.match(home, /operational\.orders/);
  assert.match(home, /aria-label="RFQ lifecycle"/);
  assert.match(home, /lg:grid-cols-\[260px_minmax\(0,1fr\)\] xl:grid-cols-\[260px_minmax\(0,1fr\)_280px\]/);
});

test("DASH-FEED2 retains governed procurement and deep links", () => {
  for (const pattern of [
    /rfqh10_procurement_inbox/,
    /p_limit: 5/,
    /procurementSummary\.attention_total/,
    /procurementSummary\.active_rfqs/,
    /procurementSummary\.urgent/,
    // HOME-FOCUS1: per-RFQ deep links moved to Commerciale with the attention strip.
    /appRoutes\.commercial\.home \+ "\?view=sent#commercial-worklist"/,
    /procurement\.error/,
  ]) assert.match(home, pattern);
});

test("DASH-FEED2 retains company onboarding without overwhelming Home", () => {
  assert.match(home, /isAdmin\s*\? getCompanySetupState\(context\.organizationId\)/);
  assert.match(home, /<WorkspaceFirstRunChecklist state=\{firstRun\} companyNameHint=\{companyNameHint\} compact \/>/);
});

test("DASH-FEED2-3 does not fabricate commercial metrics or news during outages", () => {
  assert.match(home, /mode === "awaiting_assignment"/);
  assert.match(home, /Nessun dato dimostrativo viene mostrato come reale/);
  assert.match(pulse, /Nessuna notizia verificata per ora/);
  assert.match(pulse, /Steel Pulse temporaneamente non disponibile/);
});

test("DASH-FEED3 keeps a link to personal feed settings and safely attributed sources", () => {
  assert.match(pulse, /Personalizza il feed/);
  assert.match(pulse, /href=\{appRoutes\.steelPulse\}/);
  assert.match(pulse, /rel="noopener noreferrer"/);
  assert.match(pulse, /Perché ti interessa/);
  assert.match(pulse, /source_published_at/);
  assert.doesNotMatch(pulse, /dangerouslySetInnerHTML/);
});
