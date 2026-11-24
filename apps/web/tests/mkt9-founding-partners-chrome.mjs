// Render and interact with the actual D.2 client component in isolated Chromium.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {build} from "esbuild";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";
import {chromium} from "playwright";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const out=path.join(process.env.RUNNER_TEMP||path.join(root,".next"),"mkt9d2-visual");
fs.mkdirSync(out,{recursive:true});
const cssFile=path.join(root,"app/globals.css");
const css=(await postcss([tailwind({base:root})]).process(fs.readFileSync(cssFile,"utf8"),{from:cssFile})).css;
const bundle=await build({stdin:{contents:'import React from "react"; import {createRoot} from "react-dom/client"; import {FoundingPartnersPreview} from "./components/founding-partners-preview"; createRoot(document.getElementById("root")).render(<FoundingPartnersPreview locale={document.documentElement.lang==="en"?"en":"it"}/>);',resolveDir:root,loader:"tsx"},bundle:true,write:false,platform:"browser",jsx:"automatic",tsconfig:path.join(root,"tsconfig.json"),define:{"process.env.NODE_ENV":'"production"'}});
const browser=await chromium.launch({headless:true});
const keys=["producers","distributors","end_users","processors"],prices=[0,29,49,69,89],refs=[0,39,66,94,119];
let checked=0;
try{
 for(const locale of ["it","en"]) for(const width of [1440,390,320]){
  const ctx=await browser.newContext({viewport:{width,height:900},reducedMotion:"reduce"});
  try{
   await ctx.route("**/*",r=>r.abort());
   const page=await ctx.newPage(),errors=[];
   page.on("pageerror",e=>errors.push(e.message));
   await page.setContent('<!doctype html><html lang="'+locale+'"><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="root"></div></body></html>');
   await page.addStyleTag({content:css});
   await page.addScriptTag({content:bundle.outputFiles[0].text});
   await page.getByTestId("founding-preview").waitFor();
   const price=page.getByTestId("founding-price"),reserve=page.getByTestId("founding-reserve"),preset=page.getByTestId("founding-preset");
   const asNumber=s=>Number(s.replace(/[^\d]/g,""));
   const assertPrice=async(n)=>{
     await page.waitForFunction(n=>Number(document.querySelector('[data-testid="founding-price"]').textContent.replace(/[^\d]/g,""))===n,prices[n]);
     assert.equal(await reserve.isDisabled(),true);
     const pressed=await page.locator('[data-testid^="founding-module-"][aria-pressed="true"]').count();assert.equal(pressed,n);
     if(n){assert.equal(asNumber(await page.getByTestId("founding-reference").innerText()),refs[n]);assert.equal(asNumber(await page.getByTestId("founding-difference").innerText()),(refs[n]-prices[n])*12);}
   };
   await assertPrice(0);
   assert.equal(await preset.isDisabled(),true);
   assert.equal(await page.locator("form,input,textarea").count(),0);
   assert.equal(await page.locator('a[href^="https:"],a[href*="checkout"],a[href*="register"]').count(),0);
   await page.screenshot({path:path.join(out,locale+"-"+width+"-empty.png"),fullPage:true,animations:"disabled"});
   for(let i=0;i<keys.length;i++){await page.getByTestId("founding-module-"+keys[i]).click();await assertPrice(i+1);}
   const metrics=await page.getByTestId("founding-preview").evaluate(el=>({width:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth,clipped:[...el.querySelectorAll("h1,h2,p,button,select,a")].filter(n=>{const r=n.getBoundingClientRect();return r.width>0&&(r.left< -2||r.right>document.documentElement.clientWidth+2||n.scrollWidth>n.clientWidth+2)}).map(n=>n.textContent)}));
   assert.ok(metrics.scroll<=metrics.width+2&&metrics.clipped.length===0,JSON.stringify({locale,width,metrics}));
   const colors=await page.locator('a[href="#founding-config"]').evaluate(el=>{const s=getComputedStyle(el);return {color:s.color,fill:s.webkitTextFillColor,background:s.backgroundColor};});
   assert.deepEqual(colors,{color:"rgb(18, 59, 52)",fill:"rgb(18, 59, 52)",background:"rgb(255, 255, 255)"});
   await page.screenshot({path:path.join(out,locale+"-"+width+"-full.png"),fullPage:true,animations:"disabled"});
   await page.getByTestId("founding-clear").click();await assertPrice(0);
   for(const [role,expected] of [["producer",["distributors","processors","end_users"]],["distributor",["producers","end_users","processors"]],["processor",["distributors","producers"]],["end_user",["distributors","producers"]]]){
    await page.getByTestId("founding-role").selectOption(role);await preset.click();await assertPrice(expected.length);
    for(const k of keys)assert.equal(await page.getByTestId("founding-module-"+k).getAttribute("aria-pressed"),String(expected.includes(k)));
   }
   await page.getByTestId("founding-module-producers").click();await assertPrice(1);
   await page.getByTestId("founding-module-producers").focus();await page.keyboard.press("Space");await assertPrice(2);
   await page.getByTestId("founding-clear").click();await assertPrice(0);
   assert.deepEqual(errors,[]);
   checked++;
  }finally{await ctx.close();}
 }
 console.log("MKT9D2 interactive visual PASS: "+checked+" locale/viewport combinations, price ladder, presets, clear, keyboard, no purchase or data form");
}finally{await browser.close();}
