import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const consent = fs.readFileSync(
  new URL("../components/google-analytics-consent.tsx", import.meta.url),
  "utf8",
);
const contract = fs.readFileSync(
  new URL("../lib/analytics-consent.ts", import.meta.url),
  "utf8",
);
const inventory = fs.readFileSync(
  new URL("../lib/public-storage-inventory.ts", import.meta.url),
  "utf8",
);
const cookies = fs.readFileSync(
  new URL("../app/cookies/page.tsx", import.meta.url),
  "utf8",
);
const layout = fs.readFileSync(
  new URL("../app/layout.tsx", import.meta.url),
  "utf8",
);

test("LR2 stores a versioned, timestamped local consent evidence record", () => {
  assert.match(contract, /ANALYTICS_CONSENT_STORAGE_KEY = "sss\\.analytics-consent\\.v2"/);
  assert.match(contract, /ANALYTICS_CONSENT_VERSION/);
  assert.match(contract, /ANALYTICS_NOTICE_VERSION/);
  assert.match(contract, /decidedAt:/);
  assert.match(contract, /toISOString\\(\\)/);
  assert.match(consent, /JSON\\.stringify\\(nextRecord\\)/);
  assert.match(consent, /setConsentRecord\\(nextRecord\\)/);
});

test("LR2 does not aggressively reprompt before six months unless the notice changes", () => {
  assert.match(contract, /ANALYTICS_REPROMPT_MONTHS = 6/);
  assert.match(contract, /setMonth\\(expiresAt\\.getMonth\\(\\) \\+ ANALYTICS_REPROMPT_MONTHS\\)/);
  assert.match(contract, /record\\.consentVersion !== ANALYTICS_CONSENT_VERSION/);
  assert.match(contract, /record\\.noticeVersion !== ANALYTICS_NOTICE_VERSION/);
  assert.match(consent, /analyticsConsentRecordIsCurrent\\(stored\\)/);
  assert.match(cookies, /non ripropone il banner prima di sei mesi/i);
});

test("LR2 deliberately invalidates the legacy unversioned choice once", () => {
  assert.match(contract, /sss\\.google-analytics-consent\\.v1/);
  assert.match(consent, /LEGACY_ANALYTICS_CONSENT_STORAGE_KEY/);
  assert.match(consent, /removeItem\\(LEGACY_ANALYTICS_CONSENT_STORAGE_KEY\\)/);
});

test("LR2 keeps zero Google Analytics loading before explicit grant", () => {
  assert.match(consent, /consent === "granted" \\?/);
  assert.ok(consent.includes("googletagmanager.com/gtag/js?id="));
  assert.ok(consent.includes('if (!measurementId || !shouldMeasure || consent !== "granted") return;'));
  assert.doesNotMatch(layout, /googletagmanager\\.com|google-analytics\\.com/);
  assert.match(consent, /Solo necessari/);
  assert.match(consent, /Accetta statistiche/);
});

test("LR2 removes accessible GA cookies on withdrawal or stale granted evidence", () => {
  assert.match(consent, /clearGoogleAnalyticsCookies/);
  assert.match(consent, /stored\\?\\.decision === "granted"/);
  assert.match(consent, /nextConsent === "denied"/);
  assert.match(consent, /Max-Age=0/);
});

test("LR2 publishes a concrete cookie and local-storage inventory", () => {
  for (const key of [
    "sss.analytics-consent.v2",
    "sb-<project-ref>-auth-token*",
    "sss.weightCalculator.recents.v1",
    "sss.weightCalculator.favorites.v1",
    "sss.weightCalculator.savedTool.v1",
    "_ga",
    "_ga_<container-id>",
  ]) {
    assert.ok(inventory.includes(key), `missing inventory key: ${key}`);
  }
  assert.match(inventory, /category: "necessario"/);
  assert.match(inventory, /category: "funzionale"/);
  assert.match(inventory, /category: "statistico"/);
  assert.match(cookies, /PUBLIC_STORAGE_INVENTORY\\.map/);
  assert.match(cookies, /Inventario cookie e storage pubblico/);
});

test("LR2 keeps consent revocable and public analytics restricted to acquisition surfaces", () => {
  assert.match(consent, /Preferenze statistiche/);
  assert.match(consent, /setSettingsOpen\\(true\\)/);
  assert.ok(consent.includes('pathname.startsWith("/knowledge")'));
  assert.ok(consent.includes('pathname.startsWith("/azienda")'));
  assert.ok(!consent.includes('pathname.startsWith("/network")'));
  assert.ok(!consent.includes('pathname.startsWith("/workspace")'));
  assert.ok(!consent.includes('pathname.startsWith("/platform")'));
});