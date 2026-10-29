/** CALC-UX5 — production-style visual sign-off on a disposable local build.
 * No production account, backend mutation, outbound RFQ or private data.
 * Browser dimensions: phone (320/390), tablet (768), desktop (1440).
 */
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";
const BASE=process.env.NEXT_PUBLIC_SITE_URL||"http://127.0.0.1:3000";
const OUT="/tmp/calc-ux5-production-visual-signoff";
await mkdir(OUT,{recursive:true});
const browser=await chromium.launch({headless:true,channel:"chrome"});
try {
 for(const locale of ['it','en','de','fr','es']) for(const width of [320,390,768,1440]) {
  const context=await browser.newContext({viewport:{width,height:900},reducedMotion:"reduce",serviceWorkers:"block"});
  const page=await context.newPage(), errors=[];
  page.on("pageerror",e=>errors.push(e.message));
  const route=(locale==="it"?"":"/"+locale)+"/knowledge/tubes";
  const response=await page.goto(BASE+route,{waitUntil:"domcontentloaded",timeout:60000});
  assert.equal(response?.status(),200,locale+" "+route);
  const consent=page.locator('[data-testid="mobile-cookie-consent"]');
  if(await consent.isVisible()) {
   const necessary=consent.getByRole("button",{name:/Accetta necessari|Necessary|essentiels|notwendige|necesarias/i});
   if(await necessary.count()) await necessary.first().click();
  }
  const calc=page.locator('#calcolatore-pesi');
  await calc.locator('[data-cockpit-add]').waitFor({state:"visible"});
  const targets=calc.locator('[data-commercial-targets]');
  assert.equal(await targets.count(),1,"There must be one visible commercial area");
  assert.equal(await calc.locator('[data-cockpit-kpis] > div').count(),3);
  const price=targets.locator('[data-commercial-price-fields] input').first();
  const priceVisual=await price.evaluate(el=>{
   const css=getComputedStyle(el);
   return {border:parseFloat(css.borderTopWidth),height:el.getBoundingClientRect().height,
     color:css.color,background:css.backgroundColor};
  });
  assert.ok(priceVisual.border>=1,"Visible price border required: "+JSON.stringify(priceVisual));
  assert.ok(priceVisual.height>=43.5,"Price inputs must be touch accessible");
  const mass=calc.locator('[data-cockpit-results] [aria-live="polite"].metric-number');
  // The live kg/m remains the dominant numerical element.
  const result=calc.locator('[data-cockpit-results]');
  const resultBox=await result.boundingBox();
  assert.ok(resultBox&&resultBox.width>=205,"Result column remains readable");
  const gallery=calc.locator('[data-cinematic-stage]');
  assert.equal(await gallery.count(),1,"One secondary industrial gallery");
  const image=gallery.locator('[data-cinematic-product] img');
  await image.scrollIntoViewIfNeeded();
  await image.evaluate(img=>img.decode());
  const imageBox=await image.boundingBox(),galleryBox=await gallery.boundingBox();
  assert.ok(imageBox&&galleryBox);
  assert.ok(imageBox.height<=185,"Industrial photo must not dominate the workstation: "+imageBox.height);
  assert.ok(galleryBox.height<=(width>=680?360:440),
    "Secondary gallery too tall: "+locale+" "+width+" "+galleryBox.height);
  if(width===1440){
   const kpiGrid=await calc.locator('[data-cockpit-kpis]').evaluate(el=>getComputedStyle(el).gridTemplateColumns.trim().split(/\s+/).length);
   assert.equal(kpiGrid,3,"Desktop KPIs should occupy a single compact row");
   // The gallery scrolls into view above. Measure both columns in the same
   // scroll position; comparing an old viewport-relative box is misleading.
   const [fields,alignedResults]=await Promise.all([
    calc.locator('[data-cockpit-fields]').boundingBox(),result.boundingBox()
   ]);
   assert.ok(fields&&alignedResults&&Math.abs(fields.y-alignedResults.y)<4,"Balanced main columns");
   const buttonBox=await calc.locator('[data-cockpit-add]').boundingBox();
   const toolbarBox=await calc.locator('[data-cockpit-toolbar]').boundingBox();
   assert.ok(buttonBox&&toolbarBox&&buttonBox.y-toolbarBox.y<430,"Primary action remains in the working viewport");
  }
  // A final visual must remain stable after a real quantity edit; the DOM has
  // one summary and one action, and commercial price never triggers a RFQ.
  const metres=targets.locator('input').first();
  await metres.fill("48");
  assert.equal(await calc.locator('#tube-calculator-quantity').inputValue(),"4");
  const summary=calc.locator('[data-effective-order-summary]');
  assert.match(await summary.innerText(),/4/);
  assert.match(await summary.innerText(),/48/);
  assert.equal(await calc.locator('[data-cockpit-add]').isEnabled(),true);
  assert.equal(await page.evaluate(()=>sessionStorage.getItem("sss:inline-distinta:v1")),null,
    "Typing a commercial target cannot silently add a line");
  const horizontalOverflow=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
  assert.ok(horizontalOverflow<=4,"No horizontalOverflow: "+locale+" "+width+" "+horizontalOverflow);
  await calc.screenshot({path:`${OUT}/${locale}-${width}.png`,animations:"disabled",timeout:30000});
  assert.deepEqual(errors,[],"Unhandled errors: "+locale+" "+width);
  console.log("CALC-UX5 VISUAL PASS",locale,width,
   "galleryHeight",Math.round(galleryBox.height),"photoHeight",Math.round(imageBox.height),
   "priceBorder",priceVisual.border,"horizontalOverflow",horizontalOverflow);
  await context.close();
 }
} finally {await browser.close();}
