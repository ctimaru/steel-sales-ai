import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const read = (file) => readFileSync(new URL(file, import.meta.url), "utf8");
const model = read("../lib/dashboard-discovery.ts");
const panel = read("../components/dashboard-discovery-feed.tsx");
const dashboard = read("../app/(workspace)/dashboard/page.tsx");
const marketplaceModule = read("../lib/marketplace.ts");

const exports = {};
vm.runInNewContext(ts.transpileModule(model, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { exports, Math, Date, Number, Array, Object });
const { selectDashboardFollowedUpdates, selectDashboardOpportunities } = exports;
const own = { product_interests: ["round_tubes"], territory_interests: ["italy"] };
const uuid = (suffix) => "00000000-0000-4000-8000-" + suffix.toString(16).padStart(12, "0");
const teaser = (n, overrides = {}) => ({
  request_id: uuid(n),
  visibility_mode: "anonymous",
  effective_status: "open",
  buyer: { visibility_mode: "anonymous" },
  line_count: 1,
  teaser_lines: [{ product_family_key: "tube", product_family_name: "Tubi tondi", quantity_band: "1–5 t", delivery_country_code: "IT", delivery_region: "Veneto", manufacturing_process: "welded" }],
  ...overrides,
});

test("DASH-FEED5 displays only open and permitted P5.2 teaser information", () => {
  const items = [
    teaser(1),
    teaser(2, { effective_status: "withdrawn" }),
    teaser(3, { effective_status: "closed" }),
    teaser(4, { buyer: { visibility_mode: "named", display_name: "LEAK" } }),
    teaser(5, { visibility_mode: "named", buyer: { visibility_mode: "named", display_name: "Supplier B" } }),
    teaser(6, { teaser_lines: [] }),
  ];
  const result = Array.from(selectDashboardOpportunities(items, own, 10));
  assert.deepEqual(result.map((x) => x.id), [uuid(1), uuid(5)]);
  assert.equal(result[0].anonymousBuyer, true);
  assert.equal(result[1].anonymousBuyer, false);
  for (const x of result) {
    assert.ok(!("buyer" in x), "Never pass full buyer payload to dashboard");
    assert.ok(!("notes" in x), "No RFQ detail notes");
    assert.ok(!("quantity_band" in x), "No quantity outside governed teaser card scope");
  }
  assert.doesNotMatch(panel, /buyer\.display_name|supplier\.display_name|unit_price|offered_quantity|request\.organization_id/);
});

test("DASH-FEED5 ranks product and delivery affinities but keeps broad matches", () => {
  const generic = teaser(7, { teaser_lines: [{ product_family_key: "plate", product_family_name: "Lamiera", delivery_country_code: "US" }] });
  const match = teaser(8);
  const result = Array.from(selectDashboardOpportunities([generic,match], own));
  assert.deepEqual(result.map((x) => x.id), [uuid(8),uuid(7)]);
  assert.equal(result[0].reason, "Prodotto e territorio di interesse");
  assert.equal(result[1].reason, null);
});

test("DASH-FEED5 filters malformed Network records and projects summary only", () => {
  const row = {
    activity_event_id: uuid(11), network_company_id: uuid(12),
    company_name: "Tubi Europa", summary: "Nuovo catalogo pubblico",
    occurred_at: "2026-10-10T14:22:00Z", is_unread: true,
    payload: { secret: "DO_NOT_SHOW", private_inquiry: "DO_NOT_SHOW" },
  };
  const safe = Array.from(selectDashboardFollowedUpdates([
    row, { ...row, activity_event_id: "not-a-uuid" },
    { ...row, activity_event_id: uuid(13), occurred_at: "invalid" },
  ]));
  assert.equal(safe.length, 1);
  assert.equal(safe[0].companyId, uuid(12));
  assert.equal(safe[0].unread, true);
  assert.equal(JSON.stringify(safe).includes("DO_NOT_SHOW"), false);
});

test("DASH-FEED5 keeps org and entitlements at the data boundary", () => {
  assert.match(dashboard, /getWorkspaceContext/);
  assert.match(dashboard, /getNetworkAccessState\(context\.organizationId\)/);
  assert.match(dashboard, /networkEntitled\s*\?\s*getNetworkActivityFeed/);
  assert.match(dashboard, /getMarketplaceFeed\(context\.organizationId, \{ limit: 10, offset: 0 \}\)/);
  assert.match(marketplaceModule, /p5_2_marketplace_feed/);
  assert.match(panel, /networkEntitled \? selectDashboardFollowedUpdates\(activity\) : \[\]/);
  assert.match(panel, /marketplace\?\.contract === "P5\.2-feed-v1"/);
  assert.match(panel, /activity=\{activity\.items\}/);
});

test("DASH-FEED5 embeds the extra feed under Steel Pulse without altering actions or RFQ privacy", () => {
  const pulse = dashboard.indexOf("<DashboardSteelPulse state={pulse} />");
  const discovery = dashboard.indexOf("<DashboardDiscoveryFeed");
  assert.ok(pulse > 0 && discovery > pulse);
  assert.match(panel, /appRoutes\.marketplace\.opportunity\(item\.id\)/);
  assert.match(panel, /appRoutes\.network\.company\(item\.companyId\)/);
  assert.match(panel, /Le RFQ private e i dettagli riservati non compaiono/);
  assert.match(panel, /Il Marketplace non è disponibile/);
  assert.doesNotMatch(model + panel, /rfqh10_|getMyMarketplaceRequests|getMarketplaceUnlockedDetail|p5_1_my_request\b|service_role|inquiry\.body/);
});

test("DASH-FEED5 requires verified role for Network and caps cards", () => {
  const plenty = Array.from({ length: 12 }, (_,i) => teaser(i+101));
  assert.equal(selectDashboardOpportunities(plenty, own).length, 3);
  assert.equal(selectDashboardOpportunities(plenty, own, 100).length, 6);
  const updates = Array.from({length:12},(_,i) => ({
    activity_event_id:uuid(i+401), network_company_id:uuid(i+500),
    company_name:"Company",summary:"Updated",occurred_at:"2026-10-12T10:00:00Z",is_unread:false,
  }));
  assert.equal(selectDashboardFollowedUpdates(updates).length,3);
  assert.equal(selectDashboardFollowedUpdates(updates, 50).length,6);
  assert.match(panel, /networkEnabled && networkEntitled/);
});
