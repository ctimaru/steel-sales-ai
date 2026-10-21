import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const home = read("../app/(italian)/(workspace)/dashboard/page.tsx");
const radar = read("../components/dashboard-discovery-feed.tsx");
const selectors = read("../lib/dashboard-discovery.ts");

test("NEXT1C.1 discovery is visible before redundant tiles and the news feed", () => {
  const start = home.indexOf('<DashboardDiscoveryFeed');
  const workAreas = home.indexOf('<section aria-label="Aree di lavoro"');
  const news = home.indexOf('<DashboardSteelPulse state={pulse} />');
  assert.ok(start > 0 && workAreas > start && news > start,
    "Actionable discovery must precede lower-value navigation and news");
  assert.equal(home.split('<DashboardDiscoveryFeed').length - 1, 1);
  assert.match(radar, /data-testid="dashboard-opportunity-radar"/);
  assert.match(radar, /md:grid-cols-2/);
  assert.match(radar, /text-xs/);
  assert.doesNotMatch(radar, /min-h-\[146px\]/);
});

test("NEXT1C.1 keeps Network data entitlement-bound, never reveals private signals", () => {
  assert.match(home, /networkEntitled\s*\?\s*getNetworkActivityFeed/);
  assert.match(radar, /networkEnabled && networkEntitled\s*\? selectDashboardFollowedUpdates\(activity, 2\)/);
  assert.match(radar, /networkEntitled\s*\? appRoutes\.network\.activity : appRoutes\.network\.directory/);
  assert.match(radar, /networkEntitled\s*\? "Nessun nuovo aggiornamento/);
  assert.match(radar, /engagementKind="network_profile"/);
  assert.match(radar, /href=\{appRoutes\.network\.company\(item\.companyId\)\}/);
  assert.match(radar, /Le RFQ private e i dettagli riservati non compaiono/);
});

test("NEXT1C.1 marketplace shows exactly public P5.2 teasers and verifiable destinations", () => {
  assert.match(home, /getMarketplaceFeed\(context\.organizationId, \{ limit: 10, offset: 0 \}\)/);
  assert.match(radar, /marketplace\?\.contract === "P5\.2-feed-v1"/);
  assert.match(radar, /selectDashboardOpportunities\(marketplace\.items, interests, 2\)/);
  assert.match(radar, /engagementKind="marketplace_teaser"/);
  assert.match(radar, /appRoutes\.marketplace\.opportunity\(item\.id\)/);
  assert.match(radar, /Interessi dichiarati:/);
  assert.match(radar, /Nessuna opportunità pubblicabile e visibile al momento/);
  assert.match(selectors, /item\.visibility_mode === "anonymous" \|\| item\.visibility_mode === "named"/);
  assert.match(selectors, /item\.buyer\?\.visibility_mode === item\.visibility_mode/);
  assert.match(selectors, /item\.effective_status === "open"/);
  assert.doesNotMatch(radar, /buyer_rfq_campaigns|buyer_rfq_suppliers|contact_email|unit_price/);
});

test("NEXT1C.1 uses no new network fetch or feature entitlement shortcuts", () => {
  assert.doesNotMatch(radar, /createClient\(|\.rpc\(|fetch\(|useEffect\(/);
  assert.doesNotMatch(radar, /AI-generated|Generato dall.AI|Super Intelligence ha trovato/);
  assert.match(radar, /min-h-10/);
  assert.match(radar, /focus-visible:outline-2/);
  assert.match(radar, /role="status"/);
});
