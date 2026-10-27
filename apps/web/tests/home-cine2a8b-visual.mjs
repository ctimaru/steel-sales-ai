/** HOME-CINE2A.8B: public-only disposable local screenshots; no credentials or writes. */
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const base = process.env.HOME_VISUAL_BASE_URL ?? "http://127.0.0.1:3000";
const output = process.env.HOME_VISUAL_OUT ?? "artifacts/home-cine2a-8b";
const targets = [
  { name: "mobile-320", width: 320, height: 720 },
  { name: "mobile-390", width: 390, height: 844 },
  { name: "tablet-768", width: 768, height: 1024 },
  { name: "desktop-1440", width: 1440, height: 900 },
];
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const report = [];
let errors = [];
try {
  for (const locale of ["it", "en"]) {
    for (const viewport of targets) {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        locale: locale === "it" ? "it-IT" : "en-US",
        reducedMotion: "reduce", serviceWorkers: "block", acceptDownloads: false,
      });
      const page = await context.newPage();
      try {
        await page.route("**/*", async route => {
          const req = route.request();
          const url = new URL(req.url());
          if (!["GET", "HEAD"].includes(req.method()) || url.origin !== new URL(base).origin) return route.abort();
          return route.continue();
        });
        const url = base + (locale === "en" ? "/en" : "/");
        const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
        assert.equal(response?.status(), 200, url + " must respond 200");
        const primary = page.locator('section[aria-labelledby="home-cinematic-title"] a').filter({
          hasText: locale === "it" ? "Norme e pesi" : "Standards & weights",
        }).first();
        assert.equal(await primary.count(), 1, "Hero primary action missing");
        const href = await primary.getAttribute("href");
        assert.ok(href?.includes("/knowledge/tubes"), "Hero CTA must link to calculator");
        const cards = page.locator("#home-tools a");
        assert.equal(await cards.count(), 5, "Exactly five tool cards expected");
        const metrics = await page.evaluate(() => ({
          documentWidth: document.documentElement.scrollWidth,
          viewportWidth: document.documentElement.clientWidth,
        }));
        assert.ok(metrics.documentWidth <= metrics.viewportWidth + 12,
          "Horizontal overflow " + JSON.stringify(metrics));
        const cta = await primary.boundingBox();
        assert.ok(cta && cta.width > 80 && cta.height >= 44 &&
          cta.x >= -2 && cta.x + cta.width <= viewport.width + 2,
          "Primary CTA clipped or too small");
        // HOME-CINE2A.8G.1: do not cover primary hero actions or consent
        // on first visit; keep quick tools discoverable after leaving hero.
        if (viewport.width <= 390) {
          const dock = page.locator('[data-testid="home-floating-dock"]');
          await page.waitForFunction(() => {
            const el = document.querySelector('[data-testid="home-floating-dock"]');
            return el?.getAttribute("data-positioned") === "true";
          });
          assert.equal(await dock.getAttribute("data-beyond-hero"), "false",
            "Dock must be suppressed while mobile hero is visible");
          assert.equal(await dock.isVisible(), false,
            "Fixed dock must not overlap the mobile first viewport");
          await page.locator('section[aria-labelledby="home-cinematic-title"]').evaluate(
            el => window.scrollTo({ top: el.getBoundingClientRect().bottom + window.scrollY + 10 }),
          );
          await page.waitForFunction(() =>
            document.querySelector('[data-testid="home-floating-dock"]')?.getAttribute("data-beyond-hero") === "true");
          assert.equal(await dock.isVisible(), true, "Dock must reappear after hero");
          await page.evaluate(() => window.scrollTo(0, 0));
          await page.waitForFunction(() =>
            document.querySelector('[data-testid="home-floating-dock"]')?.getAttribute("data-beyond-hero") === "false");
        }
        const name = locale + "-" + viewport.name;
        await page.screenshot({ path: path.join(output, name + ".png"), fullPage: true, animations: "disabled" });
        report.push({ name, url, status: "pass", cards: 5, href, ...metrics });
      } catch (error) {
        errors.push({ locale, viewport: viewport.name, error: String(error) });
        try { await page.screenshot({ path: path.join(output, locale + "-" + viewport.name + "-failure.png"), fullPage: true }); } catch {}
      } finally { await context.close(); }
    }
  }
} finally {
  await browser.close();
  await fs.writeFile(path.join(output, "report.json"), JSON.stringify({ report, errors }, null, 2));
}
console.log(JSON.stringify({ report, errors }, null, 2));
assert.equal(errors.length, 0, "Visual acceptance failed; inspect report.json and screenshots");
