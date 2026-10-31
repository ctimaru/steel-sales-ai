/**
 * I18N6 public conversion acceptance. No signup, company search submission,
 * auth requests, invites, legal acceptance or RFQ writes allowed.\n * Known external Google consent-mode telemetry is also blocked, but not counted\n * as a first-party application mutation.
 * On PR the new routes may not yet be deployed; run strictly only on push/main
 * or manually on production.
 */
import assert from "node:assert/strict";
import { chromium } from "playwright";

const BASE = "https://www.smartsteelsales.com";
const STRICT = process.env.I18N6_STRICT_PRODUCTION === "true";
const browser = await chromium.launch({ channel: "chrome", headless: true });
let checks = 0;
let writes = 0;
try {
  for (const mobile of [false, true]) {
    const context = await browser.newContext({
      viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 },
      isMobile: mobile, hasTouch: mobile, serviceWorkers: "block", locale: "en-GB",
    });
    await context.route("**/*", async route => {
      const method = route.request().method();
      if (method !== "GET" && method !== "HEAD") {
        const url = new URL(route.request().url());
        const googleAnalyticsHost =
          url.hostname === "google-analytics.com" ||
          url.hostname.endsWith(".google-analytics.com") ||
          url.hostname === "google.com" ||
          url.hostname.endsWith(".google.com") ||
          url.hostname === "googletagmanager.com" ||
          url.hostname.endsWith(".googletagmanager.com");
        const blockedTelemetry = method === "POST" && googleAnalyticsHost &&
          (url.pathname === "/td" || url.pathname === "/g/collect");
        if (!blockedTelemetry) {
          writes++;
          // Diagnostics never include query parameters, bodies or headers.
          console.error("I18N6 BLOCKED NON-READONLY REQUEST", method, url.hostname, url.pathname.split("/").slice(0, 3).join("/"));
        }
        // Every POST, including telemetry, is aborted before reaching production.
        await route.abort();
      } else {
        await route.continue();
      }
    });
    const page = await context.newPage();
    const registration = await page.goto(BASE + "/en/register", { waitUntil: "domcontentloaded", timeout: 90000 });
    if (!STRICT && registration?.status() === 404) {
      console.log("I18N6 PR WARN: route not deployed yet; strict acceptance runs after merge on push/main");
      await context.close();
      break;
    }
    assert.equal(registration?.status(), 200, "Public English registration");
    // ONBOARDING-UX2 puts the account CTA first; some cached production
    // regions may still serve the older company-discovery heading.
    await page.getByRole("heading", { name: /^(Create account|Join Smart Steel Sales)$/ }).first().waitFor();
    assert.ok(await page.locator('input[name="company_query"]').count(), "Existing company lookup reused");
    assert.ok(await page.locator('input[name="email"]').count(), "Email form present");
    assert.ok(await page.locator('input[name="password"]').count(), "Password form present");
    assert.ok(await page.locator('main[lang="en"]').count(), "English page semantics");
    assert.ok(await page.locator('meta[name="robots"][content*="noindex"]').count(), "Non-indexed account route");
    checks += 5;

    const login = await page.goto(BASE + "/en/login?next=%2Fen%2Fregister", { waitUntil: "domcontentloaded" });
    assert.equal(login?.status(), 200, "English login");
    assert.ok(await page.getByRole("heading", { name: "Sign in to Smart Steel Sales" }).count());
    assert.ok(await page.locator('input[name="next"][value="/en/register"]').count());
    checks += 3;

    const verification = await page.goto(BASE + "/en/verify-email?next=%2Fen%2Fregister", { waitUntil: "domcontentloaded" });
    assert.equal(verification?.status(), 200, "English email verification");
    assert.ok(await page.getByRole("heading", { name: "Check your inbox" }).count());
    checks += 2;

    await page.goto(BASE + "/en/knowledge/standards", { waitUntil: "domcontentloaded" });
    assert.ok(await page.locator('a[href="/en/register"]').count(), "English Knowledge links to English registration");
    assert.ok(await page.locator('a[href="/en/login"]').count(), "English Knowledge links to English login");
    checks += 2;

    const status = await page.goto(BASE + "/en/registration/status", { waitUntil: "domcontentloaded" });
    assert.ok([200, 307, 308].includes(status?.status()), "Anonymous status request redirects to sign in");
    await page.waitForURL(/\/en\/login/, { timeout: 25000 });
    assert.ok(page.url().includes("/en/login"), "No anonymous company application exposure");
    checks += 2;

    const extent = await page.evaluate(() => ({ doc: document.documentElement.scrollWidth, width: document.documentElement.clientWidth }));
    assert.ok(extent.doc <= extent.width + 12, "No mobile horizontal overflow");
    checks += 1;
    await context.close();
  }
  assert.equal(writes, 0, "Strict zero-write browser policy");
  console.log("I18N6 CHROME " + (checks ? "SUCCESS" : "NOT YET DEPLOYED") + " — " + checks + " read-only checks, 0 account creation or commercial writes");
} finally {
  await browser.close();
}
