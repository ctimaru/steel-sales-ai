import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const packageJson = fs.readFileSync(new URL("../package.json", import.meta.url), "utf8");
const packageLock = fs.readFileSync(new URL("../package-lock.json", import.meta.url), "utf8");
const layout = fs.readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");
const ingestion = fs.readFileSync(
  new URL("../components/product-analytics-ingestion.tsx", import.meta.url),
  "utf8",
);
const clientEvents = fs.readFileSync(
  new URL("../lib/product-analytics-events.client.ts", import.meta.url),
  "utf8",
);
const serverEvents = fs.readFileSync(
  new URL("../lib/product-analytics-events.server.ts", import.meta.url),
  "utf8",
);
const lookup = fs.readFileSync(
  new URL("../components/public-company-lookup.tsx", import.meta.url),
  "utf8",
);
const loginActions = fs.readFileSync(
  new URL("../app/login/actions.ts", import.meta.url),
  "utf8",
);
const registrationActions = fs.readFileSync(
  new URL("../app/register/actions.ts", import.meta.url),
  "utf8",
);
const calculator = fs.readFileSync(
  new URL("../components/public-tube-weight-calculator.tsx", import.meta.url),
  "utf8",
);
const distintaActions = fs.readFileSync(
  new URL("../app/(public)/distinta/actions.ts", import.meta.url),
  "utf8",
);
const rfqActions = fs.readFileSync(
  new URL("../app/(workspace)/marketplace/rfq-hub/actions.ts", import.meta.url),
  "utf8",
);
const analyticsService = fs.readFileSync(
  new URL("../lib/platform-product-analytics.ts", import.meta.url),
  "utf8",
);
const dashboard = fs.readFileSync(
  new URL("../components/product-analytics-dashboard.tsx", import.meta.url),
  "utf8",
);

test("AN1.2 installs and mounts Vercel Web Analytics 2.x", () => {
  assert.match(packageJson, /"@vercel\/analytics": "2\.0\.1"/);
  assert.match(packageLock, /"node_modules\/@vercel\/analytics"/);
  assert.match(layout, /ProductAnalyticsIngestion/);
  assert.match(ingestion, /Analytics.*@vercel\/analytics\/next/s);
});

test("AN1.2 only emits pageviews for allowlisted public surfaces and redacts dynamic identifiers", () => {
  for (const path of ["/knowledge", "/azienda", "/register", "/login", "/distinta", "/rfq/respond"]) {
    assert.ok(ingestion.includes(`"${path}"`), `missing public path ${path}`);
  }
  assert.match(ingestion, /return null/);
  assert.match(ingestion, /url\.search = ""/);
  assert.match(ingestion, /url\.hash = ""/);
  assert.match(ingestion, /return ":id"/);
});

test("AN1.2 wires the acquisition funnel with non-PII event names", () => {
  assert.match(clientEvents, /company_search/);
  assert.match(clientEvents, /company_claim_start/);
  assert.match(serverEvents, /registration_account_created/);
  assert.match(serverEvents, /registration_submit/);
  assert.match(lookup, /trackProductEvent\("company_search"/);
  assert.match(lookup, /trackProductEvent\("company_claim_start"/);
  assert.match(loginActions, /trackServerProductEvent\("registration_account_created"/);
  assert.match(registrationActions, /trackServerProductEvent\("registration_submit"/);
});

test("AN1.2 wires the activation funnel on successful product actions", () => {
  for (const eventName of ["distinta_save", "rfq_start", "rfq_dispatch_launch"]) {
    assert.ok(serverEvents.includes(eventName), `missing server event ${eventName}`);
  }
  assert.match(calculator, /trackProductEvent\("weight_calculation"/);
  assert.match(calculator, /onChangeCapture/);
  assert.match(distintaActions, /trackServerProductEvent\("distinta_save"/);
  assert.match(distintaActions, /trackServerProductEvent\("rfq_start"/);
  assert.match(rfqActions, /trackServerProductEvent\("rfq_dispatch_launch"/);
  assert.match(rfqActions, /if \(sentCount > 0\)/);
});

test("AN1.2 analytics failures never block canonical product actions", () => {
  assert.match(serverEvents, /try \{/);
  assert.match(serverEvents, /catch \(error\)/);
  assert.match(clientEvents, /try \{/);
  assert.match(clientEvents, /catch \(error\)/);
});

test("AN1.2 dashboard distinguishes collector/API state from a real zero", () => {
  assert.match(analyticsService, /collector: "an1\.2"/);
  assert.match(analyticsService, /"receiving" \| "awaiting_data" \| "api_error" \| "token_missing"/);
  assert.match(dashboard, /Ingestion AN1\.2/);
  assert.match(dashboard, /Web Analytics API risponde correttamente/);
});
