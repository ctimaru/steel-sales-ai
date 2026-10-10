/**
 * Chrome acceptance in local production-mode Next.js. No account, no writes.
 * Checks native keyboard access without JS and lazy client search with JS.
 */
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { chromium } from "playwright";

const base = process.env.PERF21_URL || "http://127.0.0.1:3000";
assert.equal(base, "http://127.0.0.1:3000");
const browser = await chromium.launch({ headless: true, channel: "chrome" });
const results = [];
async function testCase(label, fn) {
  await fn();
  results.push(label);
  console.log("PERF2.1 CHROME PASS", label);
}
try {
  const noJs = await browser.newContext({
    javaScriptEnabled: false, viewport: { width: 390, height: 844 }, locale: "it-IT",
  });
  const staticPage = await noJs.newPage();
  await testCase("mobile no-JavaScript public HTML and SEO hero", async () => {
    const response = await staticPage.goto(base, { waitUntil: "domcontentloaded", timeout: 30000 });
    assert.equal(response.status(), 200);
    await staticPage.getByRole("heading", { name: /L.intelligenza che connette/i }).waitFor();
    await staticPage.getByRole("heading", { name: /La filiera steel/i }).waitFor();
    assert.equal(await staticPage.locator('input[name="network-persona"]').count(), 4);
  });
  await testCase("radio roles work with JS disabled, one visible pane at a time", async () => {
    for (const key of ["merchant", "user", "processor", "producer", "merchant"]) {
      await staticPage.locator('label:has(input[name="network-persona"][value="' + key + '"])').click();
      assert.equal(await staticPage.locator('input[name="network-persona"][value="' + key + '"]').isChecked(), true);
      const panels = staticPage.locator(".perf21-network-panel:visible");
      assert.equal(await panels.count(), 1, "Exactly one persona panel should be visible");
      assert.equal(await panels.first().getAttribute("data-network-persona"), key);
    }
  });
  await testCase("no-JavaScript search fallback contains accessible path to /azienda", async () => {
    const fallback = staticPage.locator('[data-testid="perf21-deferred-company-lookup"]');
    assert.ok(await fallback.getByRole("link", { name: "Vai alla ricerca completa" }).count());
    assert.equal(await staticPage.locator('input[name="company_query"]').count(), 0);
  });
  await noJs.close();

  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2,
    isMobile: true, hasTouch: true, locale: "it-IT",
  });
  const page = await mobile.newPage();
  await testCase("mobile homepage with JS stays usable and bounded", async () => {
    const response = await page.goto(base, { waitUntil: "domcontentloaded", timeout: 30000 });
    assert.equal(response.status(), 200);
    await page.getByRole("heading", { name: /L.intelligenza che connette/i }).waitFor();
    const sizes = await page.evaluate(() => ({
      width: document.documentElement.clientWidth,
      total: document.documentElement.scrollWidth,
    }));
    assert.ok(sizes.total <= sizes.width + 12, "Mobile page horizontal overflow: " + JSON.stringify(sizes));
  });
  await testCase("lookup is dynamically interactive when section approached", async () => {
    await page.locator("#aziende").scrollIntoViewIfNeeded();
    const field = page.locator('input[name="company_query"]');
    await field.waitFor({ state: "visible", timeout: 30000 });
    await field.fill("Steel");
    assert.equal(await field.inputValue(), "Steel");
    assert.ok(await page.getByRole("button", { name: "Cerca azienda", exact: true }).isVisible());
  });
  await testCase("client hydration does not break native persona controls", async () => {
    await page.locator('label:has(input[name="network-persona"][value="producer"])').click();
    assert.ok(await page.locator('[data-network-persona="producer"]').isVisible());
    assert.equal(await page.locator(".perf21-network-panel:visible").count(), 1);
  });
  await testCase("mobile cookie notice stays compact and choices equally reachable", async () => {
    const dialog = page.getByRole("dialog", { name: "Cookie e privacy" });
    await dialog.waitFor({ state: "visible", timeout: 25000 });
    await fs.mkdir("/tmp/home-si5", { recursive: true });
    await page.evaluate(() => window.scrollTo(0, 0));
    for (const { width, height, maxHeight } of [
      { width: 390, height: 844, maxHeight: 220 },
      { width: 320, height: 720, maxHeight: 245 },
    ]) {
      await page.setViewportSize({ width, height });
      const bounds = await dialog.boundingBox();
      assert.ok(bounds && bounds.height <= maxHeight,
        "Consent obstructs too much of viewport: " + JSON.stringify({ width, bounds }));
      assert.ok(bounds.x >= -1 && bounds.x + bounds.width <= width + 1,
        "Consent exceeds viewport: " + JSON.stringify({ width, bounds }));
      for (const name of ["Accetta necessari", "Accetta"]) {
        const button = dialog.getByRole("button", { name, exact: true });
        const rect = await button.boundingBox();
        assert.ok(rect && rect.height >= 44, "Undersized choice: " + name);
      }
      assert.equal(await dialog.getByRole("link", { name: "Privacy", exact: true }).getAttribute("href"), "/privacy");
      assert.equal(await dialog.getByRole("link", { name: "Cookie Policy" }).getAttribute("href"), "/cookies");
      await page.screenshot({ path: "/tmp/home-si5/cookie-mobile-" + width + ".png", animations: "disabled" });
      console.log("COOKIE-MOBILE ACCEPTANCE", JSON.stringify({ width, panelHeight: Math.round(bounds.height) }));
    }
    await page.setViewportSize({ width: 390, height: 844 });
  });
  await testCase("privacy consent stays reversible with default opt-out", async () => {
    const close = page.getByRole("button", { name: "Accetta necessari", exact: true });
    await close.waitFor({ state: "visible", timeout: 25000 });
    await close.click();
    const reopen = page.getByRole("button", { name: "Riapri preferenze cookie e privacy" });
    await reopen.waitFor();
    const defaultConsent = await page.evaluate(() =>
      window.dataLayer?.find((args) => args[0] === "consent" && args[1] === "default")?.[2]?.analytics_storage
    );
    assert.equal(defaultConsent, "denied");
    const decision = () => page.evaluate(() =>
      JSON.parse(window.localStorage.getItem("sss.analytics-consent.v2") || "{}").decision
    );
    assert.equal(await decision(), "denied");
    await reopen.click();
    await page.getByRole("dialog", { name: "Cookie e privacy" }).getByRole("button", { name: "Accetta", exact: true }).click();
    assert.equal(await decision(), "granted");
    await reopen.click();
    await page.getByRole("dialog", { name: "Cookie e privacy" }).getByRole("button", { name: "Accetta necessari", exact: true }).click();
    assert.equal(await decision(), "denied");
    assert.equal(await reopen.isVisible(), true);
  });
  await mobile.close();
  console.log("PERF2.1 CHROME TOTAL", results.length, "PASS");
} finally {
  await browser.close();
}
