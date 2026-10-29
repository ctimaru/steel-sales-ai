/** CALC-DIST3 — non-mutating Chrome acceptance for named save and truthful RFQ CTA.
 * No authenticated data, API writes, supplier deliveries or external links are opened.
 */
import assert from "node:assert/strict";
import {mkdir} from "node:fs/promises";
import {chromium} from "playwright";
const BASE=process.env.NEXT_PUBLIC_SITE_URL||"http://127.0.0.1:3000";
const OUT="/tmp/calc-dist3-visual";
await mkdir(OUT,{recursive:true});
const browser=await chromium.launch({headless:true,channel:"chrome"});
try {
  for(const locale of ["it","en","de","fr","es"]) {
    for(const width of locale==="it"?[320,390,1440]:[390]) {
      const context=await browser.newContext({viewport:{width,height:860},reducedMotion:"reduce",serviceWorkers:"block"});
      const page=await context.newPage(),errors=[];
      page.on("pageerror",e=>errors.push(e.message));
      try {
        const path=(locale==="it"?"":"/"+locale)+"/knowledge/tubes";
        await page.goto(BASE+path,{waitUntil:"domcontentloaded",timeout:60000});
        const consent=page.getByTestId("mobile-cookie-consent");
        if(await consent.isVisible()) await consent.locator("button").nth(1).click();
        const calc=page.locator("#calcolatore-pesi");
        await calc.locator("[data-cockpit-add]").click();
        await page.getByTestId("calculator-cart-trigger").click();
        const drawer=page.locator("#distinta-inline-dialog");
        const input=drawer.locator("[data-distinta-name-field] input");
        const privateSave=drawer.locator("[data-save-private-distinta]");
        const prepare=drawer.locator("[data-create-inline-private-rfq]");
        const link=drawer.locator("[data-commercial-saved-distinte-link]");
        assert.equal(await input.count(),1);
        assert.equal(await privateSave.count(),1);
        assert.equal(await prepare.count(),1);
        assert.equal(await drawer.locator("[data-distinta-footer-actions] button").count(),3);
        assert.ok((await input.inputValue()).trim().length>0);
        assert.equal(await input.getAttribute("maxlength"),"120");
        assert.ok((await privateSave.getAttribute("aria-label")).length>0);
        assert.ok((await prepare.getAttribute("aria-label")).length>0);
        assert.notEqual(await privateSave.getAttribute("aria-label"),await prepare.getAttribute("aria-label"));
        assert.equal(await link.getAttribute("href"),"/rfq-hub/distinte");
        await input.fill("Commessa TEST-1029 / tubi sezioni miste");
        assert.equal(await input.inputValue(),"Commessa TEST-1029 / tubi sezioni miste");
        await drawer.screenshot({path:OUT+"/"+locale+"-"+width+"-named-1.png",animations:"disabled"});
        // Name is presentation state only. Clicking save without a logged-in
        // organisation may show a safe sign-in/error state; it MUST NOT create an RFQ.
        const initial=await page.evaluate(()=>JSON.parse(sessionStorage.getItem("sss:inline-distinta:v1")).lines);
        await privateSave.click();
        await drawer.locator('[role="alert"]').first().waitFor({state:"visible",timeout:15000});
        assert.equal(await drawer.locator("[data-distinta-saved-link]").count(),0);
        assert.equal(await drawer.locator("[data-create-inline-private-rfq]").count(),1);
        const after=await page.evaluate(()=>JSON.parse(sessionStorage.getItem("sss:inline-distinta:v1")).lines);
        assert.deepEqual(after,initial,"Save attempt must not mutate technical line data");
        const body=await drawer.locator("#distinta-inline-lines").evaluate(el=>({height:el.clientHeight,overflow:el.scrollHeight>el.clientHeight}));
        assert.ok(body.height>0);
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+4),false);
        assert.deepEqual(errors,[]);
        console.log("CALC-DIST3 NAMED SAVE/NO AUTO-DISPATCH PASS",locale,width);
      } finally {await context.close();}
    }
  }
} finally {await browser.close();}
