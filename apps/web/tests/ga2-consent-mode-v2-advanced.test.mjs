import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const consent = fs.readFileSync(
  new URL("../components/google-analytics-consent.tsx", import.meta.url),
  "utf8",
);
const layout = fs.readFileSync(
  new URL("../app/layout.tsx", import.meta.url),
  "utf8",
);
const consentModel = fs.readFileSync(
  new URL("../lib/analytics-consent.ts", import.meta.url),
  "utf8",
);
const cookies = fs.readFileSync(
  new URL("../app/cookies/page.tsx", import.meta.url),
  "utf8",
);

test("GA2 loads the Google tag independently of analytics consent", () => {
  assert.match(layout, /id="sss-google-analytics"/);
  assert.match(layout, /googletagmanager\.com\/gtag\/js\?id=/);
  assert.doesNotMatch(layout, /consent === "granted"/);
});

test("GA2 defaults Consent Mode v2 storage to denied before measurement", () => {
  assert.match(layout, /"consent", "default"/);
  assert.match(layout, /analytics_storage: "denied"/);
  assert.match(layout, /ad_storage: "denied"/);
  assert.match(layout, /ad_user_data: "denied"/);
  assert.match(layout, /ad_personalization: "denied"/);
  assert.match(layout, /wait_for_update: 500/);
  assert.match(layout, /"ads_data_redaction", true/);
});

test("GA2 updates only analytics storage after the user choice", () => {
  assert.match(consent, /"consent", "update"/);
  assert.match(consent, /analytics_storage: nextConsent === "granted" \? "granted" : "denied"/);
  assert.match(layout + consent, /allow_google_signals: false/);
  assert.match(layout + consent, /allow_ad_personalization_signals: false/);
});

test("GA2 can send cookieless public page views after consent state initialization", () => {
  assert.match(consent, /!consentReady/);
  assert.match(consent, /"event", "page_view"/);
  assert.match(layout + consent, /send_page_view: false/);
});

test("GA2 versions and discloses the advanced-consent behavior", () => {
  assert.match(consentModel, /ga2-2026-10-07-v1/);
  assert.match(consentModel, /ANALYTICS_NOTICE_VERSION = "2026-10-07"/);
  assert.match(cookies, /Consent Mode v2/);
  assert.match(cookies, /ping tecnici/);
  assert.match(cookies, /senza cookie/);
});
