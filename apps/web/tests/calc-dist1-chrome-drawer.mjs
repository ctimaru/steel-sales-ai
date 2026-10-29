/** CALC-DIST1 — user-visible cart sign-off in a disposable local build.
 * No live buyer login, external messaging, or RFQ creation is executed.
 */
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";
const BASE=process.env.NEXT_PUBLIC_SITE_URL||"http://127.0.0.1:3000";
const out="/tmp/calc-dist1-visual";
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,channel:"chrome"});
try {
  for(const locale of ['it','en','de','fr','es']) for(const width of [320,390,1440]) {
    const context=await browser.newContext({viewport:{width,height:860},
      reducedMotion:"reduce",serviceWorkers:"block",permissions:["clipboard-read","clipboard-write"]});
    const page=await context.newPage(),errors=[];
    page.on("pageerror",e=>errors.push(e.message));
    const route=(locale==="it"?"":"/"+locale)+"/knowledge/tubes";
    const response=await page.goto(BASE+route,{waitUntil:"domcontentloaded",timeout:60000});
    assert.equal(response?.status(),200,"Opening calculator "+locale);
    const calc=page.locator("#calcolatore-pesi");
    await calc.locator("[data-cockpit-add]").waitFor({state:"visible"});
    const consent=page.getByTestId("mobile-cookie-consent");
    if(await consent.isVisible()) await consent.locator("button").nth(1).click();
    await calc.locator("[data-cockpit-add]").click();
    const trigger=page.getByTestId("calculator-cart-trigger");
    await trigger.waitFor({state:"visible"});
    await trigger.click();
    const drawer=page.locator("#distinta-inline-dialog");
    const article=drawer.locator("[data-distinta-compact-row]");
    await article.first().waitFor({state:"visible"});
    assert.equal(await drawer.getAttribute("data-technical-cart-variant"),"compact");
    assert.equal(await drawer.locator("[data-distinta-count-badge]").count(),1);
    assert.equal(await drawer.locator("[data-cart-back]").count(),1);
    assert.equal(await drawer.locator("[data-distinta-compact-row]").count(),1);
    // CALC-DIST3 separates copy, private save, and supplier preparation.
    assert.equal(await drawer.locator("[data-distinta-footer-actions] button").count(),3);
    assert.equal(await drawer.locator("[data-save-private-distinta]").count(),1);
    assert.equal(await drawer.locator("[data-distinta-name-field] input").count(),1);
    assert.equal(await drawer.locator("[data-commercial-saved-distinte-link]").count(),1);
    assert.equal(await drawer.locator("[data-create-inline-private-rfq]").count(),1);
    assert.equal(await drawer.locator("[data-distinta-privacy-info]").count(),1);
    assert.equal(await drawer.locator("[data-distinta-rfq-help]").count(),1);
    const labels=await article.locator("[class*=fieldLabel]").allTextContents();
    assert.ok(labels.length>=3,"Quantity/metres/tonnes must have visible titles");
    const qa=article.locator("[data-inline-quantity] input");
    assert.equal(await qa.inputValue(),"1");
    const actionButtons=article.locator("[data-distinta-row-actions] > button");
    assert.equal(await actionButtons.count(),4,"Edit, duplicate, remove and target all retained");
    const actionBoxes=await Promise.all((await actionButtons.all()).map(el=>el.boundingBox()));
    assert.ok(actionBoxes.every(b=>b&&b.height>=43.5&&b.width>=39),"44px touch actions");
    const box=await drawer.boundingBox();
    assert.ok(box&&box.width<=(width>=640?515:width+2),"Drawer width should not dominate");
    if(width===1440) assert.ok(box.height<760,"One-line drawer must not consume an empty full screen: "+box.height);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+4),false,
      "No page horizontal overflow at "+locale+" "+width);
    assert.equal(await drawer.locator("[data-distinta-privacy-info]").getAttribute("open"),null,
      "Full privacy explanation should not occupy row space by default");
    const footer=await drawer.locator("[data-distinta-sticky-footer]").boundingBox();
    assert.ok(footer&&footer.y>=box.y&&footer.y+footer.height<=box.y+box.height+2,
      "Sticky totals/primary RFQ footer stays inside drawer");
    if(locale==="it"&&width===390){
      await qa.fill("3");
      assert.equal(await drawer.locator("[data-create-inline-private-rfq]").isDisabled(),true,
        "Uncommitted quantity must block RFQ");
      await qa.press("Enter");
      assert.equal(await qa.inputValue(),"3");
      assert.equal(await drawer.locator("[data-create-inline-private-rfq]").isDisabled(),false);
      await drawer.getByRole("button",{name:/Duplica riga/}).click();
      assert.equal(await article.count(),2);
      await drawer.getByRole("button",{name:/Rimuovi riga 2/}).click();
      assert.equal(await article.count(),1);
      const privacy=drawer.locator("[data-distinta-privacy-info]");
      await privacy.locator("summary").click();
      assert.ok((await privacy.innerText()).length>50,"Full disclaimer is discoverable");
    }
    await drawer.screenshot({path:`${out}/${locale}-${width}.png`,animations:"disabled",timeout:30000});
    await page.keyboard.press("Escape");
    await drawer.waitFor({state:"detached"});
    assert.equal(await trigger.evaluate(node=>node===document.activeElement),true,
      "Closing returns keyboard focus to calculator cart");
    assert.deepEqual(errors,[],"No unhandled browser errors");
    console.log("CALC-DIST1 PASS",locale,width,"drawerWidth",Math.round(box.width));
    await context.close();
  }
} finally {await browser.close();}
