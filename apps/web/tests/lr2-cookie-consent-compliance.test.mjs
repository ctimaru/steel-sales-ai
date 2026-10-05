import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const consent = fs.readFileSync(new URL("../components/google-analytics-consent.tsx", import.meta.url), "utf8");
const contract = fs.readFileSync(new URL("../lib/analytics-consent.ts", import.meta.url), "utf8");
const inventory = fs.readFileSync(new URL("../lib/public-storage-inventory.ts", import.meta.url), "utf8");
const cookies = fs.readFileSync(new URL("../app/cookies/page.tsx", import.meta.url), "utf8");
const layout = fs.readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");

test("LR2 stores a versioned, timestamped local consent evidence record", () => {
  assert.ok(contract.includes('ANALYTICS_CONSENT_STORAGE_KEY = "sss.analytics-consent.v2"'));
  assert.ok(contract.includes("ANALYTICS_CONSENT_VERSION"));
  assert.ok(contract.includes("ANALYTICS_NOTICE_VERSION"));
  assert.ok(contract.includes("decidedAt: string"));
  assert.ok(contract.includes("decidedAt.toISOString()"));
  assert.ok(consent.includes("JSON.stringify(nextRecord)"));
  assert.ok(consent.includes("setConsentRecord(nextRecord)"));
});

test("LR2 does not aggressively reprompt before six months unless the notice changes", () => {
  assert.ok(contract.includes("ANALYTICS_REPROMPT_MONTHS = 6"));
  assert.ok(contract.includes("expiresAt.setMonth(expiresAt.getMonth() + ANALYTICS_REPROMPT_MONTHS)"));
  assert.ok(contract.includes("record.consentVersion !== ANALYTICS_CONSENT_VERSION"));
  assert.ok(contract.includes("record.noticeVersion !== ANALYTICS_NOTICE_VERSION"));
  assert.ok(consent.includes("analyticsConsentRecordIsCurrent(stored)"));
  assert.ok(cookies.includes("non ripropone il banner prima di sei mesi"));
  assert.ok(cookies.includes("linguetta “Privacy”"));
});

test("LR2 deliberately invalidates the legacy unversioned choice once", () => {
  assert.ok(contract.includes("sss.google-analytics-consent.v1"));
  assert.ok(consent.includes("LEGACY_ANALYTICS_CONSENT_STORAGE_KEY"));
  assert.ok(consent.includes("removeItem(LEGACY_ANALYTICS_CONSENT_STORAGE_KEY)"));
});

test("LR2 keeps zero Google Analytics loading before explicit grant", () => {
  assert.ok(consent.includes('consent === "granted" ? ('));
  assert.ok(consent.includes("googletagmanager.com/gtag/js?id="));
  assert.ok(consent.includes('if (!measurementId || !shouldMeasure || consent !== "granted") return;'));
  assert.ok(!layout.includes("googletagmanager.com"));
  assert.ok(!layout.includes("google-analytics.com"));
  assert.ok(consent.includes("Solo necessari"));
  assert.ok(consent.includes("Accetta analytics"));
});

test("LR2 removes accessible GA cookies on withdrawal or stale granted evidence", () => {
  assert.ok(consent.includes("clearGoogleAnalyticsCookies"));
  assert.ok(consent.includes('stored?.decision === "granted"'));
  assert.ok(consent.includes('nextConsent === "denied"'));
  assert.ok(consent.includes("Max-Age=0"));
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
  assert.ok(inventory.includes('category: "necessario"'));
  assert.ok(inventory.includes('category: "funzionale"'));
  assert.ok(inventory.includes('category: "statistico"'));
  assert.ok(cookies.includes("PUBLIC_STORAGE_INVENTORY.map"));
  assert.ok(cookies.includes("Inventario cookie e storage pubblico"));
});

test("LR2 keeps consent revocable and public analytics restricted to acquisition surfaces", () => {
  assert.ok(consent.includes("Cookie e privacy"));
  assert.ok(consent.includes("Riapri preferenze cookie e privacy"));
  assert.ok(consent.includes("setSettingsOpen(true)"));
  assert.ok(consent.includes('pathname.startsWith("/knowledge")'));
  assert.ok(consent.includes('pathname.startsWith("/azienda")'));
  assert.ok(!consent.includes('pathname.startsWith("/network")'));
  assert.ok(!consent.includes('pathname.startsWith("/workspace")'));
  assert.ok(!consent.includes('pathname.startsWith("/platform")'));
});