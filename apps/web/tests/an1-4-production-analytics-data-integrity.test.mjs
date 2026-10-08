import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const serviceSource = fs.readFileSync(
  new URL("../lib/platform-product-analytics.ts", import.meta.url),
  "utf8",
);
const dashboardSource = fs.readFileSync(
  new URL("../components/product-analytics-dashboard.tsx", import.meta.url),
  "utf8",
);

const compiledService = ts.transpileModule(serviceSource, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;

async function loadSnapshot({
  pageviews = 0,
  visitors = 0,
  events = 0,
  eventVisitors = 0,
  trend = [],
  eventRows = [],
  missingCounts = false,
} = {}) {
  const exports = {};
  const context = {
    exports,
    process: {
      env: {
        VERCEL_ANALYTICS_TOKEN: "fixture-only",
        VERCEL_ANALYTICS_PROJECT_ID: "prj_fixture",
        VERCEL_ANALYTICS_TEAM_ID: "team_fixture",
      },
    },
    URLSearchParams,
    URL,
    AbortSignal,
    fetch: async (requestUrl) => {
      const url = new URL(requestUrl);
      const endpoint = url.pathname.split("/web-analytics/")[1];
      const by = url.searchParams.get("by");
      let data;
      if (endpoint === "visits/count") {
        data = missingCounts ? {} : { pageviews, visitors };
      } else if (endpoint === "events/count") {
        data = missingCounts ? {} : { count: events, visitors: eventVisitors };
      } else if (endpoint === "visits/aggregate" && by === "hour") {
        data = trend;
      } else if (endpoint === "visits/aggregate" && by === "requestPath") {
        data = trend.length
          ? [{ requestPath: "/", pageviews: trend.reduce((sum, row) => sum + row.pageviews, 0), visitors: 4 }]
          : [];
      } else if (endpoint === "visits/aggregate" && by === "country") {
        data = trend.length ? [{ country: "IT", pageviews: 9, visitors: 4 }] : [];
      } else if (endpoint === "visits/aggregate" && by === "referrerHostname") {
        data = [];
      } else if (endpoint === "events/aggregate" && by === "eventName") {
        data = eventRows;
      } else {
        throw new Error("Unexpected analytics fixture request: " + requestUrl);
      }
      return { ok: true, json: async () => ({ data }) };
    },
  };
  vm.runInNewContext(compiledService, context, { filename: "platform-product-analytics.js" });
  return exports.getPlatformAnalyticsSnapshot("1d");
}

const realTrafficFixture = [
  { timestamp: "2026-10-08T10:00:00.000Z", pageviews: 7, visitors: 4 },
  { timestamp: "2026-10-08T11:00:00.000Z", pageviews: 2, visitors: 2 },
];

test("AN1.4 does not show zero total or false missing-collector warning when buckets contain traffic", async () => {
  const snapshot = await loadSnapshot({ trend: realTrafficFixture });
  assert.equal(snapshot.ingestion.state, "partial_data");
  assert.equal(snapshot.totals.pageviews, 9);
  assert.equal(snapshot.totals.visitors, null);
  assert.ok(snapshot.topPages.length > 0);
  assert.equal(snapshot.totals.eventVisitors, 0);
});

test("AN1.4 trusts consistent count data and never sums unique visitors across time buckets", async () => {
  const snapshot = await loadSnapshot({ pageviews: 9, visitors: 5, trend: realTrafficFixture });
  assert.equal(snapshot.ingestion.state, "receiving");
  assert.equal(snapshot.totals.pageviews, 9);
  assert.equal(snapshot.totals.visitors, 5);
});

test("AN1.4 maintains a true awaiting-data state when all endpoints show zero", async () => {
  const snapshot = await loadSnapshot();
  assert.equal(snapshot.ingestion.state, "awaiting_data");
  assert.equal(snapshot.totals.pageviews, 0);
  assert.equal(snapshot.totals.visitors, 0);
});

test("AN1.4 treats unavailable count payloads as unavailable, not zero", async () => {
  const snapshot = await loadSnapshot({ missingCounts: true });
  assert.equal(snapshot.ingestion.state, "partial_data");
  assert.equal(snapshot.totals.pageviews, null);
  assert.equal(snapshot.totals.visitors, null);
  assert.equal(snapshot.totals.events, null);
  assert.equal(snapshot.totals.eventVisitors, null);
});

test("AN1.4 derives additive event totals when event aggregation contradicts count", async () => {
  const snapshot = await loadSnapshot({
    eventRows: [{ eventName: "company_search", count: 3, visitors: 2 }],
  });
  assert.equal(snapshot.ingestion.state, "partial_data");
  assert.equal(snapshot.totals.events, 3);
  assert.equal(snapshot.totals.eventVisitors, null);
  assert.equal(snapshot.acquisitionFunnel[0].value, 3);
});

test("AN1.4 shows partial-data warnings, null KPI placeholders and honest funnel semantics", () => {
  assert.match(dashboardSource, /snapshot\.ingestion\.state === "partial_data"/);
  assert.match(dashboardSource, /value == null \? "—"/);
  assert.match(dashboardSource, /non sono conversioni di utenti unici/);
  assert.match(serviceSource, /unique visitors are NOT/);
});
