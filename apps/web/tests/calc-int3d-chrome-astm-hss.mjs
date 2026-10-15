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
    assert.equal(await add.isDisabled(),false);
    await add.click();
    await page.waitForURL(url=>url.pathname===scenario.bill,{timeout:60000});
    await page.getByText(/HSS (Rectangular|Square)/i).first().waitFor({state:"visible",timeout:30000});
    const pageText=await page.locator("body").innerText();
    assert.match(pageText,/ASTM A500/i);
    assert.match(pageText,/0\.93/);
    if(scenario.locale==="en"){
      assert.match(pageText,/AISC A500 HSS design-section/i);
      assert.match(pageText,/supplier confirmation required/i);
      // English output uses the same AISC mass; changing the geometry must
      // invalidate the inherited product intent rather than forging a grade.
      const width=page.getByRole("textbox",{name:/Outside side \(mm\)/i}).first();
      await width.fill("180");
      assert.equal(await page.getByText(/Requested product specification — supplier confirmation required/i).count(),0);
    }else{
      assert.doesNotMatch(pageText,/OD 0 ×/);
    }
    console.log("CALC-INT3D CHROME PASS",scenario.locale,scenario.shape);
    await context.close();
  }
}finally{await browser.close();}
