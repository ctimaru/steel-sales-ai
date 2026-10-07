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

test("GA3 renders the Google tag directly in the document head", () => {
  const head = layout.indexOf("<head>");
  const tag = layout.indexOf('id="sss-google-analytics"');
  const body = layout.indexOf("<body>");
  assert.ok(head >= 0 && tag > head && body > tag);
  assert.match(layout, /async/);
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

test("GA3 configures GA only for the public acquisition paths", () => {
  assert.match(layout, /path === "\/"/);
  assert.match(layout, /path\.indexOf\("\/knowledge"\)/);
  assert.match(layout, /path\.indexOf\("\/azienda"\)/);
  assert.match(layout, /path\.indexOf\("\/register"\)/);
  assert.match(layout, /path\.indexOf\("\/login"\)/);
  assert.match(layout, /send_page_view: false/);
  assert.match(layout, /window\.__sssGaConfigured/);
});

test("GA3 keeps consent updates and explicit page views in the client layer", () => {
  assert.match(consent, /"consent", "update"/);
  assert.match(consent, /"event", "page_view"/);
  assert.match(consent, /analytics_storage: consent === "granted" \? "granted" : "denied"/);
});
