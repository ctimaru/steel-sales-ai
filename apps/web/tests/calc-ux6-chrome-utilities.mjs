/** CALC-UX6 — real Chrome acceptance for compact secondary tools.
 * Synthetic inputs only. No login, RFQ send or external services.
 */
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";
const base=process.env.NEXT_PUBLIC_SITE_URL||"http://127.0.0.1:3000";
const directory="/tmp/calc-ux6-utilities";
await mkdir(directory,{recursive:true});
const browser=await chromium.launch({headless:true,channel:"chrome"});
try{
 for(const locale of ['it','en','de','fr','es']) for(const width of [320,1440]){
  const context=await browser.newContext({viewport:{width,height:900},reducedMotion:"reduce",serviceWorkers:"block",permissions:["clipboard-read","clipboard-write"]});
  const page=await context.newPage(),errors=[];
  page.on("pageerror",error=>errors.push(error.message));
  const url=base+(locale==="it"?"":"/"+locale)+"/knowledge/tubes";
  const response=await page.goto(url,{waitUntil:"domcontentloaded",timeout:60000});
  assert.equal(response?.status(),200);
  const root=page.locator('#calcolatore-pesi[data-calculator-ready="true"]');
  await root.waitFor({state:"visible"});
  const consent=page.getByTestId("mobile-cookie-consent");
  if(await consent.isVisible()) await consent.locator("button").nth(1).click();
  assert.equal(await root.locator('[data-cinematic-stage] .does-not-exist').count(),0);
  assert.equal(await root.locator('[data-cockpit-details] > *').count(),2,"Only method and personal library remain");
  assert.equal(await root.locator('[data-cinematic-copy]').count(),1,"Exactly one copy result action");
  assert.equal(await root.locator('[data-calc-copy-link]').count(),1,"Link is next to main result");
  assert.equal(await root.locator('[data-calc-save-favorite]').count(),1);
  assert.equal(await root.locator('[data-cinematic-geometry] [data-section-value="area"]').count(),1);
  assert.equal(await root.locator('[data-cinematic-stage] strong').count(),1,
   "No redundant area-section row beneath the industrial image");
  const favourite=root.locator('[data-calc-save-favorite]');
  const amount=root.locator('#tube-calculator-quantity');
  await amount.fill("4");
  assert.equal(await favourite.getAttribute('aria-pressed'),"false");
  await favourite.click();
  assert.equal(await favourite.getAttribute('aria-pressed'),"true");
  const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('sss.weightCalculator.favorites.v1')||'[]'));
  assert.equal(stored.length,1,"Favorite persisted in browser storage");
  assert.equal(stored[0].quantity,"4","Save canonical full-bar quantity");
  await page.reload({waitUntil:"domcontentloaded"});
  await root.waitFor({state:"visible"});
  assert.equal(await favourite.getAttribute('aria-pressed'),"true","Favorite survives reload");
  await amount.fill("2");
  assert.equal(await favourite.getAttribute('aria-pressed'),"false","Edited calculation is distinct from saved favorite");
  const library=root.locator('[data-calc-library]');
  await library.locator('summary').click();
  const entry=library.locator('button').filter({hasText:/Ø|EN 10219|EN 10210|mm/}).last();
  await entry.click();
  assert.equal(await amount.inputValue(),"4","Restoring a saved favorite returns exact bar count");
  assert.equal(await favourite.getAttribute('aria-pressed'),"true");
  const results=root.locator('[data-cinematic-copy]');
  await results.click();
  const copied=await page.evaluate(()=>navigator.clipboard.readText());
  assert.match(copied,/kg\/m/);
  await root.locator('[data-calc-copy-link]').click();
  const shared=await page.evaluate(()=>navigator.clipboard.readText());
  assert.match(shared,/standard=/);
  assert.match(shared,/quantity=4/);
  assert.ok(!shared.includes('commercialPrice')&&!shared.includes('targetEur'),"Private commercial values never leak into shared link");
  await favourite.click();
  assert.equal(await favourite.getAttribute('aria-pressed'),"false");
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('sss.weightCalculator.favorites.v1')||'[]').length),0);
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
  assert.ok(overflow<=4,"No horizontal overflow: "+locale+" "+width+" "+overflow);
  await root.screenshot({path:`${directory}/${locale}-${width}.png`,animations:"disabled",timeout:30000});
  assert.deepEqual(errors,[],"Unexpected browser errors");
  console.log("CALC-UX6 PASS",locale,width);
  await context.close();
 }
}finally{await browser.close();}
