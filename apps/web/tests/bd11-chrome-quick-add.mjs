import assert from "node:assert/strict";
import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true, channel: "chrome" });
try {
  for (const width of [390, 1440]) {
    const ctx = await browser.newContext({ viewport: { width, height: 860 }, reducedMotion: "reduce" });
    await ctx.route("**/*", async (route) => {
      if (!route.request().url().startsWith("http://127.0.0.1:3000")) return route.abort();
      return route.continue();
    });
    const page = await ctx.newPage();
    const response = await page.goto("http://127.0.0.1:3000/distinta", { waitUntil: "domcontentloaded", timeout: 60000 });
    assert.equal(response?.status(), 200);
    const calculator = page.locator("#calcolatore-pesi");
    const preview = page.locator("#buyer-live-preview");
    const finder=page.locator('[data-testid="calculator-dimension-discovery"]');
    await finder.getByRole("searchbox").fill("zz_unavailable_123");
    assert.match(await finder.innerText(),/Nessun risultato|Nessuna misura pubblicata/);
    await finder.getByRole("searchbox").fill("");
    assert.ok(await page.locator("svg[aria-label]").count()>0,"Mobile parametric section must be available");
    await calculator.waitFor({ state: "visible" });
    assert.equal(await preview.count(),0,"Cart starts closed");
    assert.equal(await page.locator('[data-testid="private-cart-trigger"]').count(),0);
    assert.equal(await page.locator("html").getAttribute("lang"), "it");
    await calculator.getByLabel("Numero barre").fill("3");
    await calculator.getByRole("button", { name: /Aggiungi alla distinta/ }).click();
    assert.equal(await preview.count(),0,"Adding must not auto-open the private cart");
    const cookie=page.locator('[data-testid="mobile-cookie-consent"] > button');
    if(await cookie.isVisible()) await cookie.click();
    const trigger=page.locator('[data-testid="private-cart-trigger"]');
    await trigger.click();
    await preview.locator(".bd10-preview-row").first().waitFor({state:"visible"});
    await page.keyboard.press("Escape");
    assert.equal(await preview.count(),0,"Escape closes the private cart");
    await trigger.click();
    assert.match(await preview.innerText(), /EN 10219/);
    assert.match(await preview.innerText(), /36(?:[,.]0+)? m/);
    await page.getByRole("dialog",{name:"Carrello della distinta privata"}).getByRole("button",{name:/Chiudi/}).click();
    await calculator.getByRole("button", { name: /EN 10210/ }).click();
    await calculator.getByRole("button", { name: /Aggiungi alla distinta/ }).click();
    await trigger.click();
    await page.waitForFunction(() => document.querySelectorAll("#buyer-live-preview .bd10-preview-row:not([hidden])").length === 2);
    const content = await preview.innerText();
    assert.match(content, /EN 10219/);
    assert.match(content, /EN 10210/);
    assert.match(content, /72(?:[,.]0+)? m/);
    assert.equal(await preview.locator(".bd10-preview-row").count(), 2);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 12), false);
    console.log("BD11 CHROME PASS", width, "2 mixed-norm lines, 72 m, one-click add");
    await ctx.close();
  }
} finally {
  await browser.close();
}
