// CALC-PROD1A.3B — real suggestion selection + calculation UI evidence (no RFQ sending).
import { chromium } from "playwright";
import fs from "node:fs/promises";
const root="https://www.smartsteelsales.com";
const locales=["it","en","de","fr","es"];
const results=[];
await fs.mkdir("artifacts/calc-prod1a3b",{recursive:true});
const browser=await chromium.launch({headless:true,channel:"chrome"});
try {
 for(const lang of locales) for(const width of [390,1440]){
  const page=await browser.newPage({viewport:{width,height:width===390?844:900},acceptDownloads:false});
  const item={lang,width,stages:{},errors:[]};
  page.on("pageerror",e=>item.errors.push("JavaScript: "+e.message.slice(0,160)));
  await page.route("**/*",r=>["GET","HEAD","OPTIONS"].includes(r.request().method())?r.continue():r.abort());
  try {
   const response=await page.goto(root+(lang==="it"?"":"/"+lang)+"/knowledge/tubes",{waitUntil:"domcontentloaded",timeout:45000});
   if(!response||response.status()>=400) throw new Error("HTTP "+response?.status());
   const container=page.locator('[data-testid="calculator-dimension-discovery"]');
   const search=container.getByRole("searchbox");
   await search.waitFor({state:"visible",timeout:15000});
   // Initial hydration sometimes resets values on narrow viewports; settle, then assert user-entered value.
   for(let attempt=0;attempt<3;attempt++){
    await search.fill("100");
    try{await page.waitForTimeout(350);if(await search.inputValue()==="100")break;}catch{}
   }
   item.stages.searchValue=await search.inputValue();
   item.stages.searchStable=item.stages.searchValue==="100";
   if(!item.stages.searchStable) item.errors.push("Dimension search did not retain user input after retry");
   await page.waitForTimeout(400);
   const suggestions=container.getByRole("button",{name:/^(Usa misura|Use size|Maß|Utiliser|Usar)/i});
   item.stages.suggestionCount=await suggestions.count();
   item.stages.suggestionLabels=await suggestions.allTextContents().then(a=>a.slice(0,8).map(s=>s.trim().slice(0,100)));
   if(item.stages.suggestionCount){
     const choice=suggestions.first();
     item.stages.selectedSuggestion=(await choice.innerText()).trim().slice(0,120);
     await choice.click();
     await page.waitForTimeout(350);
     item.stages.selectedInput=await search.inputValue();
   }else item.stages.selection="NOT_AVAILABLE_FOR_QUERY_100";
   // Record calculated result visible to a user. Do not claim numeric correctness without mapping result units.
   item.stages.calculationEvidence=await page.locator("main").innerText().then(s=>s.slice(0,3200));
   item.stages.calculationControls=await page.locator("main").evaluate(el=>({
     outputs:Array.from(el.querySelectorAll("output,[data-testid]")).slice(0,75).map(x=>({tag:x.tagName,testid:x.getAttribute("data-testid"),text:(x.innerText||"").trim().slice(0,110)})),
     buttonLabels:Array.from(el.querySelectorAll("button")).slice(0,75).map(x=>({label:x.getAttribute("aria-label"),text:(x.innerText||"").trim().slice(0,80)}))
   }));
   await page.screenshot({path:`artifacts/calc-prod1a3b/${lang}-${width}.png`,animations:"disabled"});
  }catch(e){item.errors.push(String(e));}
  results.push(item);
  console.log(lang,width,JSON.stringify({searchStable:item.stages.searchStable,suggestions:item.stages.suggestionCount,selected:item.stages.selectedSuggestion,errors:item.errors}));
  await page.close();
 }
}finally{await browser.close();}
await fs.writeFile("artifacts/calc-prod1a3b/results.json",JSON.stringify(results,null,2));
if(results.some(r=>r.errors.length))process.exitCode=1;
// Does NOT assert numeric weight tolerance or cart mutation; evidence is for next test implementation.
