/**
 * COMM-SIMPLE1 — local-only visual density acceptance at 1440/390/320.
 * One synthetic buyer, throwaway GoTrue+Postgres, zero provider email or writes.
 * Screenshots contain synthetic workspace data only; no login or token capture.
 */
import assert from "node:assert/strict";
import { readFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const origin = process.env.DEMOTEST23_WEB_URL;
assert.equal(origin, "http://127.0.0.1:3000", "Visual QA cannot target production");
assert.equal(process.env.NEXT_PUBLIC_SUPABASE_URL, "http://127.0.0.1:54321", "Throwaway Supabase only");
const temp = process.env.RUNNER_TEMP;
assert.ok(temp, "CI-only screenshots");
const buyer = JSON.parse(readFileSync(path.join(temp, "demotest23-personas.json"), "utf8"))
  .find(p => p.id === "buyer");
assert.ok(buyer?.email && buyer?.password && buyer?.rfq, "Synthetic buyer fixture required");
const output = path.join(temp, "comm-simple1-synthetic-visual");
mkdirSync(output, { recursive: true });

async function login(page) {
  await page.goto(origin + "/login", { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.locator('input[name="email"]').fill(buyer.email);
  await page.locator('input[name="password"]').fill(buyer.password);
  await page.getByRole("button", { name: "Accedi", exact: true }).click();
  await page.waitForURL(url => url.pathname === "/dashboard", { timeout: 90000 });
}
async function noOverflow(page, label) {
  const sizes = await page.evaluate(() => ({
    view: document.documentElement.clientWidth,
    document: document.documentElement.scrollWidth,
  }));
  assert.ok(sizes.document <= sizes.view + 12, label + " overflow " + JSON.stringify(sizes));
}
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  for (const width of [1440, 390, 320]) {
    const height = width === 1440 ? 900 : width === 390 ? 844 : 720;
    const context = await browser.newContext({
      viewport: { width, height },
      isMobile: width < 1000,
      deviceScaleFactor: width < 1000 ? 2 : 1,
      locale: "it-IT",
      reducedMotion: "reduce",
    });
    try {
      const page = await context.newPage();
      await login(page);
      await page.goto(origin + "/commercial", { waitUntil: "domcontentloaded", timeout: 90000 });
      const hero = page.getByTestId("comm-cine1-hero");
      const attention = page.getByTestId("commercial-compact-actions");
      const ai = page.getByTestId("commercial-ai-first");
      const deals = page.getByTestId("comm-cine2-deal-cockpit");
      await hero.getByRole("heading", { level: 1 }).waitFor({ state: "visible", timeout: 60000 });
      await deals.waitFor({ state: "visible", timeout: 60000 });
      const boxes = await Promise.all([hero, attention, ai, deals].map(x => x.boundingBox()));
      assert.ok(boxes.every(Boolean), "Commerciale main components must render");
      assert.ok(boxes[0].y < boxes[1].y && boxes[1].y < boxes[2].y && boxes[2].y < boxes[3].y);
      if (width === 1440) {
        assert.ok(boxes[0].height <= 120, "Commerciale hero should be compact: " + boxes[0].height);
        assert.ok(boxes[3].y < 760, "Commerciale worklist must start in first viewport: " + boxes[3].y);
      } else {
        assert.ok(boxes[2].y < 440,
          "COMM-SIMPLE1 mobile AI must enter the first screen; y=" + boxes[2].y);
        if (width === 320) {
          const aiCta = await page.getByTestId("commercial-ai-first-cta").boundingBox();
          assert.ok(aiCta && aiCta.y + aiCta.height <= height - 55,
            "320px buyer must see the chat CTA above bottom navigation: " + JSON.stringify(aiCta));
        }
      }
      await noOverflow(page, "Commerciale " + width);
      await page.screenshot({
        path: path.join(output, `commerciale-${width}.png`),
        fullPage: false, animations: "disabled",
      });

      await page.goto(origin + "/rfq-hub", { waitUntil: "domcontentloaded", timeout: 90000 });
      await page.getByRole("heading", { name: "RFQ Hub", exact: true }).waitFor({ state: "visible", timeout: 60000 });
      if (width < 1000) {
        const header = await page.locator('[data-testid="rfq-hub-simple-workspace"] > header').boundingBox();
        assert.ok(header && header.height <= 155,
          "COMM-SIMPLE1 mobile RFQ header must not bury campaigns: " + header?.height);
      }
      const summary = page.getByTestId("rfq-hub-compact-summary");
      const campaigns = page.getByTestId("rfq-hub-primary-campaigns");
      const distinte = page.getByTestId("rfq-hub-primary-distinte");
      await campaigns.waitFor({ state: "visible", timeout: 60000 });
      await distinte.waitFor({ state: "visible", timeout: 60000 });
      assert.equal(await summary.count(), 1);
      const summaryBox = await summary.boundingBox();
      assert.ok(summaryBox && summaryBox.height < (width === 1440 ? 75 : 110),
        "RFQ Hub KPI strip still too tall: " + JSON.stringify(summaryBox));
      // These test fixtures have no submitted quotes/PO. Zero stays in the
      // compact summary, not in two oversized empty sections.
      assert.equal(await page.locator("section#offerte").count(), 0);
      assert.equal(await page.locator("section#ordini").count(), 0);
      const items = await Promise.all([campaigns, distinte].map(x => x.boundingBox()));
      if (width === 1440) {
        assert.ok(Math.abs(items[0].y - items[1].y) < 10,
          "RFQ and saved Distinte should sit on the same desktop row");
      }
      await noOverflow(page, "RFQ Hub " + width);
      await page.screenshot({
        path: path.join(output, `rfq-hub-${width}.png`),
        fullPage: false, animations: "disabled",
      });
      console.log("COMM-SIMPLE1 VISUAL PASS", width, {
        commercialHeroHeight: boxes[0].height,
        worklistY: boxes[3].y,
        rfqSummaryHeight: summaryBox.height,
      });
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}
