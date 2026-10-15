/**
 * CALC-INT3C: anonymous, browser-only end-to-end acceptance of the controlled
 * US NPS/Schedule sample -> v2 tab handoff -> existing public RFQ bills.
 * Never copies/sends actual enquiries, creates accounts or writes to server.
 */
import assert from "node:assert/strict";
import { chromium } from "playwright";

const BASE=process.env.NEXT_PUBLIC_SITE_URL || "http://127.0.0.1:3000";
const browser=await chromium.launch({headless:true,channel:"chrome"});
try {
  for (const scenario of [
    {locale:"it",start:"/knowledge/tubes/tubi-americani",bill:"/distinta",
      button:/Aggiungi alla distinta RFQ/i,expected:/API Spec 5L/i},
    {locale:"en",start:"/en/knowledge/tubes/american-pipe",bill:"/en/distinta",
      button:/Add to RFQ bill/i,expected:/ASTM A106/i},
  ]) {
    const context=await browser.newContext({viewport:{width:390,height:844},locale:scenario.locale==="it"?"it-IT":"en-GB"});
    const page=await context.newPage();
    const response=await page.goto(BASE+scenario.start,{waitUntil:"domcontentloaded",timeout:60000});
    assert.equal(response?.status(),200,scenario.start);
    await page.getByRole("heading",{level:1}).first().waitFor();
    if(scenario.locale==="en"){
      await page.getByRole("combobox",{name:/Intended product specification/i}).selectOption("astm-a106");
    }
    const usButton=page.getByRole("button",{name:scenario.button});
    await usButton.waitFor({state:"visible",timeout:30000});
    assert.equal(await usButton.isDisabled(),false);
    const sourceKey="sss:us-pipe-rfq-handoff:v2";
    await usButton.click();
    await page.waitForURL(url=>url.pathname===scenario.bill,{timeout:60000});
    await page.getByText(/NPS 6/i).first().waitFor({state:"visible",timeout:30000});
    assert.match(await page.locator("body").innerText(),scenario.expected);
    if(scenario.locale==="en") {
      assert.ok(await page.getByText(/supplier confirmation required/i).first().count()>0);
      assert.ok(await page.getByText(/not API\/ASTM certification/i).first().count()>0);
      const diameter=page.getByRole("textbox",{name:/Outside diameter \(mm\)/i}).first();
      await diameter.fill("180");
      await page.waitForTimeout(100);
      assert.equal(await page.getByText(/Requested product specification — supplier confirmation required/i).count(),0,
        "Changing EN bill geometry must clear old US product designation");
    } else {
      assert.ok(await page.getByText(/API Spec 5L/i).first().count()>0);
    }
    const queued=await page.evaluate(key=>window.sessionStorage.getItem(key),sourceKey);
    assert.ok(queued===null || queued==="[]","v2 queue should be consumed after import");
    // CALC-INT3C.2: new source-backed NPS band, and user-defined geometry.
    await page.goto(BASE+scenario.start,{waitUntil:"domcontentloaded",timeout:60000});
    const npsSelect=page.getByRole("combobox",{name:scenario.locale==="it"?"NPS nominale":"Nominal pipe size"});
    await npsSelect.selectOption("2 1/2");
    assert.ok(await page.getByRole("combobox",{name:/Schedule/i}).locator('option[value="2.5-80"]').count()>0);
    await page.getByRole("button",{name:/Custom dimensions|Dimensioni libere/i}).click();
    await page.getByRole("button",{name:"in",exact:true}).click();
    await page.getByRole("textbox",{name:/Outside diameter \(in\)|Diametro esterno \(in\)/}).fill("4.5");
    await page.getByRole("textbox",{name:/Wall thickness \(in\)|Spessore \(in\)/}).fill("0.237");
    const customButton=page.getByRole("button",{name:scenario.button});
    assert.equal(await customButton.isDisabled(),false);
    await customButton.click();
    await page.waitForURL(url=>url.pathname===scenario.bill,{timeout:60000});
    // Italian RFQ deliberately requires consent to restore a previous same-tab
    // commercial draft. Confirm it before importing the new v2 handoff.
    if(scenario.locale==="it") {
      const restore=page.getByRole("button",{name:"Riprendi la distinta"});
      if(await restore.isVisible()) await restore.click();
    }
    await page.getByText(/User dimensions OD/i).first().waitFor({state:"visible",timeout:30000});
    assert.match(await page.locator("body").innerText(),/114\.3/);
    assert.match(await page.locator("body").innerText(),/API Spec 5L|ASTM A106/);
    console.log("CALC-INT3C.2 CUSTOM CHROME PASS",scenario.locale,"4.5 in × 0.237 in");
    console.log("CALC-INT3C CHROME PASS",scenario.locale,scenario.start,"→",scenario.bill);
    await context.close();
  }
} finally { await browser.close(); }
