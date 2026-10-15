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
    assert.equal(await button.isDisabled(),false);
    await button.click();
    await page.waitForURL(url=>url.pathname===spec.bill,{timeout:60000});
    await page.getByText(/HSS (Square|Rectangular)/i).first().waitFor({state:"visible",timeout:30000});
    const text=await page.locator("body").innerText();
    assert.match(text,/ASTM A500/);
    if(spec.locale==="en"){
      assert.match(text,/Atlas Tube nominal catalog reference/);
      assert.match(text,/not certified/i);
    }else{
      const fields=await page.locator("input, textarea").evaluateAll(els=>
        els.map(el=>el.value).filter(Boolean).join(" ")
      );
      assert.match(fields,/Atlas Tube nominal catalog reference/);
      assert.doesNotMatch(text,/OD 0 ×/);
    }
    console.log("CALC-INT3D.2 CHROME PASS",spec.locale,spec.row);
    await context.close();
  }
}finally{await browser.close();}
