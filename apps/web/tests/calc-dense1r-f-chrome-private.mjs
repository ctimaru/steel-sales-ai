import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const BASE=process.env.NEXT_PUBLIC_SITE_URL||"http://127.0.0.1:3000";
await mkdir("/tmp/calc-dense1r-f",{recursive:true});
const browser=await chromium.launch({headless:true,channel:"chrome"});
try{
 for(const width of [320,390,768,1440]) {
  const context=await browser.newContext({viewport:{width,height:900},reducedMotion:"reduce",serviceWorkers:"block"});
  const page=await context.newPage();
  const response=await page.goto(BASE+"/distinta",{waitUntil:"domcontentloaded",timeout:60000});
  assert.equal(response?.status(),200);
  const shell=page.locator("[data-private-calculator-shell]");
  const bar=shell.locator("[data-private-calculator-toolbar]");
  const heading=shell.locator("[data-private-calculator-heading]");
  const grade=shell.locator("[data-private-calculator-grade]");
  const cockpit=shell.locator("#calcolatore-pesi");
  await cockpit.waitFor({state:"visible"});
  for(const area of [bar,heading,grade,cockpit.locator("[data-cockpit-toolbar]"),cockpit.locator("[data-cockpit-fields]"),cockpit.locator("[data-cockpit-results]")])
    assert.equal(await area.isVisible(),true,"Private workbench must expose same cockpit at "+width);
  const regionBoxes=await Promise.all([shell.boundingBox(),bar.boundingBox(),heading.boundingBox(),grade.boundingBox(),cockpit.boundingBox()]);
  assert.ok(regionBoxes.every(Boolean));
  assert.ok(regionBoxes[4].y-regionBoxes[0].y<(width>=1024?280:430),"Excess pre-cockpit private chrome "+width);
  assert.ok(regionBoxes[1].height<=100&&regionBoxes[3].height<=140,"Compact header or optional grade too tall at "+width);
  const pageWidth=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,client:document.documentElement.clientWidth}));
  assert.ok(pageWidth.scroll<=pageWidth.client+8,"Private page overflow "+width+" "+JSON.stringify(pageWidth));
  assert.equal(await cockpit.getByRole("searchbox").count(),1,"Public/private must share dimension search semantics");
  assert.ok(await shell.getByRole("button",{name:/carrello/i}).count()>0,"Private cart remains directly reachable");
  await shell.screenshot({path:"/tmp/calc-dense1r-f/private-"+width+".png",animations:"disabled",timeout:30000});
  console.log("CALC-DENSE1R-F PRIVATE CHROME PASS",width,JSON.stringify({preludeHeight:Math.round(regionBoxes[4].y-regionBoxes[0].y),barHeight:Math.round(regionBoxes[1].height)}));
  await context.close();
 }
} finally {await browser.close();}
