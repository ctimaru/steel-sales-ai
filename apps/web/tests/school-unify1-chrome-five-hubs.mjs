/**
 * SCHOOL-UNIFY1 — Chrome acceptance of five real public School hubs.
 * Read only localhost production Next build; no auth or external requests.
 */
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { chromium } from "playwright";
const base="http://127.0.0.1:3000";
const entries=[
 {locale:"it",path:"/knowledge"},
 {locale:"en",path:"/en/knowledge"},
 {locale:"de",path:"/de/knowledge"},
 {locale:"fr",path:"/fr/knowledge"},
 {locale:"es",path:"/es/knowledge"},
];
const output="/tmp/school-unify1";
const browser=await chromium.launch({headless:true,channel:"chrome"});
await fs.mkdir(output,{recursive:true});
try{
 for(const width of [390,1440]){
  const context=await browser.newContext({viewport:{width,height:width===390?844:900},reducedMotion:"reduce"});
  await context.route("**/*",route=>{
   const url=new URL(route.request().url());
   if(url.origin!==base||!["GET","HEAD"].includes(route.request().method()))return route.abort();
   return route.continue();
  });
  const page=await context.newPage();
  for(const item of entries){
   const tag=item.locale+"-"+width;
   const result=await page.goto(base+item.path,{waitUntil:"domcontentloaded",timeout:60000});
   assert.equal(result?.status(),200,tag+" HTTP");
   assert.equal(await page.locator("html").getAttribute("lang"),item.locale,tag+" html lang");
   assert.equal(await page.locator('link[rel="canonical"]').first().getAttribute("href"),base+item.path,tag+" canonical");
   for(const lang of entries){
     const alt=page.locator('link[rel="alternate"][hreflang="'+lang.locale+'"]');
     assert.equal(await alt.count(),1,tag+" missing "+lang.locale+" hreflang");
     assert.equal(await alt.getAttribute("href"),base+lang.path,tag+" false hreflang URL");
   }
   assert.equal(await page.locator("h1").count(),1,tag+" main heading");
   const journey=page.locator('section[aria-labelledby="school-unified-journey"]');
   await journey.waitFor({state:"visible",timeout:20000});
   assert.equal(await journey.locator("a[href]").count(),4,tag+" must expose 4 professional cards");
   assert.ok(await page.locator("svg").count()>0,tag+" missing technical illustration");
   const paths=await journey.locator("a[href]").evaluateAll(nodes=>nodes.map(n=>n.getAttribute("href")));
   for(const target of paths)assert.ok(target&&target.startsWith("/"),tag+" external/private card "+target);
   if(["de","fr","es"].includes(item.locale)){
     assert.ok(paths.includes(item.path+"/tubes"),tag+" localized calculator not linked");
     assert.ok(paths.includes("/"+item.locale+"/distinta"),tag+" localized bill missing");
     assert.ok(paths.every(p=>!p.startsWith("/school/")&&!p.startsWith("/knowledge/articoli")),tag+" invented private/Italian locale link");
   }
   // Operable shared five-language switch: open disclosure instead of assuming
   // a desktop-only toggle or navigating away from the current page.
   const menu=page.locator("nav:has(details) details").first();
   assert.equal(await menu.count(),1,tag+" missing five-way selector");
   await menu.locator("summary").click();
   const choices=await menu.locator('a[hreflang]').evaluateAll(nodes=>nodes.map(n=>n.getAttribute("href")));
   for(const lang of entries)assert.ok(choices.includes(lang.path),tag+" unavailable "+lang.locale+" language choice");
   const dims=await page.evaluate(()=>({viewport:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
   assert.ok(dims.scroll<=dims.viewport+12,tag+" horizontal clipping "+JSON.stringify(dims));
   await page.screenshot({path:output+"/"+tag+".png",fullPage:true,animations:"disabled"});
   console.log("SCHOOL-UNIFY1 CHROME PASS",tag,"cards",paths.length,"languages",choices.length);
  }
  await context.close();
 }
}finally{await browser.close();}
console.log("SCHOOL-UNIFY1 CHROME PASS: 5 public languages x 2 viewports");
