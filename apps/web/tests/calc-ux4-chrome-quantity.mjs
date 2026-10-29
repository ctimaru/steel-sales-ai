/** CALC-UX4 protected Chrome acceptance (requires local Next on :3000).
 * Shared EU calculator: all five locales, phone + desktop, real technical engine.
 */
import assert from "node:assert/strict";
import { chromium } from "playwright";
const origin=process.env.CALC_UX4_ORIGIN??"http://127.0.0.1:3000";
const browser=await chromium.launch({headless:true,channel:"chrome"});
try {
  for(const locale of ['it','en','de','fr','es']) for(const width of [320,390,1440]) {
    const context=await browser.newContext({viewport:{width,height:900},reducedMotion:"reduce"});
    await context.route("**/*",route=>route.request().url().startsWith(origin+"/")?route.continue():route.abort());
    const page=await context.newPage();
    const errors=[];page.on("pageerror",error=>errors.push(error.message));
    await page.goto(origin+(locale==="it"?"":"/"+locale)+"/knowledge/tubes",{waitUntil:"domcontentloaded",timeout:60000});
    const root=page.locator("#calcolatore-pesi[data-calculator-ready='true']");
    await root.waitFor({state:"visible"});
    const consent=page.getByTestId("mobile-cookie-consent");
    if(await consent.isVisible()) await consent.locator("button").nth(1).click();
    const fields=root.locator("[data-cockpit-measurements] input");
    await root.locator("[data-calc-shape-buttons] button").nth(1).click();
    await fields.nth(0).fill("80"); await fields.nth(1).fill("6");
    const length=root.locator("[data-cockpit-length-quantity] input").first();
    assert.equal(await length.inputValue(),"12");
    const targets=root.locator("[data-commercial-targets]");
    const metres=targets.locator("input").nth(0);
    const tonnes=targets.locator("input").nth(1);
    await metres.fill("48");
    assert.equal(await root.locator("#tube-calculator-quantity").inputValue(),"4");
    assert.equal(await targets.locator("[data-commercial-rounding]").count(),0);
    assert.ok(Number((await tonnes.inputValue()).replace(",","."))>.63);
    const action=root.locator("[data-cockpit-add]");
    const orderSummary=root.locator("[data-effective-order-summary]");
    assert.match(await orderSummary.innerText(),/4/);
    assert.match(await orderSummary.innerText(),/48/);
    if(width>=640) assert.match(await action.innerText(),/4/);
    await targets.getByRole("textbox",{name:"Prezzo €/m"}).fill("12,30");
    // Non-overrounded input maps to the exact actual total.
    assert.match(await targets.locator("[aria-live='polite']").innerText(),/590/);
    await metres.fill("49");
    assert.equal(await root.locator("#tube-calculator-quantity").inputValue(),"5");
    assert.match(await targets.locator("[data-commercial-rounding]").innerText(),/60/);
    assert.match(await orderSummary.innerText(),/60/);
    await metres.fill("48");
    await action.click();
    const bill=await page.evaluate(()=>sessionStorage.getItem("sss:inline-distinta:v1"));
    assert.ok(bill);
    const decoded=JSON.parse(bill);
    assert.ok(decoded.lines?.some(line=>line.quantityMode==="bars"&&line.quantity==="4"&&line.barLengthM==="12"),
      "The in-page bill must contain 4 x 12 m, not the previous 1 x 12 m");
    assert.ok(decoded.lines.every(line=>line.targetEurT==="" || line.targetEurT==null),
      "Commercial price remains private until separately opted in");
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
    assert.deepEqual(errors,[]);
    await context.close();
  }
} finally { await browser.close(); }
