import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const home = fs.readFileSync(new URL("../app/(workspace)/dashboard/page.tsx", import.meta.url), "utf8");
const pulse = fs.readFileSync(new URL("../components/dashboard-steel-pulse.tsx", import.meta.url), "utf8");

test("DASH-FEED2 keeps compact shortcuts above personalized news", () => {
  const actions = home.indexOf('<section aria-labelledby="quick-actions"');
  const news = home.indexOf('<DashboardSteelPulse state={pulse} />');
  const recent = home.indexOf('<section aria-labelledby="recent-activity"');
  assert.ok(actions > 0 && news > actions && recent > news);
  assert.match(home, /orderedQuickActions\.map/);
  assert.match(home, /min-h-10 max-w-full items-center gap-1\.5 rounded-full/);
});

test("DASH-FEED2 attention contains only actionable work and disappears when empty", () => {
  assert.match(home, /attentionCount > 0/);
  assert.match(home, /Cosa richiede attenzione/);
  assert.match(home, /procurementActions\.map/);
  assert.doesNotMatch(home, /metrics\.reviewFlags > 0|href: appRoutes\.operations\.review/);
  assert.doesNotMatch(home, /recentRfq && canWrite/);
  assert.doesNotMatch(home, /title: "Aggiornamenti Network"/);
  assert.match(home, /min-h-10 max-w-full flex-col gap-2 rounded-lg/);
});

test("DASH-FEED2 retains viewer isolation and approved Network entitlement", () => {
  for (const pattern of [
    /getWorkspaceContext/, /getNetworkAccessState/, /canWriteWorkspace\(context\.role\)/,
    /networkEntitled\s*\?\s*getNetworkActivityFeed/,
    /networkEntitled\s*\?\s*getNetworkInquiries/,
    /canWrite \? createClient\(\)\.then/,
    /getDashboardCompanySector\(context\.organizationId\)/,
  ]) assert.match(home, pattern);
});

test("DASH-FEED2 puts existing KPIs in a subordinate Workspace sidebar", () => {
  assert.match(home, /const \{ metrics, recent, mode, operational \} = commercial/);
  assert.match(home, /operational\.rfqs/);
  assert.match(home, /operational\.offers/);
  assert.match(home, /operational\.orders/);
  assert.match(home, /aria-label="RFQ lifecycle"/);
  assert.match(home, /aria-label="Indicatori commerciali"/);
  assert.match(home, /lg:grid-cols-\[minmax\(0,1\.85fr\)_minmax\(275px,0\.85fr\)\]/);
});

test("DASH-FEED2 retains governed procurement and deep links", () => {
  for (const pattern of [
    /rfqh10_procurement_inbox/,
    /p_limit: 5/,
    /procurementSummary\.attention_total/,
    /procurementSummary\.active_rfqs/,
    /procurementSummary\.urgent/,
    /item\.rfq_id!/,
    /appRoutes\.commercial\.home \+ "\?view=sent&item=campaign:"/,
    /procurement\.error/,
  ]) assert.match(home, pattern);
});

test("DASH-FEED2 retains company onboarding without overwhelming Home", () => {
  assert.match(home, /isAdmin\s*\? getCompanySetupState\(context\.organizationId\)/);
  assert.match(home, /setupIncomplete && setup && nextSetupAction/);
  assert.match(home, /Continua setup/);
  assert.match(home, /aria-label="Configurazione aziendale"/);
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
