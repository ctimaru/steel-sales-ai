import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const homeFeedViewerSource = readFileSync(new URL("../lib/home-feed-viewer.ts", import.meta.url), "utf8");
const homeFeedSource = readFileSync(new URL("../lib/home-feed.ts", import.meta.url), "utf8"); // HOME-FEED1 (founder decision, 4 Nov 2026): Home is a three-column feed; superseded layout checks rewritten.

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const home = read("../app/(italian)/(workspace)/dashboard/page.tsx");
const radar = read("../components/dashboard-discovery-feed.tsx");
const selectors = read("../lib/dashboard-discovery.ts");

test("NEXT1C.1 discovery is visible before redundant tiles and the news feed", () => {
  // HOME-FEED1 (founder decision, 4 Nov 2026): Home is a three-column feed; superseded layout checks rewritten.
  assert.equal(home.split("<HomeFeed ").length - 1, 1, "exactly one feed");
  assert.doesNotMatch(home, /<DashboardDiscoveryFeed|aria-label="Aree di lavoro"|<DashboardSteelPulse/);
  assert.match(radar, /data-testid="dashboard-opportunity-radar"/);
  assert.doesNotMatch(radar, /min-h-\[146px\]/);
});

test("NEXT1C.1 keeps Network data entitlement-bound, never reveals private signals", () => {
  assert.doesNotMatch(home, /getNetworkActivityFeed/);
  assert.doesNotMatch(radar, /selectDashboardFollowedUpdates/); // NET-UX LOT1: followed-company updates removed (Connetti only)
  assert.match(radar, /networkEntitled \? appRoutes\.network\.connections : appRoutes\.network\.directory/);
  assert.doesNotMatch(radar, /Nessun nuovo aggiornamento|aziende seguite/);
  assert.match(radar, /engagementKind="network_profile"/);
  assert.match(radar, /href=\{appRoutes\.network\.company\(company\.id\)\}/);
  assert.match(radar, /Le RFQ private e i dettagli riservati non compaiono/);
});

test("NEXT1C.1 marketplace shows exactly public P5.2 teasers and verifiable destinations", () => {
  assert.match(homeFeedSource, /getMarketplaceFeed\(viewer\.organizationId/);
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
