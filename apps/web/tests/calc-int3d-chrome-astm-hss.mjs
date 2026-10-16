import assert from "node:assert/strict";
import { chromium } from "playwright";
const BASE=process.env.NEXT_PUBLIC_SITE_URL || "http://127.0.0.1:3000";
const browser=await chromium.launch({headless:true,channel:"chrome"});
try{
  for(const scenario of [
    {start:"/knowledge/tubes/tubi-americani",bill:"/distinta",locale:"it",shape:"rectangular",
      header:/HSS strutturali ASTM A500/i,button:/Aggiungi HSS alla distinta RFQ/i},
    {start:"/en/knowledge/tubes/american-pipe",bill:"/en/distinta",locale:"en",shape:"square",
      header:/ASTM A500 structural HSS/i,button:/Add HSS to RFQ bill/i},
  ]){
    const context=await browser.newContext({viewport:{width:390,height:844},
      locale:scenario.locale==="it"?"it-IT":"en-GB",serviceWorkers:"block"});
    const page=await context.newPage();
    const response=await page.goto(BASE+scenario.start,{waitUntil:"domcontentloaded",timeout:60000});
    assert.equal(response?.status(),200);
    const original=await page.locator('link[rel="canonical"]').getAttribute("href");
    assert.equal(original,BASE+scenario.start);
    const selector=page.getByRole("button",{name:/HSS · ASTM A500/i});
    await selector.click();
    const hss=page.getByRole("region",{name:scenario.locale==="it"?"HSS strutturali ASTM A500":"ASTM A500 structural HSS"});
    await hss.getByRole("heading",{name:scenario.header}).waitFor({state:"visible"});
    await hss.getByRole("combobox",{name:/Sezione|Shape/i}).selectOption(scenario.shape);
    const quantity=await hss.getByText(/AISC indicative mass|Massa indicativa AISC/i).first().count();
    assert.ok(quantity>0);
    assert.match(await hss.innerText(),/0[,.]93|0\.93/);
    assert.match(await hss.innerText(),/kg\/m/);
    const add=hss.getByRole("button",{name:scenario.button});
    await page.waitForFunction(()=>!!document.querySelector("button[data-us-add-to-inline-bill]:not(:disabled)"));
    await add.click();
    const bill=page.locator("#distinta-inline");
    await bill.locator("article").first().waitFor({state:"visible",timeout:30000});
    assert.equal(new URL(page.url()).pathname,scenario.start,"US HSS must add without navigation");
    const stored=JSON.parse(await page.evaluate(()=>sessionStorage.getItem("sss:inline-distinta:v1")));
    assert.equal(stored.lines.length,1);
    assert.match(stored.lines[0].description,/HSS (Square|Rectangular)/i);
    assert.match(stored.lines[0].standard,/ASTM A500/);
    assert.match(stored.lines[0].note,/AISC A500 theoretical design-section proxy/);
    assert.match(stored.lines[0].note,/not certified/);
    assert.equal(stored.lines[0].grade,"");
    assert.equal(stored.lines[0].targetEurT,"");
    assert.ok(await bill.locator("[data-create-inline-private-rfq]").isVisible());
    assert.ok(Number(stored.lines[0].weightKgM)>0);
    assert.doesNotMatch(stored.lines[0].description,/OD 0 ×/);
    console.log("CALC-INT3D CHROME PASS",scenario.locale,scenario.shape);
    await context.close();
  }
}finally{await browser.close();}
