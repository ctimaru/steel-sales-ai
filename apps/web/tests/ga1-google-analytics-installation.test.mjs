import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const layout = fs.readFileSync(
  new URL("../app/layout.tsx", import.meta.url),
  "utf8",
);
const consent = fs.readFileSync(
  new URL("../components/google-analytics-consent.tsx", import.meta.url),
  "utf8",
);
const envExample = fs.readFileSync(
  new URL("../.env.example", import.meta.url),
  "utf8",
);

test("GA1 keeps the production GA4 measurement ID configured", () => {
  assert.match(layout, /G-F5QWLD98HD/);
  assert.match(envExample, /NEXT_PUBLIC_GOOGLE_ANALYTICS_ID=G-F5QWLD98HD/);
});

test("GA1 keeps the Google Analytics tag wired on measured public surfaces", () => {
  assert.match(consent, /googletagmanager\.com\/gtag\/js\?id=/);
  assert.match(consent, /isPublicMeasurementPath/);
  assert.match(consent, /ad_storage: "denied"/);
});
