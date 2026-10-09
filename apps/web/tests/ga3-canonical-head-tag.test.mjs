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

test("GA3 declares one idle-loaded Google tag in the root head", () => {
  const head = layout.indexOf("<head>");
  const tag = layout.indexOf('id="sss-google-analytics"');
  const body = layout.indexOf("<body>");
  assert.ok(head >= 0 && tag > head && body > tag);
  assert.match(layout, /strategy="lazyOnload"/);
  assert.match(layout, /googletagmanager\.com\/gtag\/js\?id=/);
  assert.match(layout, /G-F5QWLD98HD/);
});

test("GA3 initializes denied consent before the external Google tag", () => {
  const bootstrap = layout.indexOf('id="sss-google-consent-bootstrap"');
  const tag = layout.indexOf('id="sss-google-analytics"');
  assert.ok(bootstrap >= 0 && bootstrap < tag);
  assert.match(layout, /"consent", "default"/);
  assert.match(layout, /analytics_storage: "denied"/);
  assert.match(layout, /ad_storage: "denied"/);
  assert.match(layout, /ad_user_data: "denied"/);
  assert.match(layout, /ad_personalization: "denied"/);
});

test("GA3 configures the tag globally but never autotracks private routes", () => {
  assert.match(layout, /window.gtag\("config",/);
  assert.doesNotMatch(layout, /if \(!shouldMeasure\) return/);
  assert.match(layout, /send_page_view: false/);
  assert.match(layout, /window\.__sssGaConfigured/);
  assert.match(layout, /requestedGoogleAnalyticsId === "G-F5QWLD98HD"/);
});

test("GA3 keeps consent updates and explicit page views in the client layer", () => {
  assert.match(consent, /"consent", "update"/);
  assert.match(consent, /"event", "page_view"/);
  assert.match(consent, /analytics_storage: consent === "granted" \? "granted" : "denied"/);
});
