/**
 * RFQC1.16 — LOCAL-ONLY authenticated RFQ chat smoke at 1440/390/320.
 * Reuse ephemeral GoTrue persona and RFQH14.2 synthetic quote fixture.
 * No provider calls, real accounts, screenshots, logs of tokens or dispatch.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const origin = process.env.DEMOTEST23_WEB_URL;
assert.equal(origin, "http://127.0.0.1:3000", "External frontend forbidden");
assert.equal(process.env.NEXT_PUBLIC_SUPABASE_URL, "http://127.0.0.1:54321", "External Supabase forbidden");
assert.ok(process.env.RUNNER_TEMP, "Ephemeral CI runner required");
const people = JSON.parse(readFileSync(path.join(process.env.RUNNER_TEMP, "demotest23-personas.json"), "utf8"));
const buyer = people.find(person => person.id === "buyer");
assert.ok(buyer?.rfq && buyer?.email && buyer?.password && buyer?.rfqTitle);
const browser = await chromium.launch({ headless: true, channel: "chrome" });
const checks = [];

async function check(label, callback) {
  try {
    await callback();
    checks.push(label);
    console.log("RFQC1.16 LOCAL PASS", label);
  } catch (error) {
    // Never print browser state, auth tokens, private page content or credentials.
    console.error("RFQC1.16 LOCAL FAIL", label);
    throw new Error("RFQC1.16 browser acceptance failed: " + label);
  }
}

try {
  for (const width of [1440, 390, 320]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, locale: "it-IT" });
    try {
      const page = await context.newPage();
      await page.goto(origin + "/login", { waitUntil: "domcontentloaded", timeout: 90000 });
      await page.locator('input[name="email"]').fill(buyer.email);
      await page.locator('input[name="password"]').fill(buyer.password);
      await page.getByRole("button", { name: "Accedi", exact: true }).click();
      await page.waitForURL(url => url.pathname === "/dashboard", { timeout: 90000 });
      await page.goto(origin + "/rfq-hub/" + encodeURIComponent(buyer.rfq), {
        waitUntil: "domcontentloaded", timeout: 90000,
      });

      await check("buyer RFQ chat first viewport " + width, async () => {
        const work = page.getByTestId("rfqc1-chat-workspace");
        await work.waitFor({ state: "visible", timeout: 60000 });
        assert.equal(await work.getByRole("heading", { name: buyer.rfqTitle, exact: true }).count(), 1);
        assert.equal(await work.getByRole("heading", { name: "Confronto offerte", exact: true }).count(), 1);
        assert.ok(await work.getByRole("tab", { name: /DEMO Steel Manufacturing/ }).isVisible());
        assert.ok(await work.getByRole("tab", { name: /DEMO Tubes Trading/ }).isVisible());
        assert.ok(await work.locator('a[href="#rfqc1-comparison"]').count() === (width < 1280 ? 1 : 0) ||
          await work.locator('a[href="#rfqc1-comparison"]').count() === 1);
      });

      await check("supplier threads are isolated " + width, async () => {
        const work = page.getByTestId("rfqc1-chat-workspace");
        const producer = work.getByRole("tab", { name: /DEMO Steel Manufacturing/ });
        const trader = work.getByRole("tab", { name: /DEMO Tubes Trading/ });
        await producer.click();
        const thread = work.getByRole("tabpanel");
        assert.ok((await thread.innerText()).includes("735"), "Submitted synthetic quote hidden from producer thread");
        assert.ok(await thread.getByText(/Offerta ricevuta/).first().isVisible(), "Offer card missing");
        await trader.click();
        assert.ok(!(await thread.innerText()).includes("735"), "Producer quote appeared in unrelated supplier thread");
        assert.ok(!(await thread.innerText()).includes("755"), "Producer second-line quote appeared in unrelated thread");
        assert.ok(await work.getByRole("heading", { name: "Confronto offerte", exact: true }).isVisible());
      });

      await check("screen width and manual send gate " + width, async () => {
        const bounds = await page.evaluate(() => ({
          clientWidth: document.documentElement.clientWidth,
          scrollWidth: document.documentElement.scrollWidth,
        }));
        assert.ok(bounds.scrollWidth <= bounds.clientWidth + 12, "Horizontal document overflow");
        const composer = page.getByTestId("rfqc1-composer");
        assert.ok(await composer.isVisible(), "Private composer missing");
        assert.equal(await composer.getByRole("button", { name: "Confermo e invio" }).count(), 0,
          "Confirmation must not be shown before review");
        assert.ok(!(await page.locator("body").innerText()).includes("Application error: a server-side exception"));
      });
    } finally {
      await context.close();
    }
  }
  console.log("RFQC1.16 CHROME PASS", checks.length, "local-only browser checks across 1440/390/320; zero sends");
} finally {
  await browser.close();
}
