import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const rootLayout = fs.readFileSync(
  new URL("../app/layout.tsx", import.meta.url),
  "utf8",
);
const analytics = fs.readFileSync(
  new URL("../components/google-analytics-consent.tsx", import.meta.url),
  "utf8",
);
const seo = fs.readFileSync(
  new URL("../lib/seo.ts", import.meta.url),
  "utf8",
);

test("G1 keeps Search Console verification env-driven", () => {
  assert.match(seo, /NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION/);
  assert.match(rootLayout, /googleSiteVerification\(\)/);
  assert.match(rootLayout, /verification:/);
});

test("G1 activates GA4 only from an environment measurement ID", () => {
  assert.match(rootLayout, /NEXT_PUBLIC_GOOGLE_ANALYTICS_ID/);
  assert.match(rootLayout, /<GoogleAnalyticsConsent measurementId=\{googleAnalyticsId\}/);
  assert.match(analytics, /googletagmanager\.com\/gtag\/js\?id=/);
});

test("G1 uses advanced consent mode with denied defaults before opt-in", () => {
  assert.match(analytics, /\{shouldMeasure \? \(/);
  assert.match(analytics, /"consent", "default"/);
  assert.match(analytics, /analytics_storage: "denied"/);
  assert.match(analytics, /analytics_storage: consent === "granted" \? "granted" : "denied"/);
  assert.match(analytics, /ad_storage: "denied"/);
  assert.match(analytics, /ad_user_data: "denied"/);
  assert.match(analytics, /ad_personalization: "denied"/);
  assert.match(analytics, /Accetta necessari/);
  assert.match(analytics, /Accetta/);
  assert.match(analytics, /Prima della tua scelta Analytics resta senza cookie/);
});

test("G1 limits GA4 measurement to public acquisition surfaces", () => {
  assert.match(analytics, /pathname === "\/"/);
  assert.match(analytics, /pathname\.startsWith\("\/knowledge"\)/);
  assert.match(analytics, /pathname\.startsWith\("\/azienda"\)/);
  assert.match(analytics, /pathname\.startsWith\("\/register"\)/);
  assert.match(analytics, /pathname\.startsWith\("\/login"\)/);
  assert.doesNotMatch(analytics, /pathname\.startsWith\("\/network"\)/);
  assert.doesNotMatch(analytics, /pathname\.startsWith\("\/workspace"\)/);
  assert.doesNotMatch(analytics, /pathname\.startsWith\("\/platform"\)/);
});

test("G1 pageviews contain page context but no Smart Steel Sales identity payload", () => {
  assert.match(analytics, /"event", "page_view"/);
  assert.match(analytics, /page_path:/);
  assert.match(analytics, /page_location:/);
  assert.match(analytics, /page_title:/);
  assert.doesNotMatch(analytics, /user_id|organization_id|company_id|email|vat_number|partita_iva/i);
  assert.match(rootLayout + analytics, /allow_google_signals: false/);
  assert.match(rootLayout + analytics, /allow_ad_personalization_signals: false/);
});

test("G1 lets users withdraw analytics consent and clears GA cookies", () => {
  assert.match(analytics, /Riapri preferenze cookie e privacy/);
  assert.match(analytics, /clearGoogleAnalyticsCookies/);
  assert.match(analytics, /Max-Age=0/);
  assert.match(analytics, /analytics_storage: "denied"/);
});
