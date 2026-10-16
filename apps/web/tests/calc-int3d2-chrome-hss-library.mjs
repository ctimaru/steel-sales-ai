import assert from "node:assert/strict";
import { chromium } from "playwright";

const BASE=process.env.NEXT_PUBLIC_SITE_URL || "http://127.0.0.1:3000";
const browser=await chromium.launch({headless:true,channel:"chrome"});
try{
  for(const spec of [
    {locale:"it",start:"/knowledge/tubes/tubi-americani",bill:"/distinta",
      shape:"rectangular",row:"x-6-4-250",atlas:"15,62",add:/Aggiungi HSS alla distinta RFQ/i,
      title:"HSS strutturali ASTM A500",library:/Libreria misure USA/},
    {locale:"en",start:"/en/knowledge/tubes/american-pipe",bill:"/en/distinta",
      shape:"square",row:"s-4-250",atlas:"12.21",add:/Add HSS to RFQ bill/i,
      title:"ASTM A500 structural HSS",library:/US size library/},
  ]){
    const context=await browser.newContext({viewport:{width:390,height:844},
      locale:spec.locale==="it"?"it-IT":"en-GB",serviceWorkers:"block"});
    const page=await context.newPage();
    const rsp=await page.goto(BASE+spec.start,{waitUntil:"domcontentloaded",timeout:60000});
    assert.equal(rsp?.status(),200);
    assert.equal(await page.locator('link[rel="canonical"]').getAttribute("href"),BASE+spec.start);
    await page.getByRole("button",{name:/HSS · ASTM A500/i}).click();
    const hss=page.getByRole("region",{name:spec.title});
    await hss.getByRole("heading",{name:spec.title}).waitFor({state:"visible"});
    await hss.getByRole("combobox",{name:/Sezione|Shape/i}).selectOption(spec.shape);
    const library=hss.getByRole("combobox",{name:spec.library});
    await library.selectOption(spec.row);
    assert.equal(await library.inputValue(),spec.row);
    assert.match(await hss.innerText(),new RegExp(spec.atlas.replace(".", "\\.").replace(",", ",")));
    assert.match(await hss.innerText(),/Atlas Tube/i);
    assert.match(await hss.innerText(),/kg\/m/);
    const sourceLink=hss.locator('a[href*="atlastube.com"]').first();
    assert.ok(await sourceLink.count()>0);
    // A dimensional edit must immediately discard source provenance.
    const thickness=hss.getByRole("textbox",{name:/Spessore nominale|Nominal wall/i});
    await thickness.fill("0.3125");
    assert.equal(await library.inputValue(),"");
    assert.equal(await hss.getByText(/Peso nominale pubblicato Atlas|Atlas published nominal weight/i).count(),0);
    await library.selectOption(spec.row);
    assert.equal(await library.inputValue(),spec.row);

    const button=hss.getByRole("button",{name:spec.add});
    await page.waitForFunction(()=>!!document.querySelector("button[data-us-add-to-inline-bill]:not(:disabled)"));
    await button.click();
    const bill=page.locator("#distinta-inline");
    await bill.locator("article").first().waitFor({state:"visible",timeout:30000});
    assert.equal(new URL(page.url()).pathname,spec.start,"US HSS must add without navigation");
    const stored=JSON.parse(await page.evaluate(()=>sessionStorage.getItem("sss:inline-distinta:v1")));
    assert.equal(stored.lines.length,1);
    assert.match(stored.lines[0].description,/HSS (Square|Rectangular)/i);
    assert.match(stored.lines[0].standard,/ASTM A500/);
    assert.match(stored.lines[0].note,/AISC A500 theoretical design-section proxy/);
    assert.match(stored.lines[0].note,/not certified/);
    assert.equal(stored.lines[0].grade,"");
    assert.equal(stored.lines[0].targetEurT,"");
    assert.ok(await bill.locator("[data-create-inline-private-rfq]").isVisible());
    assert.match(stored.lines[0].note,/Atlas Tube nominal catalog reference/);
    assert.ok(Number(stored.lines[0].weightKgM)>0);
    assert.equal(await page.evaluate(()=>sessionStorage.getItem("sss:us-pipe-rfq-handoff:v2")),null);
    console.log("CALC-INT3D.2 CHROME PASS",spec.locale,spec.row);
    await context.close();
  }
}finally{await browser.close();}
