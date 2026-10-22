// CALC-PROD1A.3D.1 — multilingual real suggestion + geometry-bound audit.
// Fail closed: NEVER report numeric acceptance on an unbound or missing weight.
import {chromium} from "playwright";
import fs from "node:fs/promises";
const locales=["it","en","de","fr","es"], records=[];
await fs.mkdir("artifacts/calc-prod1a3d1",{recursive:true});
const browser=await chromium.launch({headless:true,channel:"chrome"});
try{
 for(const lang of locales)for(const width of [390,1440]){
  const page=await browser.newPage({viewport:{width,height:width===390?844:900},acceptDownloads:false});
  const record={lang,width,selection:"NOT_VERIFIED",numeric:"NOT_VERIFIED",evidence:{},errors:[]};
  page.on("pageerror",e=>record.errors.push("JS: "+e.message.slice(0,140)));
  await page.route("**/*",r=>["GET","HEAD","OPTIONS"].includes(r.request().method())?r.continue():r.abort());
  try{
   const res=await page.goto("https://www.smartsteelsales.com"+(lang==="it"?"":"/"+lang)+"/knowledge/tubes",{waitUntil:"domcontentloaded",timeout:45000});
   if(!res||res.status()>=400)throw new Error("HTTP "+res?.status());
   const panel=page.locator('[data-testid="calculator-dimension-discovery"]'),search=panel.getByRole("searchbox");
   await search.waitFor({state:"visible",timeout:12000});
   await page.waitForTimeout(650);
   await search.fill("100");await page.waitForTimeout(600);
   if(await search.inputValue()!=="100")throw new Error("Search value lost");
   // UI inventory by actual interactive DOM, not translated button prefixes.
   record.evidence.buttons=await panel.locator("button:visible").evaluateAll(xs=>xs.map(x=>({
    label:x.getAttribute("aria-label"),text:(x.innerText||"").trim().slice(0,100),
    disabled:x.disabled
   })).slice(0,35));
   // A geometry-specific actionable button, independent of its translated prefix.
   const choices=panel.locator('button[aria-label*="150"][aria-label*="100"][aria-label*="5"]:visible');
   record.evidence.matchCount=await choices.count();
   if(!record.evidence.matchCount)throw new Error("No visible actual 150x100x5 dimensional suggestion");
   const choice=choices.first();record.evidence.selectionLabel=await choice.getAttribute("aria-label");
   await choice.click({timeout:6000});
   record.selection="CLICKED";
   await page.waitForTimeout(400);
   // Capture the actual selected geometry/inputs and weight UI for a subsequent numeric contract.
   record.evidence.inputs=await page.locator("main").evaluate(el=>Array.from(el.querySelectorAll("input,select")).map(x=>({
    name:x.getAttribute("name"),testid:x.getAttribute("data-testid"),value:x.value,aria:x.getAttribute("aria-label")
   })).slice(0,40));
   record.evidence.outputs=await page.locator("main").innerText().then(x=>x.slice(0,4300));
   // Different normative corner radius rules produce different RHS mass;
   // comparing an arbitrary square-corner RHS mass is NOT valid certification.
   record.numeric="NOT_VERIFIED_GEOMETRY_FORMULA_BINDING_REQUIRED";
   await page.screenshot({path:`artifacts/calc-prod1a3d1/${lang}-${width}.png`,animations:"disabled"});
  }catch(e){record.errors.push(String(e));}
  records.push(record);console.log(lang,width,JSON.stringify({selection:record.selection,numeric:record.numeric,errors:record.errors}));
  await page.close();
 }
}finally{await browser.close();}
await fs.writeFile("artifacts/calc-prod1a3d1/results.json",JSON.stringify(records,null,2));
if(records.some(r=>r.errors.length||r.selection!=="CLICKED"))process.exitCode=1;
// Numeric acceptance explicitly OPEN regardless of selector result.
