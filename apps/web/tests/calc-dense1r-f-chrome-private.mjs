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
  const cookieAction=page.getByRole("button",{name:/Accetta necessari/i}).first();
  if(await cookieAction.isVisible()) await cookieAction.click();
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
  const preludeHeight=Math.round(regionBoxes[4].y-regionBoxes[0].y);
  console.log("DENSE1R-F private prelude",width,preludeHeight);
  await shell.screenshot({path:"/tmp/calc-dense1r-f/private-"+width+".png",animations:"disabled",timeout:30000});
  assert.ok(preludeHeight<(width>=1024?280:430),"Excess pre-cockpit private chrome "+width+": "+preludeHeight+"px");
  assert.ok(regionBoxes[1].height<=100&&regionBoxes[3].height<=140,"Compact header or optional grade too tall at "+width);
  if(width<=390){
    const gradeInput=await grade.locator("input").boundingBox();
    assert.ok(gradeInput && gradeInput.width>=regionBoxes[3].width*.8,
      "Steel grade must use the available mobile width, not a cramped second column: "+width);
    const massPerBar=await cockpit.locator("[data-cockpit-kpis] > div").first().locator("p").last().boundingBox();
    assert.ok(massPerBar && massPerBar.height<=24,"Weight and kg must remain on one line at "+width);
  }
  const pageWidth=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,client:document.documentElement.clientWidth}));
  assert.ok(pageWidth.scroll<=pageWidth.client+8,"Private page overflow "+width+" "+JSON.stringify(pageWidth));
  assert.equal(await cockpit.getByRole("searchbox").count(),1,"Public/private must share dimension search semantics");
  assert.ok(await shell.getByRole("button",{name:/carrello/i}).count()>0,"Private cart remains directly reachable");
  console.log("CALC-DENSE1R-F PRIVATE CHROME PASS",width,JSON.stringify({preludeHeight:Math.round(regionBoxes[4].y-regionBoxes[0].y),barHeight:Math.round(regionBoxes[1].height)}));
  await context.close();
 }
} finally {await browser.close();}
