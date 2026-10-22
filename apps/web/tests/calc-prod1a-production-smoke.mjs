// CALC-PROD1A — read-only public production smoke; never submits an RFQ.
import { chromium } from "playwright";
import fs from "node:fs/promises";
const base = "https://www.smartsteelsales.com";
const locales = ["it","en","de","fr","es"];
const sizes = [{width:320,height:750},{width:390,height:844},{width:1280,height:800},{width:1440,height:900}];
const browser = await chromium.launch({headless:true,channel:"chrome"});
const findings = [];
await fs.mkdir("artifacts/calc-prod1a",{recursive:true});
try {
  for (const locale of locales) {
    for (const viewport of sizes) {
      const path = (locale === "it" ? "" : "/" + locale) + "/knowledge/tubes";
      const page = await browser.newPage({viewport,locale:locale+"-"+({it:"IT",en:"GB",de:"DE",fr:"FR",es:"ES"}[locale])});
      const faults=[];
      page.on("pageerror",err=>faults.push("JS error: "+err.message.slice(0,180)));
      try {
        const response=await page.goto(base+path,{waitUntil:"domcontentloaded",timeout:45000});
        if (!response || response.status()>=400) throw new Error("HTTP "+response?.status());
        await page.locator("body").waitFor({state:"visible"});
        await page.waitForTimeout(1200);
        const state=await page.evaluate(()=>({
          title:document.title,
          horizontalOverflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,
          searchVisible:Array.from(document.querySelectorAll("input")).some(e=>e.getBoundingClientRect().width>0),
          mainText:document.body.innerText.slice(0,250)
        }));
        if (state.horizontalOverflow>2) faults.push("horizontal overflow "+state.horizontalOverflow+"px");
        if (!state.searchVisible) faults.push("No visible input (potential hydration/visibility failure)");
        await page.screenshot({path:`artifacts/calc-prod1a/${locale}-${viewport.width}.png`,fullPage:true,animations:"disabled"});
        findings.push({locale,viewport:viewport.width,path,...state,faults});
      }catch(e){findings.push({locale,viewport:viewport.width,path,faults:[...faults,String(e)]});}
      await page.close();
    }
  }
}finally{await browser.close();}
await fs.writeFile("artifacts/calc-prod1a/results.json",JSON.stringify(findings,null,2));
for(const f of findings)console.log(`${f.locale} ${f.viewport}px ${f.faults.length?"FAIL "+f.faults.join("; "):"PASS navigation / overflow / input"}`);
if(findings.some(f=>f.faults.length))process.exitCode=1;
