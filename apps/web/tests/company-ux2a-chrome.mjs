/**
 * COMPANY-UX2.A — authenticated managed workspace acceptance.
 * Run only after the Network visual fixture, against its disposable local DB.
 */
import assert from "node:assert/strict";
import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const base = process.env.DEMOTEST23_WEB_URL;
assert.equal(base, "http://127.0.0.1:3000");
assert.equal(process.env.NEXT_PUBLIC_SUPABASE_URL, "http://127.0.0.1:54321");
assert.equal(process.env.FLOW1_LOCAL_PROVIDER, "true");
assert.ok(process.env.RUNNER_TEMP);
const people = JSON.parse(readFileSync(path.join(process.env.RUNNER_TEMP, "demotest23-personas.json"), "utf8"));
const owner = people.find(person => person.id === "processor");
assert.ok(owner, "Local linked company fixture is required");
const output = path.join(process.env.RUNNER_TEMP, "netro14d-synthetic-visual");
mkdirSync(output, { recursive: true });
const sections = ["summary", "overview", "positioning", "products", "facilities", "markets", "certifications", "contacts", "stock", "inquiries"];
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  for (const width of [1440, 390, 320]) {
    const context = await browser.newContext({
      viewport: { width, height: width === 1440 ? 900 : width === 390 ? 844 : 720 },
      locale: "it-IT", reducedMotion: "reduce", serviceWorkers: "block",
    });
    try {
      await context.route("**/*", route => {
        const host = new URL(route.request().url()).hostname;
        return host === "127.0.0.1" || host === "localhost" ? route.continue() : route.abort();
      });
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", error => errors.push(error.message));
      await page.goto(base + "/login", { waitUntil: "domcontentloaded", timeout: 90000 });
      await page.locator('input[name="email"]').fill(owner.email);
      await page.locator('input[name="password"]').fill(owner.password);
      await page.getByRole("button", { name: "Accedi", exact: true }).click();
      await page.waitForURL(url => url.pathname === "/dashboard", { timeout: 90000 });
      const response = await page.goto(base + "/company/profile", { waitUntil: "domcontentloaded", timeout: 90000 });
      assert.equal(response?.status(), 200);
      const workspace = page.getByTestId("company-workspace");
      await workspace.waitFor({ state: "visible", timeout: 90000 });
      const nav = workspace.getByRole("navigation", { name: "Gestione azienda" });
      async function check(id, capture = false) {
        const panel = workspace.locator("#company-panel-" + id);
        await panel.waitFor({ state: "visible", timeout: 30000 });
        assert.equal(await nav.locator('[aria-current="page"]').getAttribute("href"), "#" + id);
        assert.equal(await workspace.locator('[id^="company-panel-"]:visible').count(), 1);
        const metrics = await page.evaluate(() => ({
          viewport: document.documentElement.clientWidth,
          document: document.documentElement.scrollWidth,
        }));
        assert.ok(metrics.document <= metrics.viewport + 2,
          "Horizontal overflow " + width + " " + id + ": " + JSON.stringify(metrics));
        if (capture) await page.screenshot({
          path: path.join(output, "company-ux2a-" + id + "-" + width + ".png"),
          fullPage: true, animations: "disabled",
        });
      }
      await check("summary", true);
      for (const id of sections.slice(1)) {
        await nav.locator('a[href="#' + id + '"]').click();
        await check(id, ["overview", "products", "stock"].includes(id));
      }
      await page.goBack();
      await check("stock");
      await page.goForward();
      await check("inquiries");
      await page.goto(base + "/network/manage#products", { waitUntil: "domcontentloaded" });
      await check("products");
      await nav.locator('a[href="#summary"]').click();
      await check("summary");
      await workspace.locator("#company-panel-summary").getByRole("link", { name: "Gestisci preferenze" }).click();
      await check("inquiries");
      // The managed stock editor must still be reachable; do not publish any data.
      await nav.locator('a[href="#stock"]').click();
      await check("stock");
      assert.equal(await page.getByTestId("network-stock-manager").count(), 1);
      assert.deepEqual(errors, [], "Uncaught browser errors at " + width);
      console.log("COMPANY-UX2.A Chrome PASS", width, "ten panels, history, deep links, stock and screenshots");
    } finally { await context.close(); }
  }
} finally { await browser.close(); }
