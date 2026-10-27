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
        // HOME-CINE2A.8G.1: the mobile dock is a non-overlaying quick-access
        // band after the hero, not fixed on top of the primary CTA or consent.
        if (viewport.width <= 390) {
          const dock = page.locator('[data-testid="home-floating-dock"]');
          await page.waitForFunction(() =>
            document.querySelector('[data-testid="home-floating-dock"]')?.getAttribute("data-positioned") === "true");
          const positions = await page.evaluate(() => {
            const hero = document.querySelector('section[aria-labelledby="home-cinematic-title"]');
            const dock = document.querySelector('[data-testid="home-floating-dock"]');
            const h = hero.getBoundingClientRect(), d = dock.getBoundingClientRect();
            return { heroBottom: h.bottom, dockTop: d.top, position: getComputedStyle(dock).position };
          });
          assert.equal(positions.position, "relative", "Mobile dock must not be fixed");
          assert.ok(positions.dockTop >= positions.heroBottom - 2,
            "Dock must follow hero without overlay: " + JSON.stringify(positions));
          await dock.scrollIntoViewIfNeeded();
          assert.ok(await dock.isVisible(), "Both tools must remain discoverable below hero");
          await page.evaluate(() => window.scrollTo(0, 0));
        }
        // HOME-CALC-EMBED3: real modal, not just a static homepage capture.
        // Check shared calculator geometry inside the actual modal iframe.
        if ([390, 1440].includes(viewport.width)) {
          const dock = page.getByTestId("home-floating-dock");
          await dock.getByRole("button", {
            name: locale === "it" ? "Pesi e Norme" : "Weights & Standards",
          }).click();
          const modal = page.locator("#home-floating-weights");
          await modal.waitFor({ state: "visible" });
          const frame = modal.locator("iframe");
          await frame.waitFor({ state: "attached" });
          assert.equal(await frame.getAttribute("src"),
            locale === "it" ? "/calculator-embed" : "/en/calculator-embed",
            "Modal must load the embedded surface, not the whole School");
          const inner = page.frameLocator("#home-floating-weights iframe");
          await inner.locator("[data-calculator-embed]").waitFor({ state: "attached", timeout: 60000 });
          await inner.locator("#calcolatore-pesi").waitFor({ state: "visible", timeout: 60000 });
          assert.equal(await inner.locator("[data-cockpit-workspace] [data-cockpit-fields]").count(), 1);
          assert.equal(await inner.locator("[data-cockpit-workspace] [data-cockpit-results]").count(), 1);
          assert.equal(await inner.locator("[data-cockpit-workspace] [data-cockpit-preview]").count(), 1);
          assert.equal(await inner.locator("header nav, [data-testid=calculator-editorial-disclosure]").count(), 0,
            "Embedded calculator must not carry a second site menu/editorial page");
          const embedded = await inner.locator("[data-calculator-embed]").evaluate((el) => ({
            width: document.documentElement.clientWidth,
            scrollWidth: document.documentElement.scrollWidth,
            workspaceColumns: getComputedStyle(el.querySelector("[data-cockpit-workspace]")).gridTemplateColumns,
          }));
          assert.ok(embedded.scrollWidth <= embedded.width + 12,
            "Embedded calculator has horizontal overflow: " + JSON.stringify(embedded));
          const modalName = locale + "-" + viewport.name + "-calculator-modal";
          await page.screenshot({
            path: path.join(output, modalName + ".png"), animations: "disabled",
          });
          report.push({ name: modalName, status: "pass", ...embedded });
          await modal.getByRole("button", { name: locale === "it" ? "Chiudi strumento" : "Close tool" }).click();
          await modal.waitFor({ state: "hidden" });
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
