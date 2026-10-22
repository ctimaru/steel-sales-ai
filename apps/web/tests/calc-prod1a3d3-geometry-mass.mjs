// CALC-PROD1A.3D.3: independently compute RHS EN 10210/10219 theoretical kg/m.
// Acceptance requires a real published suggestion click AND its bound calculator output.
import {chromium} from "playwright";
import fs from "node:fs/promises";
const locales=["it","en","de","fr","es"],standards=["en10219","en10210"];
const widthMm=150,heightMm=100,wallMm=5,density=7850;
function expectedMass(standard){
  const ro=(standard==="en10219"?2:1.5)*wallMm;
  const ri=(standard==="en10219"?1:1)*wallMm;
  const area=2*wallMm*(widthMm+heightMm-2*wallMm)-(4-Math.PI)*(ro*ro-ri*ri);
  return area*density/1e6;
}
function parseKgM(text){
  const match=text.match(/(-?\d[\d\s.,]*)\s*kg\s*\/\s*m/i);
  if(!match)throw new Error("kg/m metric not found: "+text.slice(0,140));
  const raw=match[1].trim().replace(/\s/g,"");
  const decimal=raw.lastIndexOf(",")>raw.lastIndexOf(".")?",":".";
  const number=Number(raw.replace(decimal===","?/\./g:/,/g,"").replace(decimal,"."));
  if(!Number.isFinite(number))throw new Error("Invalid kg/m number "+raw);
  return number;
}
const browser=await chromium.launch({channel:"chrome",headless:true});
const records=[];await fs.mkdir("artifacts/calc-prod1a3d3",{recursive:true});
try{
 for(const locale of locales)for(const standard of standards)for(const viewport of [390,1440]){
  const page=await browser.newPage({viewport:{width:viewport,height:viewport===390?844:900},acceptDownloads:false});
  const record={locale,standard,viewport,geometry:"150x100x5 RHS",expectedKgM:Number(expectedMass(standard).toFixed(6)),status:"FAIL",errors:[]};
  page.on("pageerror",e=>record.errors.push("JS "+e.message.slice(0,130)));
  await page.route("**/*",r=>["GET","HEAD","OPTIONS"].includes(r.request().method())?r.continue():r.abort());
  try{
   const path=(locale==="it"?"":"/"+locale)+"/knowledge/tubes";
   const res=await page.goto("https://www.smartsteelsales.com"+path+"?standard="+standard,{waitUntil:"domcontentloaded",timeout:45000});
   if(!res||res.status()>=400)throw Error("HTTP "+res?.status());
   const panel=page.locator('[data-testid="calculator-dimension-discovery"]');
   const search=panel.getByRole("searchbox");await search.waitFor({state:"visible",timeout:15000});
   await page.waitForTimeout(500);await search.fill("100");
   const choice=panel.locator('button[aria-label*="150"][aria-label*="100"][aria-label*="5"]:visible').first();
   await choice.waitFor({state:"visible",timeout:10000});
   record.selectionLabel=await choice.getAttribute("aria-label");
   if(!/150\D+100\D+5\s*mm/i.test(record.selectionLabel??""))throw Error("Ambiguous dimension selection");
   await choice.click();
   const applied=await search.inputValue();
   record.appliedSearch=applied;
   if(!/150\D+100\D+5/.test(applied))throw Error("Selected RHS geometry not applied");
   const metric=page.locator(".metric-number").filter({hasText:/kg\/m/i}).first();
   await metric.waitFor({state:"visible",timeout:8000});
   const displayed=await metric.innerText();record.metric=displayed;
   const calculated=parseKgM(displayed);record.observedKgM=calculated;
   record.absoluteErrorKgM=Number(Math.abs(calculated-expectedMass(standard)).toFixed(6));
   const panelText=await metric.locator("xpath=..").innerText();
   record.standardEvidence=panelText.slice(0,220);
   if(!panelText.includes(standard==="en10219"?"10219":"10210"))throw Error("Selected calculation standard not verified near result");
   if(record.absoluteErrorKgM>0.012)throw Error("RHS geometry-bound weight differs by >0.012 kg/m");
   record.status="PASS";
   await page.screenshot({path:`artifacts/calc-prod1a3d3/${locale}-${standard}-${viewport}.png`,animations:"disabled"});
  }catch(e){record.errors.push(String(e));}
  records.push(record);console.log(locale,standard,viewport,JSON.stringify({status:record.status,observed:record.observedKgM,expected:record.expectedKgM,errors:record.errors}));
  await page.close();
 }
}finally{await browser.close();}
await fs.writeFile("artifacts/calc-prod1a3d3/results.json",JSON.stringify(records,null,2));
if(records.some(r=>r.status!=="PASS"||r.errors.length))process.exitCode=1;
