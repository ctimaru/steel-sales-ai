// CALC-PROD1A.3 — safe interaction-contract inventory before enabling mutation-free E2E.
// Intentionally reports observations, not passing a calculation/cart E2E that has not been verified.
import {chromium} from "playwright";
import fs from "node:fs/promises";
const browser=await chromium.launch({headless:true,channel:"chrome"});
const results=[];
await fs.mkdir("artifacts/calc-prod1a3",{recursive:true});
try {
  for(const lang of ["it","en","de","fr","es"]){
    for(const width of [390,1440]){
      const page=await browser.newPage({viewport:{width,height:width===390?844:900},acceptDownloads:false});
      const path=(lang==="it"?"":"/"+lang)+"/knowledge/tubes";
      const result={lang,width,path,stages:{},errors:[]};
      page.on("pageerror",e=>result.errors.push(e.message.slice(0,180)));
      // Block all unsafe operations, regardless of host, including analytics POSTs.
      await page.route("**/*",route=>["GET","HEAD","OPTIONS"].includes(route.request().method())?route.continue():route.abort());
      try {
        const response=await page.goto("https://www.smartsteelsales.com"+path,{waitUntil:"domcontentloaded",timeout:45000});
        result.stages.http=response?.status();
        if(!response || response.status()>=400)throw new Error("HTTP "+response?.status());
        const discovery=page.locator('[data-testid="calculator-dimension-discovery"]').getByRole("searchbox");
        await discovery.waitFor({state:"visible",timeout:12000});
        await discovery.fill("100");
        await page.waitForTimeout(650);
        result.stages.searchInput=await discovery.inputValue();
        result.stages.discovery=await page.locator('[data-testid="calculator-dimension-discovery"]').evaluate(el=>({
          buttons:Array.from(el.querySelectorAll("button")).map(x=>({text:(x.innerText||"").trim().slice(0,75),label:x.getAttribute("aria-label"),disabled:x.disabled})),
          listboxCount:el.querySelectorAll('[role="listbox"],[role="option"]').length
        }));
        // Inventory actual controls without making up a selector or triggering an RFQ.
        result.stages.controls=await page.locator("main").evaluate(el=>({
          inputs:Array.from(el.querySelectorAll("input,select")).slice(0,35).map(x=>({tag:x.tagName,type:x.getAttribute("type"),role:x.getAttribute("role"),name:x.getAttribute("name"),testid:x.getAttribute("data-testid"),placeholder:x.getAttribute("placeholder")?.slice(0,100)})),
          buttons:Array.from(el.querySelectorAll("button")).slice(0,50).map(x=>({text:(x.innerText||"").trim().slice(0,85),label:x.getAttribute("aria-label"),testid:x.getAttribute("data-testid")}))
        }));
        await page.screenshot({path:`artifacts/calc-prod1a3/${lang}-${width}-discovery.png`,animations:"disabled"});
      }catch(e){result.errors.push(String(e));}
      results.push(result);
      console.log(lang,width,result.errors.length?"DIAGNOSTIC FAIL":"CONTRACT RECORDED");
      await page.close();
    }
  }
}finally{await browser.close();}
await fs.writeFile("artifacts/calc-prod1a3/contracts.json",JSON.stringify(results,null,2));
if(results.some(r=>r.errors.length||r.stages.searchInput!=="100"))process.exitCode=1;
// CAUTION: This script DOES NOT assert calculation values, cart state or RFQ conversion.
