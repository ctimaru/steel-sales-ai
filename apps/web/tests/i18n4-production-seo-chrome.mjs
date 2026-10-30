/**
 * I18N4 Chrome acceptance on the deployed production host.
 * Anonymous-only, GET/HEAD network policy. No registrations, RFQ dispatch or GSC writes.
 * Screenshots contain public pages only and are kept for three days by CI.
 */
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const BASE = "https://www.smartsteelsales.com";
const output = "test-results/i18n4";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: "chrome" });
let checks = 0;
let attemptedMutation = false;
const paths = [
  "/en",
  "/en/knowledge",
  "/en/knowledge/standards",
  "/en/knowledge/grades",
  "/en/knowledge/tubes",
  "/en/distinta",
  "/en/network",
];

async function checkContext(label, viewport, mobile) {
  const context = await browser.newContext({
    viewport, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: mobile ? 2 : 1,
    locale: "en-GB", permissions: [], serviceWorkers: "block", acceptDownloads: false,
  });
  await context.route("**/*", async route => {
    const method = route.request().method();
    if (method !== "GET" && method !== "HEAD") {
      const url = new URL(route.request().url());
      const analytics = method === "POST" &&
        ((url.hostname.endsWith("google-analytics.com") || url.hostname === "www.google.com") &&
          (url.pathname === "/g/collect" || url.pathname === "/td") ||
          (url.hostname === "www.googletagmanager.com" && url.pathname === "/td"));
      if (!analytics) {
        attemptedMutation = true;
        console.error("I18N4 READ-ONLY BLOCK", method, url.origin + url.pathname);
      }
      await route.abort();
      return;
    }
    await route.continue();
  });
  const page = await context.newPage();
  for (const path of paths) {
    const response = await page.goto(BASE + path, { waitUntil: "domcontentloaded", timeout: 90000 });
    assert.equal(response?.status(), 200, label + path + " HTTP 200");
    await page.getByRole("heading", { level: 1 }).first().waitFor({ state: "visible", timeout: 35000 });
    const main = page.locator('main[lang="en"]').first();
    assert.ok(await main.count(), label + path + " main language");
    const h1 = await page.getByRole("heading", { level: 1 }).first().innerText();
    assert.ok(h1.trim().length > 15, "Empty English heading " + path);
    assert.equal(await page.locator('link[rel="canonical"]').count(), 1, "Exactly one canonical " + path);
    assert.equal(await page.locator('link[rel="canonical"]').getAttribute("href"), BASE + path);
    assert.ok(!(await page.locator("body").innerText()).includes("Questa sezione non è disponibile in questo momento"), "fallback " + path);
    const extent = await page.evaluate(() => ({
      width: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
    }));
    assert.ok(extent.scroll <= extent.width + 12,
      label + " horizontal overflow " + path + ": " + extent.scroll + "/" + extent.width);
    checks++;
    console.log("I18N4 CHROME PASS", label, path, "h1=" + h1.slice(0, 75));
    if (path === "/en/knowledge/standards" || path === "/en/knowledge/grades") {
      const first = page.locator('a[href^="' + path + '/"]').first();
      assert.ok(await first.count() > 0, label + " has no published technical guides " + path);
      const destination = await first.getAttribute("href");
      assert.ok(destination.startsWith(path + "/"));
      const detail = await page.goto(BASE + destination, { waitUntil: "domcontentloaded", timeout: 90000 });
      assert.equal(detail?.status(), 200, "Guide " + destination);
      await page.getByRole("heading", { level: 1 }).first().waitFor({ state: "visible" });
      assert.ok(await page.getByRole("heading", {
        name: /What does .* cover\?|Understanding the designation/i,
      }).count() > 0, "Published guide is missing its technical explanation");
      checks++;
      console.log("I18N4 CHROME PASS", label, "published technical guide", destination);
    }
    if (path === "/en/knowledge/tubes") {
      // I18N7 removed the standalone English component. Check the shared
      // calculator that is already in production, without writing data.
      const calc = page.locator("#calcolatore-pesi");
      assert.ok(await calc.count(), "Shared English calculator missing");
      // CALC-UX4 moved EN 10219 / EN 10210 into one accessible select.
      // Check the real production UI contract, not the retired button.
      const standardPicker = calc.getByRole("combobox", { name: "Standard", exact: true });
      await standardPicker.waitFor({ state: "visible", timeout: 12000 });
      assert.ok(await standardPicker.locator('option[value="en10219"]').count() > 0,
        "EN 10219 standard option missing");
      assert.ok(await standardPicker.locator('option[value="en10210"]').count() > 0,
        "EN 10210 standard option missing");
      // CALC-UX6 renamed the presentation CTA to "Copy results".
      assert.ok(await calc.getByRole("button", {name:"Copy results",exact:true}).count() > 0,
        "English copy action missing");
      // Production smoke checks deployed main, which may still have the old
      // link until this PR merges; local Chrome E2E gates the new transfer.
      // The calculator now uses a localized inline-distinta CTA. Check its
      // stable actionable contract rather than a retired English label.
      const inlineAction = calc.locator("button.tube-calculator-rfq-link");
      const oldLink = calc.locator('a.tube-calculator-rfq-link[href="/en/distinta"]');
      assert.ok(await inlineAction.count() === 1 || await oldLink.count() === 1,
        "English RFQ bill action inaccessible");
      if (await inlineAction.count()) {
        assert.ok(await inlineAction.isVisible(), "English RFQ bill action hidden");
        // The production page hydrates the EU weight calculator after
        // domcontentloaded. The CTA is deliberately disabled until the
        // theoretical mass and RFQ snapshot are valid. Verify it BECOMES
        // actionable, not that it is enabled in the very first browser tick.
        // This remains read-only: no RFQ is created or transmitted.
        await page.waitForFunction(() => {
          const action = document.querySelector("button.tube-calculator-rfq-link");
          return action instanceof HTMLButtonElement && !action.disabled;
        }, null, { timeout: 12000 });
        assert.ok(await inlineAction.isEnabled(), "English RFQ bill action remains disabled after calculator readiness wait");
      }
      assert.ok(await page.getByText("Total weight").first().count() > 0,
        "English calculator total mass missing");
      checks++;
    }
    if (path === "/en/distinta") {
      await page.getByRole("button", { name: /Add another item/i }).click();
      assert.equal(await page.getByRole("heading", { name: /^Item [12]$/ }).count(), 2);
      checks++;
    }
    if (path === "/en/knowledge/standards" || path === "/en/knowledge/grades") {
      await page.goto(BASE + path, { waitUntil: "domcontentloaded", timeout: 90000 });
      await page.screenshot({ path: output + "/" + (mobile ? "mobile" : "desktop") + "-" + path.split("/").at(-1) + ".png", fullPage: false });
    }
  }
  await context.close();
}

try {
  await checkContext("desktop", { width: 1440, height: 900 }, false);
  await checkContext("mobile", { width: 390, height: 844 }, true);
  assert.equal(attemptedMutation, false, "Unexpected non-read-only request attempted from Chrome");
  console.log("I18N4 CHROME SUCCESS", checks, "read-only UI checks; 0 production writes");
} finally {
  await browser.close();
}
