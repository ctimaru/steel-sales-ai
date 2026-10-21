import assert from "node:assert/strict";
import { chromium } from "playwright";

// DENSE1C: disposable local browser; no credentials or live RFQ dispatch.
const browser = await chromium.launch({headless:true,channel:"chrome"});
try {
  for (const width of [390,1440]) {
    const context = await browser.newContext({viewport:{width,height:860},reducedMotion:"reduce"});
    await context.route("**/*", route => route.request().url().startsWith("http://127.0.0.1:3000") ? route.continue() : route.abort());
    const page = await context.newPage();
    const response = await page.goto("http://127.0.0.1:3000/knowledge/tubes", {waitUntil:"domcontentloaded",timeout:60000});
    assert.equal(response?.status(),200);
    await page.locator('[data-testid="mobile-cookie-consent"]').getByRole("button",{name:"Accetta necessari"}).click();
    const calculator = page.locator("#calcolatore-pesi");
    await calculator.getByRole("button",{name:/Aggiungi alla distinta/}).click();
    await page.locator('[data-testid="calculator-cart-trigger"]').click();
    const bill = page.locator("#distinta-inline-dialog");
    const footer = bill.locator("[data-distinta-sticky-footer]");
    await footer.waitFor({state:"visible"});
    assert.equal(await bill.getAttribute("aria-modal"),"true");
    assert.equal(await bill.locator("[data-distinta-compact-row]").count(),1);
    assert.equal(await footer.locator("[data-create-inline-private-rfq]").count(),1);
    const quantity = bill.locator("[data-inline-quantity] input").first();
    assert.equal(await quantity.inputValue(),"1");
    assert.equal(await footer.getByRole("button",{name:/Copia distinta/}).isEnabled(),true);
    const before = JSON.parse(await page.evaluate(()=>sessionStorage.getItem("sss:inline-distinta:v1")));
    assert.equal(before.lines[0].quantity,"1");
    await quantity.fill("0");
    assert.equal(await footer.getByRole("button",{name:/Copia distinta/}).isDisabled(),true);
    assert.equal(await footer.locator("[data-create-inline-private-rfq]").isDisabled(),true);
    await bill.locator("[data-save-quick-quantity]").click();
    assert.equal(await quantity.inputValue(),"0","Invalid draft remains editable after failed validation.");
    assert.equal(JSON.parse(await page.evaluate(()=>sessionStorage.getItem("sss:inline-distinta:v1"))).lines[0].quantity,"1");
    await quantity.fill("2");
    await quantity.press("Enter");
    await bill.locator("[data-save-quick-quantity]").waitFor({state:"detached"});
    const saved = JSON.parse(await page.evaluate(()=>sessionStorage.getItem("sss:inline-distinta:v1")));
    assert.equal(saved.lines[0].quantity,"2");
    assert.equal(saved.lines[0].targetEurT,"");
    assert.equal(await footer.getByRole("button",{name:/Copia distinta/}).isEnabled(),true);
    assert.equal(await footer.locator("[data-create-inline-private-rfq]").isEnabled(),true);
    const dimensions = await bill.evaluate(element=>({scroll:element.scrollWidth,client:element.clientWidth}));
    assert.ok(dimensions.scroll<=dimensions.client+12,"Drawer horizontal overflow: "+JSON.stringify(dimensions));
    await bill.getByRole("button",{name:/Chiudi/}).click();
    await page.reload({waitUntil:"domcontentloaded"});
    await page.locator('[data-testid="calculator-cart-trigger"]').click();
    assert.equal(await bill.locator("[data-inline-quantity] input").first().inputValue(),"2","Saved quantity restored in the same tab.");
    console.log("CALC-DENSE1C CHROME PASS",width,"quick save, invalid draft safety, persistent footer, restore");
    await context.close();
  }
} finally { await browser.close(); }
