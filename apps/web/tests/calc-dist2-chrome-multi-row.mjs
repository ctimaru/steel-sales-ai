/** CALC-DIST2 — read-only browser acceptance for long technical bills.
 * It uses synthetic calculator lines in disposable browser sessions only.
 * No account sign-in, supplier dispatch, campaign creation or live RFQ.
 */
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";
const BASE=process.env.NEXT_PUBLIC_SITE_URL||"http://127.0.0.1:3000";
const out="/tmp/calc-dist2-visual";
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,channel:"chrome"});
try {
  for(const locale of ['it','en','de','fr','es']) {
    for(const width of locale==="it" ? [320,390,1440] : [390]) {
      const context=await browser.newContext({viewport:{width,height:860},
        reducedMotion:"reduce",serviceWorkers:"block",permissions:["clipboard-read","clipboard-write"]});
      const page=await context.newPage(),errors=[];
      page.on("pageerror",error=>errors.push(error.message));
      const path=(locale==="it"?"":"/"+locale)+"/knowledge/tubes";
      const response=await page.goto(BASE+path,{waitUntil:"domcontentloaded",timeout:60000});
      assert.equal(response?.status(),200,"Calculator route "+locale);
      const calc=page.locator("#calcolatore-pesi");
      await calc.locator("[data-cockpit-add]").waitFor({state:"visible"});
      const consent=page.getByTestId("mobile-cookie-consent");
      if(await consent.isVisible()) await consent.locator("button").nth(1).click();
      await calc.locator("[data-cockpit-add]").click();
      const trigger=page.getByTestId("calculator-cart-trigger");
      await trigger.click();
      const drawer=page.locator("#distinta-inline-dialog");
      const rows=drawer.locator("[data-distinta-compact-row]");
      const grid=drawer.locator("[data-distinta-compact-grid]");
      assert.equal(await rows.count(),1);
      assert.equal(await grid.getAttribute("data-distinta-multi-row-mode"),"detailed");
      const duplicate=drawer.locator("[data-distinta-compact-row]").first()
        .locator("[data-distinta-row-actions] > button").nth(1);
      for(let index=1;index<10;index++) {
        await duplicate.click();
        assert.equal(await rows.count(),index+1,"Duplicate line "+(index+1));
      }
      assert.equal(await grid.getAttribute("data-distinta-multi-row-mode"),"compact");
      const detailsToggle=drawer.locator("[data-distinta-toggle-density]");
      assert.equal(await detailsToggle.count(),1);
      assert.equal(await drawer.locator("[data-distinta-batch-toolbar]").count(),1);
      const rowSize=await rows.first().boundingBox();
      assert.ok(rowSize&&rowSize.height<=180,"Dense row too tall: "+(rowSize?.height||0));
      const rowButtons=rows.first().locator("[data-distinta-row-actions] > button");
      for(const button of await rowButtons.all()) {
        const box=await button.boundingBox();
        assert.ok(box&&box.height>=43&&box.width>=39,"Fast row tools must be accessible");
      }
      assert.equal(await rows.locator("[data-inline-quantity] input").count(),10);
      assert.equal(await rows.locator("[data-inline-bar-length]").count(),10);
      const body=drawer.locator("#distinta-inline-lines");
      const overflow=await body.evaluate(element=>({scrollHeight:element.scrollHeight,clientHeight:element.clientHeight}));
      assert.ok(overflow.scrollHeight>overflow.clientHeight,"Long bill must scroll within drawer");
      const footer=drawer.locator("[data-distinta-sticky-footer]");
      const f1=await footer.boundingBox();
      await rows.last().scrollIntoViewIfNeeded();
      const f2=await footer.boundingBox();
      assert.ok(f1&&f2&&Math.abs(f1.y-f2.y)<2,"RFQ footer must remain fixed while scrolling");
      const rfq=drawer.locator("[data-create-inline-private-rfq]");
      assert.equal(await rfq.count(),1);
      const quantity=rows.first().locator("[data-inline-quantity] input");
      await quantity.fill("4");
      assert.equal(await rfq.isDisabled(),true,"No RFQ from unsaved quick quantity");
      assert.equal(await duplicate.isDisabled(),true,"Cannot duplicate a stale quantity preview");
      assert.equal(await rows.first().locator("[data-save-quick-quantity]").count(),1);
      await quantity.press("Enter");
      assert.equal(await quantity.inputValue(),"4");
      assert.equal(await rfq.isDisabled(),false);
      await rowButtons.nth(0).click();
      assert.equal(await rfq.isDisabled(),true,"Open full-row edits must be resolved");
      await rowButtons.nth(0).click();
      assert.equal(await rfq.isDisabled(),false);
      await rowButtons.nth(3).click();
      assert.equal(await rfq.isDisabled(),true,"Open private target editor blocks stale snapshot");
      await rowButtons.nth(3).click();
      assert.equal(await rfq.isDisabled(),false);
      await drawer.screenshot({path:out+"/"+locale+"-"+width+"-10-compact.png",animations:"disabled"});
      await detailsToggle.click();
      assert.equal(await grid.getAttribute("data-distinta-multi-row-mode"),"detailed");
      assert.ok((await rows.first().boundingBox()).height>rowSize.height,
        "Detailed mode must expand the line");
      await detailsToggle.click();
      assert.equal(await grid.getAttribute("data-distinta-multi-row-mode"),"compact");
      for(let count=10;count>4;count--) {
        await rows.last().locator("[data-distinta-row-actions] > button").nth(2).click();
        assert.equal(await rows.count(),count-1);
      }
      assert.equal(await grid.getAttribute("data-distinta-multi-row-mode"),"detailed");
      assert.equal(await drawer.locator("[data-distinta-toggle-density]").count(),0);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+4),false);
      assert.deepEqual(errors,[]);
      console.log("CALC-DIST2 PASS",locale,width,"denseRow",Math.round(rowSize.height));
      await context.close();
    }
  }
} finally {await browser.close();}
