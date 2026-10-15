/**
 * CALC-INT4 - browser acceptance on a disposable local production server.
 * All interactions are anonymous and read-only from a server perspective:
 * no RFQ is dispatched. Verify state, motion, reduced motion and SEO URLs.
 */
import assert from "node:assert/strict";
import { chromium } from "playwright";

const BASE = process.env.NEXT_PUBLIC_SITE_URL || "http://127.0.0.1:3000";
const browser = await chromium.launch({ headless: true, channel: "chrome" });

try {
  for (const spec of [
    {locale:"it",url:"/knowledge/tubes",usUrl:"/knowledge/tubes/tubi-americani",
      eu:"EUROPA",usHeading:/Seleziona un tubo NPS/i},
    {locale:"en",url:"/en/knowledge/tubes",usUrl:"/en/knowledge/tubes/american-pipe",
      eu:"EUROPE",usHeading:/Select an NPS/i},
  ]) {
    const context = await browser.newContext({
      viewport:{width:390,height:844},locale:spec.locale==="it"?"it-IT":"en-GB",
      reducedMotion:"reduce",serviceWorkers:"block",
    });
    const page = await context.newPage();
    const response=await page.goto(BASE+spec.url,{waitUntil:"domcontentloaded",timeout:60000});
    assert.equal(response?.status(),200);
    const canonical=await page.locator('link[rel="canonical"]').getAttribute("href");
    assert.equal(canonical,BASE+spec.url);
    const group=page.getByRole("group",{name:spec.locale==="it"
      ?"Scegli il calcolatore europeo o americano":"Choose EU or US calculator"});
    const eu=group.getByRole("button",{name:new RegExp(spec.eu,"i")});
    const us=group.getByRole("button",{name:/USA/i});
    assert.equal(await eu.getAttribute("aria-pressed"),"true");
    assert.equal(await us.getAttribute("aria-pressed"),"false");
    const original=page.locator("#calcolatore-pesi input").first();
    await original.waitFor({state:"visible"});
    await original.fill("153.9");
    await us.click();
    assert.equal(page.url(),BASE+spec.url,"Switch must not navigate or change canonical URL");
    assert.equal(await us.getAttribute("aria-pressed"),"true");
    await page.getByRole("heading",{name:spec.usHeading}).first().waitFor({state:"visible"});
    const select=page.getByRole("combobox",{name:spec.locale==="it"?"NPS nominale":"Nominal pipe size"});
    await select.selectOption("8");
    assert.equal(await select.inputValue(),"8");
    assert.equal(await page.locator("#calcolatore-pesi").count(),1,"EU calculator should remain mounted");
    assert.equal(await page.locator("#calcolatore-pesi").isVisible(),false,"Inactive EU must be hidden");
    await eu.click();
    const restored=page.locator("#calcolatore-pesi input").first();
    await restored.waitFor({state:"visible"});
    assert.equal(await restored.inputValue(),"153.9","EU geometry must survive region switch");
    await us.click();
    assert.equal(await select.inputValue(),"8","US NPS choice must survive return");
    await eu.focus();
    await page.keyboard.press("Enter");
    assert.equal(await eu.getAttribute("aria-pressed"),"true");
    const panels=await page.locator('[aria-hidden="true"][inert]').count();
    assert.ok(panels>=1,"Inactive panel should be inert and invisible to screen readers");
    // Reduced motion suppresses panel transforms/transitions, but preserves
    // the sliding selection indicator in its correctly selected position.
    const reduced=await page.locator('[data-active="true"]').last().evaluate(el=>getComputedStyle(el).transitionDuration);
    assert.ok(reduced.split(",").every(x=>x.trim()==="0s"),reduced);

    // SEO US landing is still an independent URL and defaults to USA mode.
    const landing=await page.goto(BASE+spec.usUrl,{waitUntil:"domcontentloaded",timeout:60000});
    assert.equal(landing?.status(),200);
    const usGroup=page.getByRole("group",{name:spec.locale==="it"
      ?"Scegli il calcolatore europeo o americano":"Choose EU or US calculator"});
    assert.equal(await usGroup.getByRole("button",{name:/USA/i}).getAttribute("aria-pressed"),"true");
    await usGroup.getByRole("button",{name:new RegExp(spec.eu,"i")}).click();
    await page.locator("#calcolatore-pesi").waitFor({state:"visible"});
    const seo=await page.locator('link[rel="canonical"]').getAttribute("href");
    assert.equal(seo,BASE+spec.usUrl);
    console.log("CALC-INT4 CHROME PASS",spec.locale,"EU <-> US state, a11y, no navigation, reduced motion");
    await context.close();
  }
} finally {
  await browser.close();
}
