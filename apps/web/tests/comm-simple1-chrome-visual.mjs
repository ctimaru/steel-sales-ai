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
      // Current COMM-SIMPLE2 contract: accessible h1 is the hero itself,
      // the actionable priorities are conditional, and the AI/create
      // workspace precedes the private deal list on every viewport.
      const hero = page.getByTestId("comm-cine1-hero");
      const creation = page.getByTestId("comm-cine13-first-workspace");
      const attention = page.getByTestId("commercial-compact-actions");
      const ai = page.getByTestId("commercial-ai-first");
      const deals = page.getByTestId("comm-cine2-deal-cockpit");
      await hero.waitFor({ state: "attached", timeout: 60000 });
      assert.equal(await hero.evaluate(el => el.tagName), "H1");
      await creation.waitFor({ state: "visible", timeout: 60000 });
      await ai.waitFor({ state: "visible", timeout: 60000 });
      await deals.waitFor({ state: "attached", timeout: 60000 });
      const [creationBox, aiBox, dealBox] = await Promise.all(
        [creation, ai, deals].map(x => x.boundingBox()));
      assert.ok(creationBox && aiBox && dealBox, "Commerciale must render creation, AI and private deals");
      assert.ok(creationBox.y < dealBox.y,
        "Creation workspace must precede deals");
      if (await attention.count()) {
        const alertBox = await attention.boundingBox();
        assert.ok(alertBox && alertBox.y < creationBox.y,
          "Only verified priorities appear before creation");
      }
      if (width === 1440) {
        assert.ok(dealBox.y < 900, "Worklist must start in the desktop first screen: " + dealBox.y);
      } else {
        assert.ok(aiBox.y < height,
          "Mobile AI assistant must enter the first viewport: " + aiBox.y);
        if (width === 320) {
          const aiCta = page.getByTestId("commercial-ai-first-cta");
          assert.equal(await aiCta.count(), 1,
            "Buyer must have exactly one explicit chat handoff, never an automatic send");
        }
      }
      await noOverflow(page, "Commerciale " + width);
      // Avoid modifying the SSR search field before hydration. Playwright's
      // default caret:"hide" can temporarily insert caret-color:transparent
      // and trigger a synthetic Next.js hydration warning during screenshots.
      await page.screenshot({
        path: path.join(output, `commerciale-${width}.png`),
        fullPage: false, animations: "disabled", caret: "initial",
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
        fullPage: false, animations: "disabled", caret: "initial",
      });
      console.log("COMM-SIMPLE1 VISUAL PASS", width, {
        commercialHeroHeight: creationBox.height,
        worklistY: dealBox.y,
        rfqSummaryHeight: summaryBox.height,
      });
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}
