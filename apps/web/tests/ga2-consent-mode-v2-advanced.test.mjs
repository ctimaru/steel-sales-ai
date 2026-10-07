import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const consent = fs.readFileSync(
  new URL("../components/google-analytics-consent.tsx", import.meta.url),
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
  assert.match(consent, /\{shouldMeasure \? \(/);
  assert.match(consent, /id="sss-google-analytics"/);
  assert.doesNotMatch(consent, /\{consent === "granted" \? \(/);
});

test("GA2 defaults Consent Mode v2 storage to denied before measurement", () => {
  assert.match(consent, /"consent", "default"/);
  assert.match(consent, /analytics_storage: "denied"/);
  assert.match(consent, /ad_storage: "denied"/);
  assert.match(consent, /ad_user_data: "denied"/);
  assert.match(consent, /ad_personalization: "denied"/);
  assert.match(consent, /wait_for_update: 500/);
  assert.match(consent, /"ads_data_redaction", true/);
});

test("GA2 updates only analytics storage after the user choice", () => {
  assert.match(consent, /"consent", "update"/);
  assert.match(consent, /analytics_storage: nextConsent === "granted" \? "granted" : "denied"/);
  assert.match(consent, /allow_google_signals: false/);
  assert.match(consent, /allow_ad_personalization_signals: false/);
});

test("GA2 can send cookieless public page views after consent state initialization", () => {
  assert.match(consent, /!consentReady/);
  assert.match(consent, /"event", "page_view"/);
  assert.match(consent, /send_page_view: false/);
});

test("GA2 versions and discloses the advanced-consent behavior", () => {
  assert.match(consentModel, /ga2-2026-10-07-v1/);
  assert.match(consentModel, /ANALYTICS_NOTICE_VERSION = "2026-10-07"/);
  assert.match(cookies, /Consent Mode v2/);
  assert.match(cookies, /ping tecnici/);
  assert.match(cookies, /senza cookie/);
});
