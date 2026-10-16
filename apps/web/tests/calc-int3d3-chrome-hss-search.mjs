import assert from "node:assert/strict";
import { chromium } from "playwright";

const BASE=process.env.NEXT_PUBLIC_SITE_URL || "http://127.0.0.1:3000";
const browser=await chromium.launch({headless:true,channel:"chrome"});
try{
  for(const x of [
    {locale:"it",start:"/knowledge/tubes/tubi-americani",bill:"/distinta",
      shape:"rectangular",query:"12x8",wall:"0.25",chosen:"x-12-8-250",
      search:/Cerca misura HSS/i,filter:/Spessore nominale/i,
      library:/Libreria misure USA/i,add:/Aggiungi HSS alla distinta RFQ/i},
    {locale:"en",start:"/en/knowledge/tubes/american-pipe",bill:"/en/distinta",
      shape:"square",query:"6x6",wall:"0.313",chosen:"s-6-313",
      search:/Search HSS sizes/i,filter:/Nominal wall filter/i,
      library:/US size library/i,add:/Add HSS to RFQ bill/i},
  ]){
    const context=await browser.newContext({viewport:{width:360,height:780},
      locale:x.locale==="it"?"it-IT":"en-US",serviceWorkers:"block"});
    const page=await context.newPage();
    const r=await page.goto(BASE+x.start,{waitUntil:"domcontentloaded",timeout:60000});
    assert.equal(r?.status(),200);
    assert.equal(await page.locator('link[rel="canonical"]').getAttribute("href"),BASE+x.start);
    await page.getByRole("button",{name:/HSS · ASTM A500/}).click();
    const region=page.getByRole("region",{name:x.locale==="it"?"HSS strutturali ASTM A500":"ASTM A500 structural HSS"});
    await region.getByRole("combobox",{name:/Sezione|Shape/i}).selectOption(x.shape);
    const search=region.getByRole("searchbox",{name:x.search});
    const thickness=region.getByRole("combobox",{name:x.filter});
    const select=region.getByRole("combobox",{name:x.library});
    assert.ok((await select.locator("option").count())>=11,"10 curated rows plus custom option");
    await search.fill(x.query);
    await thickness.selectOption(x.wall);
    assert.equal(await select.locator("option").count(),2,"one matching row plus custom option");
    await select.selectOption(x.chosen);
    assert.equal(await select.inputValue(),x.chosen);
    assert.match(await region.innerText(),/Atlas Tube/);
    assert.ok(await region.locator('a[href*="atlastube.com"]').count()>=1);
    await search.fill("not-a-real-hss");
    assert.equal(await select.inputValue(),x.chosen,"filters must not revoke a valid selected source");
    assert.equal(await select.locator("option").count(),2,"keep selected row as pinned option");
    assert.match(await region.innerText(),/Nessuna misura|No source-backed size/i);
    await region.getByRole("button",{name:/Azzera filtri|Clear filters/i}).click();
    assert.equal(await search.inputValue(),"");
    assert.equal(await thickness.inputValue(),"");
    assert.equal(await select.inputValue(),x.chosen);
    const wall=region.getByRole("textbox",{name:/Spessore nominale|Nominal wall/i});
    await wall.fill("0.1875");
    assert.equal(await select.inputValue(),"");
    assert.equal(await region.getByText(/Peso nominale pubblicato Atlas|Atlas published nominal weight/i).count(),0);
    await select.selectOption(x.chosen);
    assert.equal(await select.inputValue(),x.chosen);
    await page.waitForFunction(()=>!!document.querySelector("button[data-us-add-to-inline-bill]:not(:disabled)"));
    await region.getByRole("button",{name:x.add}).click();
    const bill=page.locator("#distinta-inline");
    await bill.locator("article").first().waitFor({state:"visible",timeout:30000});
    assert.equal(new URL(page.url()).pathname,x.start,"US HSS must add without navigation");
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
    assert.equal(await page.evaluate(()=>sessionStorage.getItem("sss:us-pipe-rfq-handoff:v2")),null);
    console.log("CALC-INT3D.3 SEARCH CHROME PASS",x.locale,x.chosen);
    await context.close();
  }
}finally{await browser.close();}
