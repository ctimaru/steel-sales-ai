import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const layout = fs.readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");
const consent = fs.readFileSync(
  new URL("../components/google-analytics-consent.tsx", import.meta.url),
  "utf8",
);

test("GA4 loads one canonical Google tag in the root head for every route", () => {
  assert.equal((layout.match(/id="sss-google-analytics"/g) || []).length, 1);
  assert.match(layout, /requestedGoogleAnalyticsId === "G-F5QWLD98HD"/);
  assert.match(layout, /googletagmanager\.com\/gtag\/js\?id=/);
  assert.match(layout, /send_page_view: false/);
  assert.doesNotMatch(layout, /if \(!shouldMeasure\) return/);
});

test("GA4 limits custom page_view dispatch to approved public routes", () => {
  assert.match(consent, /if \(!measurementId \|\| !shouldMeasure \|\| !consentReady\) return/);
  assert.match(consent, /pathname\.startsWith\("\/distinta"\)/);
  assert.doesNotMatch(consent, /pathname\.startsWith\("\/platform"\)/);
  assert.doesNotMatch(consent, /pathname\.startsWith\("\/dashboard"\)/);
});

test("GA4 emits a consented page_view on first acceptance but not on denial", () => {
  assert.match(consent, /else if \(consent !== "granted" && shouldMeasure\)/);
  assert.match(consent, /analyticsWindow\.gtag\?\.\("consent", "update"/);
  assert.match(consent, /analyticsWindow\.gtag\?\.\("event", "page_view"/);
  assert.match(consent, /clearGoogleAnalyticsCookies\(\)/);
});
