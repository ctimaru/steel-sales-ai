import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const BASE=process.env.NEXT_PUBLIC_SITE_URL||"http://127.0.0.1:3000";
await mkdir("/tmp/calc-dense1r-a",{recursive:true});
const browser=await chromium.launch({headless:true,channel:"chrome"});
try {
  for(const width of [320,390,768,1440]) {
    const context=await browser.newContext({viewport:{width,height:900},reducedMotion:"reduce",serviceWorkers:"block"});
    const page=await context.newPage();
    const result=await page.goto(BASE+"/knowledge/tubes",{waitUntil:"domcontentloaded",timeout:60000});
    assert.equal(result?.status(),200);
    const cookie=page.locator('[data-testid="mobile-cookie-consent"]');
    if(await cookie.isVisible()) await cookie.getByRole("button",{name:"Accetta necessari"}).click();
    const root=page.locator("#calcolatore-pesi"), toolbar=root.locator("[data-cockpit-toolbar]");
    const fields=root.locator("[data-cockpit-fields]"), outcomes=root.locator("[data-cockpit-results]");
    const svg=root.locator("[data-cockpit-preview] svg"), action=root.locator("[data-cockpit-add]");
    const details=root.locator("[data-cockpit-details]");
    assert.equal(await details.isVisible(),true,"Advanced tools must remain available below core cockpit");
    for(const element of [toolbar,fields,outcomes,svg,action])
      assert.equal(await element.isVisible(),true,"Cockpit landmark missing at "+width);
    assert.equal(await root.locator("[data-cockpit-controls] [aria-label]").count()>=2,true);
    const [toolbarBox,fieldsBox,resultBox,actionBox]=await Promise.all([
      toolbar.boundingBox(),fields.boundingBox(),outcomes.boundingBox(),action.boundingBox()
    ]);
    assert.ok(toolbarBox&&fieldsBox&&resultBox&&actionBox);
    assert.ok(fieldsBox.y>=toolbarBox.y+toolbarBox.height-3,"Toolbar first");
    if(width===320) {
      const norm=root.locator('[data-cockpit-controls] select[aria-label="Norma"]');
      const shape=root.locator('[data-cockpit-controls] select[aria-label="Sagoma"]');
      const boxes=await Promise.all([norm.boundingBox(),shape.boundingBox()]);
      assert.ok(boxes.every(Boolean),"Compact norm and shape selectors must render at 320px");
      assert.ok(boxes.every(box=>box.width>=100&&box.height>=44),
        "Selectors must remain readable and touch-accessible at 320px");
      assert.ok(boxes[0].x+boxes[0].width<=boxes[1].x+2,
        "Norm and shape selectors must not overlap at 320px");
      const kgBar=await root.locator('[data-cockpit-kpis] > div').first().locator('p').nth(1).boundingBox();
      assert.ok(kgBar && kgBar.height<24,"kg/bar should stay on one line at 320px");
    }
    if(width===1440) {
      assert.ok(Math.abs(fieldsBox.y-resultBox.y)<4,"Form and preview + KPI must share desktop row");
      assert.ok(Math.abs(fieldsBox.height-resultBox.height)<140,"Compact result must not stretch the measurement editor");
      assert.ok(actionBox.y-(toolbarBox.y)<430,"Primary add belongs above deferred technical tools");
      assert.ok(actionBox.y-(toolbarBox.y)<730,
        "Core action must fit condensed desktop work surface: "+Math.round(actionBox.y-toolbarBox.y));
    }
    const span=await root.evaluate(el=>({scroll:el.scrollWidth,client:el.clientWidth}));
    assert.ok(span.scroll<=span.client+8,"No horizontal cockpit overflow "+width+" "+JSON.stringify(span));
    await root.screenshot({path:"/tmp/calc-dense1r-a/cockpit-"+width+".png",animations:"disabled",timeout:25000});
    console.log("CALC-DENSE1R-A CHROME PASS",width,JSON.stringify({workHeight:Math.round(actionBox.y-toolbarBox.y),span}));
    await context.close();
  }
} finally { await browser.close(); }
