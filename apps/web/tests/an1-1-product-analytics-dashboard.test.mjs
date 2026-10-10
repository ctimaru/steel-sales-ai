import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
const platformIa = fs.readFileSync(new URL("../lib/platform-ia-contract.ts", import.meta.url), "utf8");

const page = fs.readFileSync(
  new URL("../app/(platform)/platform/product-analytics/page.tsx", import.meta.url),
  "utf8",
);
const dashboard = fs.readFileSync(
  new URL("../components/product-analytics-dashboard.tsx", import.meta.url),
  "utf8",
);
const refresh = fs.readFileSync(
  new URL("../components/product-analytics-refresh.tsx", import.meta.url),
  "utf8",
);
const service = fs.readFileSync(
  new URL("../lib/platform-product-analytics.ts", import.meta.url),
  "utf8",
);
const routes = fs.readFileSync(new URL("../lib/routes.ts", import.meta.url), "utf8");
const navigation = fs.readFileSync(
  new URL("../components/platform-navigation.tsx", import.meta.url),
  "utf8",
);

test("AN1.1 is owner-only and linked from Platform navigation", () => {
  assert.match(page, /requirePlatformSuperadmin/);
  assert.match(routes, /productAnalytics/);
  assert.match(platformIa, /label: "Product Analytics"/);
});

test("AN1.1 uses the Vercel Web Analytics API server-side", () => {
  assert.match(service, /web-analytics/);
  assert.match(service, /cache: "no-store"/);
});

test("AN1.1 exposes traffic and funnel views", () => {
  assert.match(dashboard, /Visitatori/);
  assert.match(dashboard, /Pageview/);
  assert.match(dashboard, /Acquisition/);
  assert.match(dashboard, /RFQ Hub/);
  assert.match(dashboard, /Pagine più viste/);
  assert.match(dashboard, /Referrer/);
  assert.match(dashboard, /Paesi/);
});

test("AN1.1 refreshes every 60 seconds", () => {
  assert.match(refresh, /REFRESH_SECONDS = 60/);
  assert.match(refresh, /Aggiorna ora/);
});

test("AN1.1 supports 24h, 7d and 30d windows", () => {
  assert.match(dashboard, /24h/);
  assert.match(dashboard, /7 giorni/);
  assert.match(dashboard, /30 giorni/);
});


test("AN1.1 selected range keeps hardened white-on-green contrast", () => {
  assert.match(dashboard, /platform-selected-solid/);
});
