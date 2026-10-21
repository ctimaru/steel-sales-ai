import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

// CALC-DENSE1R-D: synthetic public search, no accounts, network requests or RFQ creation.
// Tests real layout geometry, not only DOM markup: historical bug pushed Norma/Sagoma
// 220px downward when a 200x100 dimension query opened the result cards.
const BASE=process.env.NEXT_PUBLIC_SITE_URL||"http://127.0.0.1:3000";
await mkdir("/tmp/calc-dense1r-d",{recursive:true});
const browser=await chromium.launch({headless:true,channel:"chrome"});
try{
  for(const width of [320,390,768,1440]){
    const context=await browser.newContext({viewport:{width,height:900},reducedMotion:"reduce",serviceWorkers:"block"});
    const page=await context.newPage();
    const response=await page.goto(BASE+"/knowledge/tubes",{waitUntil:"domcontentloaded",timeout:60000});
    assert.equal(response?.status(),200);
    const cookie=page.locator('[data-testid="mobile-cookie-consent"]');
    if(await cookie.isVisible()) await cookie.getByRole("button",{name:"Accetta necessari"}).click();
    const root=page.locator("#calcolatore-pesi");
    const toolbar=root.locator("[data-cockpit-toolbar]");
    const norms=root.locator("[data-cockpit-controls]");
    const editor=root.locator("[data-cockpit-fields]");
    const finder=root.locator('[data-testid="calculator-dimension-discovery"]');
    const input=finder.getByRole("searchbox");
    const before=await Promise.all([toolbar.boundingBox(),norms.boundingBox(),editor.boundingBox()]);
    await input.fill("200x100");
    const panel=finder.locator("[data-dense-discovery-popover]");
    await panel.waitFor({state:"visible"});
    const options=panel.getByRole("option");
    const optionCount=await options.count();
    // Local CI builds intentionally have no external published dimensions; validate
    // the empty-state overlay there. Populated selection is checked when data exists.
    const after=await Promise.all([toolbar.boundingBox(),norms.boundingBox(),editor.boundingBox(),panel.boundingBox()]);
    assert.ok(before.every(Boolean)&&after.every(Boolean),"Layout should be measurable");
    assert.ok(Math.abs(after[0].height-before[0].height)<=2,"Autocomplete must not stretch toolbar: "+width);
    assert.ok(Math.abs(after[1].y-before[1].y)<=2,"Norm / shape must not move on autocomplete: "+width);
    assert.ok(Math.abs(after[2].y-before[2].y)<=2,"Measurements must not shift on autocomplete: "+width);
    assert.ok(after[3].width<=411,"Suggestions width must be compact: "+after[3].width);
    assert.ok(after[3].x>=0&&after[3].x+after[3].width<=width+2,"Dropdown horizontal overflow: "+width);
    assert.ok(after[3].height<=270,"Suggestions should fit compact scroll surface: "+after[3].height);
    const heights=await Promise.all((await options.all()).map(async o=>(await o.boundingBox())?.height??0));
    if(optionCount){
      assert.ok(heights.every(h=>h>0&&h<=(width<640?47:42)),
        "Bulky suggestion rows at "+width+": "+heights.join(","));
    } else {
      assert.match(await panel.innerText(),/Nessun risultato|Nessuna misura pubblicata/,
        "Without public reference data the picker must have an honest empty state");
    }
    const body=await page.evaluate(()=>({width:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
    assert.ok(body.scroll<=body.width+2,"Document horizontal overflow: "+width+" "+JSON.stringify(body));
    await root.screenshot({path:"/tmp/calc-dense1r-d/search-"+width+".png",animations:"disabled"});
    if(optionCount){
      if(optionCount>=2){
        await input.press("ArrowDown");
        assert.ok((await input.getAttribute("aria-activedescendant"))?.endsWith("-item-1"),
          "ArrowDown chooses second suggestion");
      }
      assert.ok(await input.getAttribute("aria-controls"),"Search results connected to input");
      await input.press("Enter");
      await panel.waitFor({state:"detached"});
      assert.match(await input.inputValue(),/200/);
    }
    const standard=norms.getByRole("button",{name:/EN 10219/}).first();
    assert.equal(await standard.getAttribute("aria-pressed"),"true","Picking geometry must not silently change standard");
    await input.fill("200x100");
    await panel.waitFor({state:"visible"});
    await input.press("Escape");
    await panel.waitFor({state:"detached"});
    assert.equal(await input.getAttribute("aria-controls"),null,"Esc removes suggestions linkage");
    console.log("CALC-DENSE1R-D CHROME PASS",width,"publishedOptions",optionCount,"rows",heights.join(","),"toolbarHeight",after[0].height);
    await context.close();
  }
}finally{await browser.close();}
