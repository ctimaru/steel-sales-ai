import {chromium} from "playwright";
import fs from "node:fs/promises";
// Public calculator session cart lifecycle, no RFQ dispatch or non-GET request.
const results=[];await fs.mkdir("artifacts/calc-prod1a3f3",{recursive:true});
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
     const buttons=await consent.getByRole("button").allTextContents();result.cookieButtons=buttons.map(x=>x.trim());
     const necessary=consent.getByRole("button",{name:/necessar|essential|erforderlich|nécessair|necesari|notwendig|essentiel|solo|uniquement/i}).first();
     if(await necessary.count())await necessary.click();
     else throw Error("Cookie banner open: necessary-only action missing");
   }
   await search.fill("100");
   result.searchValue=await search.inputValue();
   result.discoveryStatus=await panel.locator('[role="status"]').allTextContents();
   result.suggestionButtons=await panel.locator("button:visible").evaluateAll(xs=>xs.map(x=>({label:x.getAttribute("aria-label"),text:(x.innerText||"").slice(0,75)})).slice(0,15));
   const choice=panel.locator('button[aria-label*="150"][aria-label*="100"][aria-label*="5"]:visible').first();
   await choice.waitFor({state:"visible",timeout:12000});await choice.click();result.steps.push("selected");
   const add=page.locator("button[data-cockpit-add]:visible").first();
   await add.click({timeout:8000});result.steps.push("added");
   await page.getByTestId("calculator-cart-trigger").click({timeout:8000});
   let row=page.getByTestId("calculator-cart-overlay").locator("[data-distinta-compact-row]");
   if(await row.count()!==1)throw Error("Expected one cart row");
   const qty=row.locator("[data-inline-quantity] input");
   const length=row.locator("[data-inline-bar-length]");
   const beforeQty=await qty.inputValue();
   const beforeLength=await length.inputValue();
   const beforeFooter=await page.getByTestId("calculator-cart-overlay").locator("[data-distinta-sticky-footer]").innerText();
   await qty.fill("3");
   const preview=row.locator("[data-inline-draft-preview]");
   await preview.waitFor({state:"visible"});
   const first=await preview.innerText();
   if(!first.includes("36")||!first.includes("0,6601")&&!first.includes("0.6601"))throw Error("Quantity draft preview mismatch: "+first);
   if(await page.getByTestId("calculator-cart-overlay").locator("[data-distinta-sticky-footer]").innerText()!==beforeFooter)throw Error("Draft changed persisted footer before Save");
   await length.fill("10");
   const second=await preview.innerText();
   if(!second.includes("30")||!second.includes("0,5501")&&!second.includes("0.5501"))throw Error("Length draft preview mismatch: "+second);
   result.steps.push("quantity-length-preview");
   await length.fill("bad");
   const invalid=await preview.innerText();
   if(invalid.includes("30 m"))throw Error("Invalid length displays valid preview");
   result.steps.push("invalid-draft");
   await length.fill("10");
   await row.locator("[data-save-quick-quantity]").click();
   if(await qty.inputValue()!=="3"||await length.inputValue()!=="10")throw Error("Quantity and length not saved");
   if(await preview.count())throw Error("Draft preview remained after Save");
   const newFooter=await page.getByTestId("calculator-cart-overlay").locator("[data-distinta-sticky-footer]").innerText();
   if(!newFooter.includes("30"))throw Error("Saved totals did not update: "+newFooter);
   result.steps.push("combined-save");
   result.totals=newFooter;
   await page.reload({waitUntil:"domcontentloaded"});
   await page.getByTestId("calculator-cart-trigger").waitFor({state:"visible",timeout:12000});
   await page.getByTestId("calculator-cart-trigger").click();
   row=page.getByTestId("calculator-cart-overlay").locator("[data-distinta-compact-row]");
   if(await row.count()!==1||await row.locator("[data-inline-quantity] input").inputValue()!=="3"||await row.locator("[data-inline-bar-length]").inputValue()!=="10")throw Error("Saved draft not restored");
   result.steps.push("refresh-preserved");
   await row.locator("[data-distinta-row-actions] button").filter({hasText:"×"}).click();
   if(await page.getByTestId("calculator-cart-trigger").count())throw Error("Last row removal failed");
   await page.reload({waitUntil:"domcontentloaded"});await page.waitForTimeout(500);
   if(await page.getByTestId("calculator-cart-trigger").count())throw Error("Removed cart restored");
   result.steps.push("removed-and-empty-after-refresh");result.status="PASS";
   await page.screenshot({path:"artifacts/calc-prod1a3f3/"+locale+"-"+width+".png"});
  }catch(e){result.errors.push(String(e));
    result.discoveryStatus=await page.locator('[data-testid="calculator-dimension-discovery"] [role="status"]').allTextContents().catch(()=>[]);
    result.suggestionButtons=await page.locator('[data-testid="calculator-dimension-discovery"] button:visible').evaluateAll(xs=>xs.map(x=>({label:x.getAttribute("aria-label"),text:(x.innerText||"").slice(0,75)})).slice(0,15)).catch(()=>[]);
    await page.screenshot({path:"artifacts/calc-prod1a3f3/"+locale+"-"+width+"-failure.png"}).catch(()=>{});
   }
  results.push(result);console.log(locale,width,JSON.stringify(result));
  await context.close();
 }
}finally{await browser.close()}
await fs.writeFile("artifacts/calc-prod1a3f3/results.json",JSON.stringify(results,null,2));
if(results.some(r=>r.status!=="PASS"||r.errors.length))process.exitCode=1;
