import assert from "node:assert/strict";
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
const BASE=process.env.NEXT_PUBLIC_SITE_URL||"http://127.0.0.1:3000";
await mkdir("/tmp/calc-dense1r-b",{recursive:true});
const browser=await chromium.launch({headless:true,channel:"chrome"});
try {
 for(const width of [320,390,768,1440]){
  const context=await browser.newContext({viewport:{width,height:900},reducedMotion:"reduce",serviceWorkers:"block"});
  const page=await context.newPage();
  const response=await page.goto(BASE+"/knowledge/tubes",{waitUntil:"domcontentloaded",timeout:60000});
  assert.equal(response?.status(),200);
  const cookie=page.locator('[data-testid="mobile-cookie-consent"]');
  if(await cookie.isVisible()) await cookie.getByRole("button",{name:"Accetta necessari"}).click();
  await page.locator("#calcolatore-pesi").getByRole("button",{name:/Aggiungi alla distinta/}).click();
  await page.locator('[data-testid="calculator-cart-trigger"]').click();
  const dialog=page.locator("#distinta-inline-dialog");
  const row=dialog.locator("[data-distinta-tabular-row]").first();
  await row.waitFor({state:"visible"});
  await dialog.getByRole("button",{name:/Duplica/}).first().click();
  await dialog.getByRole("button",{name:/Duplica/}).first().click();
  assert.equal(await dialog.locator("[data-distinta-tabular-row]").count(),3);
  const dialogBox=await dialog.boundingBox(),rowBox=await row.boundingBox();
  assert.ok(dialogBox&&rowBox);
  assert.ok(dialogBox.width <= (width>=640?465:width+2),"Cart too wide at "+width+": "+dialogBox.width);
  assert.ok(rowBox.height <= (width>=640?58:94),"Not truly tabular: row height "+rowBox.height+" at "+width);
  const buttons=await row.locator("[data-distinta-row-actions] > button").all();
  assert.equal(buttons.length,4,"Edit, duplicate, remove, target actions remain accessible directly");
  const y=await Promise.all(buttons.map(async x=>(await x.boundingBox())?.y??-1));
  assert.ok(y.every(v=>Math.abs(v-y[0])<2),"Actions wrap at "+width+": "+y.join(","));
  const sizes=await dialog.evaluate(el=>({scroll:el.scrollWidth,client:el.clientWidth}));
  assert.ok(sizes.scroll<=sizes.client+8,"Horizontal cart overflow "+width+" "+JSON.stringify(sizes));
  assert.equal(await dialog.locator("[data-inline-quantity] input").first().inputValue(),"1");
  const input=dialog.locator("[data-inline-quantity] input").first();
  await input.fill("3");
  assert.equal(await dialog.locator("[data-create-inline-private-rfq]").isDisabled(),true);
  await input.press("Enter");
  await dialog.locator("[data-save-quick-quantity]").waitFor({state:"detached"});
  assert.equal(await input.inputValue(),"3");
  await page.screenshot({path:"/tmp/calc-dense1r-b/cart-"+width+".png",animations:"disabled"});
  console.log("CALC-DENSE1R-B CHROME PASS",width,"drawer="+dialogBox.width,"row="+rowBox.height);
  await context.close();
 }
}finally{await browser.close();}
