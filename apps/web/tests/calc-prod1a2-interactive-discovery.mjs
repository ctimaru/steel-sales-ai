// CALC-PROD1A.2: production interactive discovery; no backend writes or RFQ sending.
import { chromium } from "playwright";
import fs from "node:fs/promises";
const root="https://www.smartsteelsales.com";
const languages={it:"IT",en:"GB",de:"DE",fr:"FR",es:"ES"};
const records=[];
await fs.mkdir("artifacts/calc-prod1a2",{recursive:true});
const browser=await chromium.launch({headless:true,channel:"chrome"});
try{
 for(const [lang,country] of Object.entries(languages))for(const width of [390,1440]){
   const page=await browser.newPage({viewport:{width,height:width===390?844:900},locale:`${lang}-${country}`,acceptDownloads:false});
   const record={lang,width,url:`${root}${lang==="it"?"":"/"+lang}/knowledge/tubes`,stages:{},warnings:[]};
   page.on("pageerror",e=>record.warnings.push("JavaScript: "+e.message.slice(0,150)));
   // Prevent POST/PUT/PATCH/DELETE to application API: no RFQ dispatch or durable writes.
   await page.route("**/*",route=>{
      const req=route.request();
      if(!["GET","HEAD","OPTIONS"].includes(req.method()) && new URL(req.url()).hostname.endsWith("smartsteelsales.com")) return route.abort();
      return route.continue();
   });
   try{
     const res=await page.goto(record.url,{waitUntil:"domcontentloaded",timeout:45000});
     if(!res||res.status()>=400)throw new Error("HTTP "+res?.status());
     await page.waitForTimeout(900);
     const search=page.locator('input[placeholder*="imension" i],input[placeholder*="measure" i],input[placeholder*="Abmess" i],input[placeholder*="medid" i],input[aria-label*="dimension" i],input[aria-label*="misur" i]').first();
     // Discovery must be identifiable semantically; no opportunistic random input.
     record.stages.searchLocated=await search.count()>0 && await search.isVisible();
     if(record.stages.searchLocated){
       await search.fill("100");
       await page.waitForTimeout(500);
       record.stages.searchTyped=(await search.inputValue())==="100";
       record.stages.searchUI=(await page.locator("body").innerText()).slice(0,700);
       await page.screenshot({path:`artifacts/calc-prod1a2/${lang}-${width}-search.png`,fullPage:false,animations:"disabled"});
     }else record.warnings.push("Search field not identified by stable accessible placeholder/label; manual selector review required");
     const bill=(lang==="it"?"/distinta":`/${lang}/distinta`);
     const billResponse=await page.goto(root+bill,{waitUntil:"domcontentloaded",timeout:45000});
     record.stages.billStatus=billResponse?.status();
     record.stages.billAvailable=!!billResponse && billResponse.status()<400;
     record.stages.billTitle=await page.title();
     await page.screenshot({path:`artifacts/calc-prod1a2/${lang}-${width}-bill.png`,fullPage:false,animations:"disabled"});
   }catch(err){record.warnings.push(String(err));}
   records.push(record);
   console.log(lang,width,JSON.stringify({searchLocated:record.stages.searchLocated,searchTyped:record.stages.searchTyped,billStatus:record.stages.billStatus,warnings:record.warnings}));
   await page.close();
 }
}finally{await browser.close();}
await fs.writeFile("artifacts/calc-prod1a2/results.json",JSON.stringify(records,null,2));
if(records.some(r=>r.warnings.length||!r.stages.searchTyped||!r.stages.billAvailable))process.exitCode=1;
