// CALC-PROD1A.3C — fail-closed on genuine suggestion selection and independent weight sanity.
import {chromium} from "playwright";
import fs from "node:fs/promises";
const results=[], base="https://www.smartsteelsales.com";
await fs.mkdir("artifacts/calc-prod1a3c",{recursive:true});
const browser=await chromium.launch({headless:true,channel:"chrome"});
try {
for(const lang of ["it","en","de","fr","es"])for(const width of [390,1440]){
 const page=await browser.newPage({viewport:{width,height:width===390?844:900},acceptDownloads:false});
 const result={lang,width,checks:{},errors:[]};
 page.on("pageerror",e=>result.errors.push("JS: "+e.message.slice(0,180)));
 await page.route("**/*",r=>["GET","HEAD","OPTIONS"].includes(r.request().method())?r.continue():r.abort());
 try{
  const res=await page.goto(base+(lang==="it"?"":"/"+lang)+"/knowledge/tubes",{waitUntil:"domcontentloaded",timeout:45000});
  if(!res||res.status()>=400)throw new Error("HTTP "+res?.status());
  const panel=page.locator('[data-testid="calculator-dimension-discovery"]');
  const search=panel.getByRole("searchbox");
  await search.waitFor({state:"visible",timeout:12000});
  await page.waitForTimeout(500);
  await search.fill("100");
  await page.waitForTimeout(700);
  if(await search.inputValue()!=="100")throw new Error("Search input not retained");
  result.checks.searchStable=true;
  // Actual suggestion buttons are present in live DOM, with accessible name:
  // IT "Usa misura: 150 × 100 × 5 mm"; EN "Use size: ...".
  const candidate=panel.locator('button[aria-label*="150"][aria-label*="100"][aria-label*="5 mm"]');
  const visible=await candidate.count()?await candidate.first().isVisible():false;
  result.checks.suggestionAvailable=visible;
  if(["it","en"].includes(lang)){
    if(!visible)throw new Error("Expected actionable dimension suggestion missing");
    result.checks.suggestionName=await candidate.first().getAttribute("aria-label");
    await candidate.first().click({timeout:8000});
    await page.waitForTimeout(500);
    result.checks.suggestionClicked=true;
  } else result.checks.suggestionState="NO_PUBLISHED_MATCH_OR_DIFFERENT_LABEL — NOT CERTIFIED";
  const txt=await page.locator("main").innerText();
  result.checks.weightUi=txt.slice(0,4500);
  // Independent nominal CHS calculation benchmark for default 168.3x6 steel.
  // The page may switch to RHS when a suggestion is selected; don't compare RHS to CHS.
  if(!result.checks.suggestionClicked){
   const theoretical=Math.PI/4*(168.3**2-(168.3-2*6)**2)*0.00785;
   result.checks.chsBenchmark=Number(theoretical.toFixed(3));
   result.checks.weightEvidence=txt.match(/\b24[.,]0\d{2}\s*kg\s*\/\s*m/i)?.[0]??null;
   // benchmark only records evidence until geometry is explicitly confirmed in the DOM.
  }
  await page.screenshot({path:`artifacts/calc-prod1a3c/${lang}-${width}.png`,animations:"disabled"});
 }catch(e){result.errors.push(String(e));}
 results.push(result);
 console.log(lang,width,JSON.stringify({selected:result.checks.suggestionClicked,available:result.checks.suggestionAvailable,weightEvidence:result.checks.weightEvidence,errors:result.errors}));
 await page.close();
}
}finally{await browser.close();}
await fs.writeFile("artifacts/calc-prod1a3c/results.json",JSON.stringify(results,null,2));
if(results.some(r=>r.errors.length))process.exitCode=1;
// The numeric benchmark is diagnostic unless the geometry is asserted to match;
// do not claim full numeric E2E or cart acceptance from this script.
