import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const BASE=process.env.NEXT_PUBLIC_SITE_URL||"http://127.0.0.1:3000";
await mkdir("/tmp/calc-dense1r-e",{recursive:true});
const browser=await chromium.launch({headless:true,channel:"chrome"});
try {
  for(const width of [320,390,768,1440]){
    const context=await browser.newContext({viewport:{width,height:900},reducedMotion:"reduce",serviceWorkers:"block"});
    const page=await context.newPage();
    const response=await page.goto(BASE+"/knowledge/tubes",{waitUntil:"domcontentloaded",timeout:60000});
    assert.equal(response?.status(),200);
    const cookie=page.locator('[data-testid="mobile-cookie-consent"]');
    if(await cookie.isVisible()) await cookie.getByRole("button",{name:"Accetta necessari"}).click();
    const region=page.locator("[data-calc-region-switch]");
    const header=region.locator("div[class*='header']").first();
    const calc=region.locator("#calcolatore-pesi");
    const geometry=calc.locator("[data-cockpit-measurements]");
    const length=calc.locator("[data-cockpit-length-quantity]");
    const metrics=calc.locator("[data-cockpit-kpis]");
    const footer=calc.locator("[data-cockpit-feedback]");
    await geometry.waitFor({state:"visible"});
    const boxes=await Promise.all([header.boundingBox(),geometry.boundingBox(),length.boundingBox(),metrics.boundingBox()]);
    assert.ok(boxes.every(Boolean));
    if(width>=850) assert.ok(boxes[0].height<=78,"Market selector remains oversized: "+boxes[0].height);
    assert.equal(await geometry.locator("input").count(),2,"Round tube needs two geometry inputs");
    const geomCols=await geometry.evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(" ").length);
    assert.equal(geomCols,2,"Do not leave a phantom third column on round geometries at "+width);
    if(width>=640) {
      const inputs=await geometry.locator("input").all();
      const [first,second]=await Promise.all(inputs.map(x=>x.boundingBox()));
      assert.ok(first&&second&&second.x>first.x+first.width-2,"Geometry fields should align as two useful columns");
    }
    assert.equal(await footer.isVisible(),false,"Empty result status should not reserve visible blank padding");
    const pageWidth=await page.evaluate(()=>({client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
    assert.ok(pageWidth.scroll<=pageWidth.client+4,"Global overflow "+width+" "+JSON.stringify(pageWidth));
    await region.screenshot({path:"/tmp/calc-dense1r-e/cockpit-"+width+".png",animations:"disabled",timeout:30000});
    console.log("CALC-DENSE1R-E CHROME PASS",width,"regionHeader",Math.round(boxes[0].height),"geomColumns",geomCols);
    await context.close();
  }
}finally {await browser.close();}
