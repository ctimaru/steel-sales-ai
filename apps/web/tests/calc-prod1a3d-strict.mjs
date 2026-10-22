// A.3D Strict: verify independently calculated steel-tube mass and five-language real selection.
// Does not send RFQs or mutate server data.
import {chromium} from "playwright";
import fs from "node:fs/promises";
const locales=["it","en","de","fr","es"];
const rho=7850;
const od=168.3,thickness=6;
const expected=(Math.PI/4)*(od*od-(od-2*thickness)**2)*1e-6*rho;
const parseNumber=s=>Number(s.replace(/\s/g,"").replace(",","."));
const browser=await chromium.launch({headless:true,channel:"chrome"});
const records=[];
await fs.mkdir("artifacts/calc-prod1a3d",{recursive:true});
try{
 for(const lang of locales)for(const width of [390,1440]){
  const page=await browser.newPage({viewport:{width,height:width===390?844:900},acceptDownloads:false});
  const record={lang,width,expectedKgM:Number(expected.toFixed(4)),checks:{},errors:[]};
  page.on("pageerror",e=>record.errors.push("JS "+e.message.slice(0,160)));
  await page.route("**/*",r=>["GET","HEAD","OPTIONS"].includes(r.request().method())?r.continue():r.abort());
  try{
   const res=await page.goto("https://www.smartsteelsales.com"+(lang==="it"?"":"/"+lang)+"/knowledge/tubes",{waitUntil:"domcontentloaded",timeout:45000});
   if(!res||res.status()>=400)throw new Error("HTTP "+res?.status());
   const discovery=page.locator('[data-testid="calculator-dimension-discovery"]');
   const search=discovery.getByRole("searchbox");
   await search.waitFor({state:"visible",timeout:12000});
   await page.waitForTimeout(600);
   await search.fill("100");
   await page.waitForTimeout(650);
   if(await search.inputValue()!=="100")throw new Error("Unstable search input");
   // Fail-closed: this known geometry must be selectable using a *visible action button*.
   const button=discovery.locator('button[aria-label*="150"][aria-label*="100"][aria-label*="5 mm"]:visible').first();
   record.checks.actionableSelection=await button.count()>0;
   if(!record.checks.actionableSelection)throw new Error("No visible actionable 150 x 100 x 5 suggestion for "+lang);
   record.checks.selectionLabel=await button.getAttribute("aria-label");
   await button.click({timeout:8000});
   record.checks.clicked=true;
   // The CHS weight benchmark is independent of the RHS selection above.
   // Therefore only assert it if the visible calculator explicitly displays the benchmark geometry.
   const body=await page.locator("main").innerText();
   const match=body.match(/24[.,]0\d{2}\s*kg\s*\/\s*m/i);
   record.checks.chsValueText=match?.[0]??null;
   record.checks.chsGeometryVisible=/168[.,]3/.test(body)&&/\b6\s*mm\b/.test(body);
   if(record.checks.chsGeometryVisible){
     if(!match)throw new Error("CHS nominal weight not visible with benchmark geometry");
     const reported=parseNumber(match[0].match(/24[.,]0\d{2}/)[0]);
     record.checks.absoluteError=Number(Math.abs(reported-expected).toFixed(5));
     if(record.checks.absoluteError>0.03)throw new Error("CHS nominal mass differs by >0.03 kg/m");
   } else record.checks.numericStatus="NOT_ASSERTED_GEOMETRY_NOT_VERIFIED";
   await page.screenshot({path:`artifacts/calc-prod1a3d/${lang}-${width}.png`,animations:"disabled"});
  }catch(e){record.errors.push(String(e));}
  records.push(record);
  console.log(lang,width,JSON.stringify({clicked:record.checks.clicked,numeric:record.checks.numericStatus,error:record.errors}));
  await page.close();
 }
}finally{await browser.close();}
await fs.writeFile("artifacts/calc-prod1a3d/results.json",JSON.stringify(records,null,2));
if(records.some(x=>x.errors.length))process.exitCode=1;
// Numeric acceptance may remain NOT_ASSERTED even when selection succeeds; never declare it passed solely on green workflow.
