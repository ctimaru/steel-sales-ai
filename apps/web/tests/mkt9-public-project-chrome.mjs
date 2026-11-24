// Isolated acceptance of actual project component and Tailwind CSS; no hosted data.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { chromium } from "playwright";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const require=createRequire(import.meta.url), cache=new Map();
function load(relative) {
  if(cache.has(relative)) return cache.get(relative).exports;
  const file=path.join(root,relative), module={exports:{}};
  cache.set(relative,module);
  const output=ts.transpileModule(fs.readFileSync(file,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
  const localRequire=name=>{
    if(name==="next/link") return {__esModule:true,default:({href,children,...props})=>React.createElement("a",{href,...props},children)};
    if(name==="@/lib/community-intake-config") return {communityIntakeConfig:()=>({enabled:false}),communityPath:(locale,kind)=>(locale==="en"?"/en/project/interest":"/progetto/interesse")+"?kind="+kind};
    if(name.startsWith("@/")) return load(name.slice(2)+".ts");
    if(name.startsWith(".")) return load(path.join(path.dirname(relative),name+".tsx"));
    return require(name);
  };
  new Function("require","module","exports",output)(localRequire,module,module.exports);
  return module.exports;
}
const {PublicProjectPage}=load("components/public-project-page.tsx");
const cssFile=path.join(root,"app/globals.css");
const css=(await postcss([tailwind({base:root})]).process(fs.readFileSync(cssFile,"utf8"),{from:cssFile})).css;
const out=path.join(process.env.RUNNER_TEMP||path.join(root,".next"),"mkt9b-visual");
fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true});
let checked=0;
try {
 for(const locale of ["it","en"]) for(const width of [1440,390,320]){
  const ctx=await browser.newContext({viewport:{width,height:900},reducedMotion:"reduce"});
  try{
   await ctx.route("**/*",r=>r.abort());
   const page=await ctx.newPage(), errors=[];
   page.on("pageerror",e=>errors.push(e.message));
   await page.setContent('<!doctype html><html lang="'+locale+'"><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body>'+renderToStaticMarkup(React.createElement(PublicProjectPage,{locale}))+'</body></html>');
   await page.addStyleTag({content:css});
   const rootNode=page.getByTestId("mkt9b-public-project");
   assert.equal(await rootNode.getByRole("heading",{level:1}).count(),1);
   const partner=rootNode.locator('a[href^="mailto:"]');
   assert.equal(await partner.count(),1);
   const investor=rootNode.locator('a[href="'+(locale==="it"?"/investitori":"/en/investors")+'"]');
   assert.equal(await investor.count(),1);
   const metrics=await rootNode.evaluate(el=>({width:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth,clipped:[...el.querySelectorAll("h1,h2,h3,p,a")].filter(n=>{const r=n.getBoundingClientRect();return r.width>0&&(r.left < -2||r.right>document.documentElement.clientWidth+2||n.scrollWidth>n.clientWidth+2&&getComputedStyle(n).display!=="inline");}).map(n=>n.textContent)}));
   assert.ok(metrics.scroll<=metrics.width+2&&metrics.clipped.length===0,JSON.stringify({locale,width,metrics}));
   const primary=page.locator('a[href="#partecipare"]');
   const colors=await primary.evaluate(el=>{const s=getComputedStyle(el);return {color:s.color,fill:s.webkitTextFillColor,background:s.backgroundColor};});
   assert.equal(colors.background,"rgb(255, 255, 255)");
   assert.equal(colors.color,"rgb(18, 59, 52)");
   assert.equal(colors.fill,"rgb(18, 59, 52)");
   await primary.click();
   assert.equal(await page.locator("#partecipare").count(),1);
   assert.deepEqual(errors,[]);
   await page.screenshot({path:path.join(out,locale+"-"+width+".png"),fullPage:true,animations:"disabled"});
   checked++;
  }finally{await ctx.close();}
 }
 console.log("MKT9B isolated project visual PASS: "+checked+" locale/viewport combinations");
}finally{await browser.close();}
