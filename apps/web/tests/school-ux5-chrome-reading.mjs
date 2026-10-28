/** SCHOOL-UX5 read-only Chrome acceptance against local production build. */
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { chromium } from "playwright";
const base = "http://127.0.0.1:3000";
// PERF2.1 intentionally builds Next without a Supabase connection. Technical
// standard detail pages are K2 publication-gated, not static editorial pages.
// A configured, seeded acceptance environment MUST still verify 200 + anchors.
const hasPublishedDataset = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
);
const pages = [
  { locale: "it", path: "/knowledge/articoli/come-si-producono-tubi-acciaio", publishedRecordRequired: false },
  { locale: "it", path: "/knowledge/norme/en-10219", publishedRecordRequired: true },
  { locale: "en", path: "/en/knowledge/standards/en-10219", publishedRecordRequired: true },
  { locale: "de", path: "/de/knowledge/standards/en-10219", publishedRecordRequired: true },
];
await fs.mkdir("test-results/school-ux5", { recursive: true });
const browser = await chromium.launch({ headless: true, channel: "chrome" });
try {
  for (const width of [390, 1440]) {
    const context = await browser.newContext({
      viewport: { width, height: width === 390 ? 844 : 900 }, reducedMotion: "reduce",
    });
    await context.route("**/*", route => {
      const u = new URL(route.request().url());
      if (u.origin !== base || !["GET", "HEAD"].includes(route.request().method())) return route.abort();
      return route.continue();
    });
    const page = await context.newPage();
    for (const entry of pages) {
      const tag = entry.locale + "-" + entry.path.split("/").at(-1) + "-" + width;
      const response = await page.goto(base + entry.path, { waitUntil: "domcontentloaded", timeout: 60000 });
      if (entry.publishedRecordRequired && !hasPublishedDataset) {
        // A missing published K2 record MUST remain a 404 (never a fabricated
        // guide); absence of DB in this workflow is not a visual regression.
        assert.equal(response?.status(), 404, tag + " unpublished K2 record must stay unavailable");
        assert.equal(await page.getByText("EN 10219", { exact: true }).count(), 0,
          tag + " no unpublished standards detail may leak");
        console.log("SCHOOL-UX5 PUBLICATION GATE PASS", tag, "404 without K2 dataset; anchor test requires seeded K2");
        continue;
      }
      assert.equal(response?.status(), 200, tag + " published page HTTP");
      const nav = page.locator('nav:has(a[href^="#"])').filter({ has: page.locator('a[href^="#"]') }).first();
      await nav.waitFor({ state: "visible", timeout: 20000 });
      const hrefs = await nav.locator('a[href^="#"]').evaluateAll(links => links.map(n => n.getAttribute("href")));
      assert.ok(hrefs.length >= 2, tag + " has accessible reading links");
      for (const href of hrefs) {
        assert.equal(await page.locator(href).count(), 1, tag + " missing/duplicate target " + href);
      }
      await nav.locator('a[href^="#"]').first().click();
      assert.equal(new URL(page.url()).hash, hrefs[0], tag + " anchor did not navigate");
      const dims = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
      assert.ok(dims.scroll <= dims.viewport + 12, tag + " horizontal overflow");
      await page.screenshot({ path: `test-results/school-ux5/${tag}.png`, animations: "disabled" });
      console.log("SCHOOL-UX5 CHROME PASS", tag, hrefs.length, "anchors");
    }
    await context.close();
  }
} finally {
  await browser.close();
}
