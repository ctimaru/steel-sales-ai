/**
 * SCHOOL-UX4 — Localhost-only visual acceptance for the actual public technical
 * indexes, rather than relying only on screenshots of the five School hubs.
 */
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { chromium } from "playwright";

const base = "http://127.0.0.1:3000";
const cases = ["en", "de", "fr", "es"].flatMap(locale =>
  ["standards", "grades"].map(kind => ({
    locale, kind, path: `/${locale}/knowledge/${kind}`,
  }))
);
const out = "test-results/school-ux4";
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: "chrome" });
try {
  for (const width of [390, 1440]) {
    const context = await browser.newContext({
      viewport: { width, height: width === 390 ? 844 : 900 },
      reducedMotion: "reduce",
    });
    await context.route("**/*", route => {
      const url = new URL(route.request().url());
      if (url.origin !== base || !["GET", "HEAD"].includes(route.request().method())) return route.abort();
      return route.continue();
    });
    const page = await context.newPage();
    for (const item of cases) {
      const tag = `${item.locale}-${item.kind}-${width}`;
      const response = await page.goto(base + item.path, { waitUntil: "domcontentloaded", timeout: 60000 });
      assert.equal(response?.status(), 200, tag + " public HTTP");
      assert.equal(await page.locator("h1").count(), 1, tag + " one main headline");
      assert.match(await page.locator("h1").first().getAttribute("class") || "", /text-white/, tag + " cinematic contrast");
      assert.equal(await page.locator('form[role="search"]').count(), 1, tag + " technical search");
      assert.equal(await page.locator('link[rel="canonical"]').first().getAttribute("href"), base + item.path, tag + " canonical");
      const dims = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
      assert.ok(dims.scroll <= dims.viewport + 12, tag + " horizontal clipping " + JSON.stringify(dims));
      await page.screenshot({ path: `${out}/${tag}.png`, animations: "disabled" });
      console.log("SCHOOL-UX4 VISUAL PASS", tag);
    }
    await context.close();
  }
} finally {
  await browser.close();
}
console.log("SCHOOL-UX4 VISUAL PASS: 8 public technical indexes x 2 viewports");
