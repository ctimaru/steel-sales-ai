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
      // COMM-DEALS1: Commerciale is the deal list; the assistant is closed in one row
      // above the table so the deals start in the first viewport on every width.
      await page.getByRole("heading", { name: "Richieste d'offerta", exact: true, level: 1 })
        .waitFor({ state: "visible", timeout: 60000 });
      const deals = page.getByTestId("commercial-deals-list");
      await deals.waitFor({ state: "visible", timeout: 60000 });
      assert.equal(await page.getByTestId("commercial-ai-native-shell").isVisible(), false,
        "The assistant starts closed above the deals");
      const dealBox = await deals.boundingBox();
      assert.ok(dealBox && dealBox.y < height, "Deals must start in the first viewport at " + width + ": " + dealBox?.y);
      assert.equal(await page.getByTestId("commercial-new-request").count(), 1,
        "Buyer has exactly one entry to a new request, never an automatic send");
      await noOverflow(page, "Commerciale " + width);
      // Avoid modifying the SSR search field before hydration. Playwright's
      // default caret:"hide" can temporarily insert caret-color:transparent
      // and trigger a synthetic Next.js hydration warning during screenshots.
      await page.screenshot({
        path: path.join(output, `commerciale-${width}.png`),
        fullPage: false, animations: "disabled", caret: "initial",
      });

      await page.goto(origin + "/rfq-hub", { waitUntil: "domcontentloaded", timeout: 90000 });
      await page.getByRole("heading", { name: "Centro RFQ", exact: true }).waitFor({ state: "visible", timeout: 60000 });
      if (width < 1000) {
        const header = await page.locator('[data-testid="rfq-hub-simple-workspace"] > header').boundingBox();
        assert.ok(header && header.height <= 155,
          "COMM-SIMPLE1 mobile RFQ header must not bury the list: " + header?.height);
      }
      // RFQHUB1: one list, a row per Distinta with its request state.
      const list = page.getByTestId("rfq-hub-list");
      await list.waitFor({ state: "visible", timeout: 60000 });
      for (const tab of ["attive", "da-gestire", "archiviate"]) {
        assert.equal(await page.getByTestId("rfq-hub-tab-" + tab).count(), 1, "Missing tab " + tab);
      }
      const listBox = await list.boundingBox();
      assert.ok(listBox && listBox.y < height, "Centro RFQ list must start in the first viewport: " + listBox?.y);
      assert.equal(await page.getByTestId("rfq-hub-compact-summary").count(), 0);
      await noOverflow(page, "RFQ Hub " + width);
      await page.screenshot({
        path: path.join(output, `rfq-hub-${width}.png`),
        fullPage: false, animations: "disabled", caret: "initial",
      });
      console.log("COMM-SIMPLE1 VISUAL PASS", width, {
        worklistY: dealBox.y,
        rfqListY: listBox.y,
      });
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}
