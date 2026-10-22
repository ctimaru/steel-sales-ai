import {chromium} from "playwright";
import fs from "node:fs/promises";
// Public calculator session cart lifecycle, no RFQ dispatch or non-GET request.
const results=[];await fs.mkdir("artifacts/calc-prod1a3e",{recursive:true});
const browser=await chromium.launch({headless:true,channel:"chrome"});
try {
 for(const locale of ["it","en","de","fr","es"])for(const width of [390,1440]){
  const context=await browser.newContext({viewport:{width,height:width===390?844:900}});
  const page=await context.newPage();const result={locale,width,steps:[],errors:[],status:"FAIL"};
  page.on("pageerror",e=>result.errors.push("JS "+e.message.slice(0,140)));
  await page.route("**/*",r=>["GET","HEAD","OPTIONS"].includes(r.request().method())?r.continue():r.abort());
  try{
   const url="https://www.smartsteelsales.com"+(locale==="it"?"":"/"+locale)+"/knowledge/tubes";
   const res=await page.goto(url,{waitUntil:"domcontentloaded",timeout:45000});
   if(!res||res.status()>=400)throw Error("HTTP "+res?.status());
   const panel=page.locator('[data-testid="calculator-dimension-discovery"]');
   const search=panel.getByRole("searchbox");await search.waitFor({state:"visible",timeout:15000});
   await page.waitForTimeout(550);
   const consent=page.getByTestId("mobile-cookie-consent");
   if(await consent.isVisible().catch(()=>false)){
     const necessary=consent.getByRole("button",{name:/necessar|essential|erforderlich|nécessair|necesari/i}).first();
     if(await necessary.count())await necessary.click();
     else throw Error("Cookie banner open: necessary-only action missing");
   }
   await search.fill("100");
   const choice=panel.locator('button[aria-label*="150"][aria-label*="100"][aria-label*="5"]:visible').first();
   await choice.waitFor({state:"visible",timeout:18000});await choice.click();result.steps.push("selected");
   const add=page.locator("button[data-cockpit-add]:visible").first();
   await add.click({timeout:8000});result.steps.push("added");
   await page.getByTestId("calculator-cart-trigger").click({timeout:8000});
   let row=page.getByTestId("calculator-cart-overlay").locator("[data-distinta-compact-row]");
   if(await row.count()!==1)throw Error("Expected one cart row");
   const qty=row.locator("[data-inline-quantity] input");const old=await qty.inputValue();
   const next=old==="3"?"4":"3";await qty.fill(next);
   await row.locator("[data-save-quick-quantity]").click();
   if(await qty.inputValue()!==next)throw Error("Quantity save failed");
   result.steps.push("quantity-edited");
   result.totals=await page.getByTestId("calculator-cart-overlay").locator("[data-distinta-sticky-footer]").innerText();
   await page.reload({waitUntil:"domcontentloaded"});
   await page.getByTestId("calculator-cart-trigger").waitFor({state:"visible",timeout:12000});
   await page.getByTestId("calculator-cart-trigger").click();
   row=page.getByTestId("calculator-cart-overlay").locator("[data-distinta-compact-row]");
   if(await row.count()!==1||await row.locator("[data-inline-quantity] input").inputValue()!==next)throw Error("Session quantity/row not restored");
   result.steps.push("refresh-preserved");
   await row.locator("[data-distinta-row-actions] button").filter({hasText:"×"}).click();
   if(await page.getByTestId("calculator-cart-trigger").count())throw Error("Last row removal failed");
   await page.reload({waitUntil:"domcontentloaded"});await page.waitForTimeout(500);
   if(await page.getByTestId("calculator-cart-trigger").count())throw Error("Removed cart restored");
   result.steps.push("removed-and-empty-after-refresh");result.status="PASS";
   await page.screenshot({path:"artifacts/calc-prod1a3e/"+locale+"-"+width+".png"});
  }catch(e){result.errors.push(String(e))}
  results.push(result);console.log(locale,width,JSON.stringify(result));
  await context.close();
 }
}finally{await browser.close()}
await fs.writeFile("artifacts/calc-prod1a3e/results.json",JSON.stringify(results,null,2));
if(results.some(r=>r.status!=="PASS"||r.errors.length))process.exitCode=1;
