import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";

// Real tools and browser storage; no live credentials or supplier dispatch.
const origin = process.env.FLOAT1B_ORIGIN ?? "http://127.0.0.1:3000";
const artifacts = process.env.FLOAT1B_ARTIFACTS ?? "/tmp/home-calc-float1b";
await mkdir(artifacts, { recursive: true });
const browser = await chromium.launch({ headless: true,
  ...(process.env.FLOAT1B_CHROMIUM ? { executablePath: process.env.FLOAT1B_CHROMIUM } : { channel: "chrome" }) });
async function noCookieCollision(page, selector) {
  await page.waitForFunction(selector => {
    const a = document.querySelector('[data-testid="home-floating-dock"]').getBoundingClientRect();
    const b = document.querySelector(selector)?.getBoundingClientRect();
    return b && (a.bottom <= b.top || a.right <= b.left || a.left >= b.right);
  }, selector);
}
try {
  for (const locale of ["it", "en"]) for (const width of [320, 390, 768, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: "reduce" });
    await context.route("**/*", route => route.request().url().startsWith(origin + "/") ? route.continue() : route.abort());
    await context.addInitScript(() => {
      window.__floatDockShifts = [];
      new PerformanceObserver(list => {
        for (const entry of list.getEntries()) {
          if (!entry.hadRecentInput && entry.sources?.some(s => s.node?.matches?.('[data-testid="home-floating-dock"]'))) {
            window.__floatDockShifts.push(entry.value);
          }
        }
      }).observe({type: "layout-shift", buffered: true});
    });
    const page = await context.newPage();
    if (locale === "it" && width === 320) {
      // Exercise streamed HTML/late hydration on a genuine slow connection.
      const network = await context.newCDPSession(page);
      await network.send("Network.enable");
      await network.send("Network.emulateNetworkConditions", { offline:false, latency:100,
        downloadThroughput:200_000, uploadThroughput:100_000 });
    }
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(origin + (locale === "it" ? "/" : "/en"), { waitUntil: "domcontentloaded" });
    const dock = page.getByTestId("home-floating-dock");
    const weights = dock.getByRole("button", { name: locale === "it" ? "Pesi e Norme" : "Weights & Standards" });
    const request = dock.getByRole("button", { name: locale === "it" ? "Crea una richiesta" : "Create an RFQ" });
    await weights.waitFor({ state: "visible" });
    if (width <= 700) {
      const compact = await dock.evaluate(node => ({width:node.getBoundingClientRect().width,height:node.getBoundingClientRect().height}));
      assert.ok(compact.width <= 300 && compact.height <= 51, "Mobile floating buttons are sized for the viewport");
      const target = await weights.boundingBox();
      assert.ok(target.height >= 44, "Compact painted button retains its touch area");
    }
    assert.equal(await page.locator("iframe").count(), 0, "No tool loaded before intent");
    await noCookieCollision(page, '[data-testid="mobile-cookie-consent"]');
    await page.screenshot({ path: `${artifacts}/${locale}-${width}-consent.png` });
    assert.deepEqual(await page.evaluate(() => window.__floatDockShifts), [], "No initial dock layout shift");
    // Deliberate UI consent; never force a click through the banner.
    await page.getByTestId("mobile-cookie-consent").getByRole("button", {
      name: locale === "it" ? "Accetta necessari" : "Essential only", exact: true,
    }).click();
    await noCookieCollision(page, '[data-testid="privacy-reopen-button"]');
    await weights.click();
    const dialog = page.locator("#home-floating-weights");
    await page.waitForFunction(() => document.querySelector("#home-floating-weights")?.matches(":modal"));
    assert.equal(await page.evaluate(() => document.body.style.overflow), "hidden");
    assert.equal(await dialog.getByRole("button").evaluate(node => node === document.activeElement), true);
    assert.equal(await dialog.getByRole("link").getAttribute("href"), locale === "it" ? "/knowledge/tubes#calcolatore-pesi" : "/en/knowledge/tubes");
    await page.keyboard.press("Shift+Tab");
    assert.equal(await dialog.evaluate(node => node.contains(document.activeElement)), true, "Native focus containment");
    const frame = page.frameLocator("#home-floating-weights iframe");
    const calculator = frame.locator('#calcolatore-pesi[data-calculator-ready="true"]');
    await calculator.waitFor({ state: "visible", timeout: 60000 });
    const bars = calculator.getByLabel(locale === "it" ? "Numero barre" : "Number of bars", { exact: true });
    await bars.fill("3");
    if ([390, 1440].includes(width)) {
      const axe = await new AxeBuilder({page}).include("#home-floating-weights").analyze();
      const serious = axe.violations.filter(v => ["serious", "critical"].includes(v.impact));
      assert.deepEqual(serious.map(v => ({id: v.id, targets: v.nodes.map(n => n.target)})), []);
    }
    await calculator.getByRole("button", { name: locale === "it" ? /Aggiungi alla distinta/ : /Add to RFQ bill/ }).click();
    const trigger = frame.getByTestId("calculator-cart-trigger");
    await trigger.click();
    const bill = frame.locator("#distinta-inline-dialog");
    await bill.locator("article").first().waitFor({ state: "visible" });
    assert.match(await bill.innerText(), /36(?:[,.]0+)? m/);
    // The public draft must survive unavailable authentication; no fake success.
    await bill.locator("[data-create-inline-private-rfq]").click();
    await bill.getByRole("alert").waitFor({ state: "visible" });
    assert.equal(await bill.locator("article").count(), 1);
    const persisted = await page.evaluate(() => JSON.parse(sessionStorage.getItem("sss:inline-distinta:v1")));
    assert.equal(persisted.lines.length, 1);
    assert.equal(persisted.lines[0].targetEurT, "");
    await page.keyboard.press("Escape");
    await bill.waitFor({ state: "hidden" });
    assert.equal(await dialog.evaluate(node => node.open), true, "Inner cart consumes Escape first");
    await bars.focus();
    await page.keyboard.press("Escape");
    await dialog.waitFor({ state: "hidden" });
    assert.equal(await weights.evaluate(node => node === document.activeElement), true);
    assert.equal(await page.evaluate(() => document.body.style.overflow), "");
    await weights.click();
    assert.equal(await bars.inputValue(), "3", "Reopen retains unsaved input");
    await trigger.click();
    assert.equal(await bill.locator("article").count(), 1, "No duplicate on reopen");
    await page.keyboard.press("Escape");
    await dialog.getByRole("button").click();
    await request.click();
    const requestDialog = page.locator("#home-floating-request");
    const requestFrame = page.frameLocator("#home-floating-request iframe");
    const ready = locale === "it" ? requestFrame.locator('[data-buyer-draft-ready="true"]') : requestFrame.locator("[data-international-bill-workspace]");
    await ready.waitFor({ state: "visible", timeout: 60000 });
    if (locale === "en") await requestFrame.getByRole("button", {name: "+ Add another item", exact: true}).waitFor({state: "visible"});
    const editable = locale === "it"
      ? requestFrame.getByLabel("Titolo distinta", { exact: true })
      : requestFrame.locator("[data-international-bill-editor] textarea");
    await editable.fill("FLOAT1B request context");
    assert.equal(await page.locator("iframe").count(), 2);
    assert.equal(await dialog.evaluate(node => node.open), false);
    assert.equal(new URL(page.url()).pathname, locale === "it" ? "/" : "/en");
    assert.equal(await requestDialog.getByRole("link").getAttribute("href"), locale === "it" ? "/distinta" : "/en/distinta");
    await page.screenshot({ path: `${artifacts}/${locale}-${width}-request.png` });
    await requestDialog.getByRole("button").click();
    await request.click();
    await ready.waitFor({ state: "visible" });
    assert.equal(await editable.inputValue(), "FLOAT1B request context", "Request context survives close/reopen");
    await requestDialog.getByRole("button").click();
    await weights.click();
    assert.equal(await bars.inputValue(), "3", "Tool switch preserves calculator state");
    await page.screenshot({ path: `${artifacts}/${locale}-${width}-weights.png` });
    await dialog.getByRole("button").click();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    assert.equal(errors.length, 0, errors.join("\n"));
    console.log("HOME-CALC-FLOAT1B PASS", locale, width, "consent, modal, nested Escape, focus, real 36m bill, reopen and tool switch");
    await context.close();
  }
} finally { await browser.close(); }
