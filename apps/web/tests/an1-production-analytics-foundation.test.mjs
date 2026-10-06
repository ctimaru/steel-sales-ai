import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const layout = fs.readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");
const packageJson = fs.readFileSync(new URL("../package.json", import.meta.url), "utf8");
const analytics = fs.readFileSync(new URL("../lib/product-analytics.ts", import.meta.url), "utf8");
const analyticsServer = fs.readFileSync(
  new URL("../lib/product-analytics-server.ts", import.meta.url),
  "utf8",
);
const companyLookup = fs.readFileSync(
  new URL("../components/public-company-lookup.tsx", import.meta.url),
  "utf8",
);
const calculator = fs.readFileSync(
  new URL("../components/public-tube-weight-calculator.tsx", import.meta.url),
  "utf8",
);
const registration = fs.readFileSync(
  new URL("../app/register/registration-form.tsx", import.meta.url),
  "utf8",
);
const authActions = fs.readFileSync(
  new URL("../app/login/actions.ts", import.meta.url),
  "utf8",
);
const distinta = fs.readFileSync(
  new URL("../components/buyer-distinta-builder.tsx", import.meta.url),
  "utf8",
);
const dispatch = fs.readFileSync(
  new URL("../components/rfq-dispatch-panel.tsx", import.meta.url),
  "utf8",
);

test("AN1 installs Vercel Web Analytics globally", () => {
  assert.match(packageJson, /"@vercel\/analytics": "2\.0\.1"/);
  assert.match(layout, /@vercel\/analytics\/next/);
  assert.match(layout, /<Analytics \/>/);
});

test("AN1 keeps telemetry best-effort so analytics cannot block product flows", () => {
  assert.match(analytics, /try \{/);
  assert.match(analytics, /catch \{/);
  assert.match(analyticsServer, /try \{/);
  assert.match(analyticsServer, /catch \{/);
});

test("AN1 tracks the public acquisition and registration funnel", () => {
  assert.match(companyLookup, /company_search/);
  assert.match(companyLookup, /company_claim_start/);
  assert.match(registration, /registration_submit/);
  assert.match(authActions, /registration_account_created/);
});

test("AN1 tracks useful product activation without sending commercial payloads", () => {
  assert.match(calculator, /weight_calculation/);
  assert.match(calculator, /weight_calculator_share/);
  assert.match(distinta, /distinta_copy/);
  assert.match(distinta, /distinta_save/);
  assert.match(distinta, /rfq_start/);
  assert.match(dispatch, /rfq_dispatch_launch/);
  assert.match(dispatch, /rfq_dispatch_retry/);
  assert.match(dispatch, /rfq_dispatch_reminder/);

  const telemetrySurface = [
    companyLookup,
    calculator,
    registration,
    authActions,
    distinta,
    dispatch,
  ]
    .flatMap((source) => source.match(/trackProductEvent(?:Server)?\([\s\S]{0,420}?\);/g) ?? [])
    .join("\n");

  assert.doesNotMatch(telemetrySurface, /legal_name|vat_id|emailSubject|emailMessage|recipientInput|buyerMessage|rfqId/);
});

test("AN1 event names remain stable for reporting", () => {
  for (const eventName of [
    "company_search",
    "company_claim_start",
    "registration_submit",
    "registration_account_created",
    "weight_calculation",
    "weight_calculator_share",
    "distinta_copy",
    "distinta_save",
    "rfq_start",
    "supplier_dispatch_complete",
    "rfq_dispatch_launch",
    "rfq_dispatch_retry",
    "rfq_dispatch_reminder",
  ]) {
    assert.match(
      companyLookup + calculator + registration + authActions + distinta + dispatch,
      new RegExp(eventName),
    );
  }
});
