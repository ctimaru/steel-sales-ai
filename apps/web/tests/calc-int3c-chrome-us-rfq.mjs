/**
 * CALC-USA-FLOW1: US catalog and custom geometry -> shared same-page bill
 * on the public IT/EN landing, preserving required product provenance.
 */
import assert from "node:assert/strict";
import { chromium } from "playwright";
const BASE=process.env.NEXT_PUBLIC_SITE_URL||"http://127.0.0.1:3000";
const browser=await chromium.launch({headless:true,channel:"chrome"});
try{
  for(const c of [
    {locale:"it",start:"/knowledge/tubes/tubi-americani",add:/Aggiungi alla distinta RFQ/i,standard:/API Spec 5L/i},
    {locale:"en",start:"/en/knowledge/tubes/american-pipe",add:/Add to RFQ bill/i,standard:/ASTM A106/i},
  ]){
    const context=await browser.newContext({viewport:{width:390,height:844},
      locale:c.locale==="it"?"it-IT":"en-GB",serviceWorkers:"block"});
    const page=await context.newPage();
    const response=await page.goto(BASE+c.start,{waitUntil:"domcontentloaded",timeout:60000});
    assert.equal(response?.status(),200);
    if(c.locale==="en"){
      await page.getByRole("combobox",{name:/Intended product specification/i}).selectOption("astm-a106");
    }
    const add=page.getByRole("button",{name:c.add});
    await add.waitFor({state:"visible",timeout:30000});
    await page.waitForFunction(()=>!!document.querySelector("button[data-us-add-to-inline-bill]:not(:disabled)"));
    assert.equal(await add.isDisabled(),false);
    await add.click();
    const bill=page.locator("#distinta-inline-dialog");
    if (await page.locator('[data-testid="mobile-cookie-consent"] > button').isVisible())
      await page.locator('[data-testid="mobile-cookie-consent"] > button').click();
    await page.locator('[data-testid="calculator-cart-trigger"]').click();
    await bill.locator("article").first().waitFor({state:"visible",timeout:30000});
    assert.equal(new URL(page.url()).pathname,c.start,"US calculator must stay on same page");
    const stored=JSON.parse(await page.evaluate(()=>sessionStorage.getItem("sss:inline-distinta:v1")));
    assert.equal(stored.lines.length,1);
    assert.match(stored.lines[0].description,/NPS 6/);
    assert.match(stored.lines[0].standard,c.standard);
    assert.match(stored.lines[0].note,/not certified/i);
    assert.equal(stored.lines[0].grade,"");
    assert.equal(stored.lines[0].targetEurT,"");
    assert.ok(stored.lines[0].weightKgM>0);
    assert.equal(await page.evaluate(()=>sessionStorage.getItem("sss:us-pipe-rfq-handoff:v2")),null,
      "Inline path must not create legacy transfer queue");

    await page.goto(BASE+c.start,{waitUntil:"domcontentloaded",timeout:60000});
    if(c.locale==="en") {
      await page.getByRole("combobox",{name:/Intended product specification/i}).selectOption("astm-a106");
    }
    const nps=page.getByRole("combobox",{name:c.locale==="it"?"NPS nominale":"Nominal pipe size"});
    await nps.selectOption("2 1/2");
    assert.ok(await page.getByRole("combobox",{name:/Schedule/i}).locator('option[value="2.5-80"]').count()>0);
    await page.getByRole("button",{name:/Custom dimensions|Dimensioni libere/i}).click();
    await page.getByRole("button",{name:"in",exact:true}).click();
    await page.getByRole("textbox",{name:/Outside diameter \(in\)|Diametro esterno \(in\)/}).fill("4.5");
    await page.getByRole("textbox",{name:/Wall thickness \(in\)|Spessore \(in\)/}).fill("0.237");
    await page.waitForFunction(()=>!!document.querySelector("button[data-us-add-to-inline-bill]:not(:disabled)"));
    await page.getByRole("button",{name:c.add}).click();
    await page.locator('[data-testid="calculator-cart-trigger"]').click();
    await bill.locator("article").nth(1).waitFor({state:"visible",timeout:30000});
    const two=JSON.parse(await page.evaluate(()=>sessionStorage.getItem("sss:inline-distinta:v1")));
    assert.equal(two.lines.length,2);
    assert.match(two.lines[1].description,/User dimensions OD/);
    assert.match(two.lines[1].description,/114\.3/);
    assert.match(two.lines[1].standard,c.standard);
    assert.equal(two.lines[1].targetEurT,"");
    assert.match(two.lines[1].note,/no manufacturer dimension source/);
    console.log("CALC-USA-FLOW1 NPS/CUSTOM CHROME PASS",c.locale,"shared RFQ bill, price-free and source-safe");
    await context.close();
  }
}finally{await browser.close();}
