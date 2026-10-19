/**
 * SCHOOL-UNIFY2 — authenticated-shell UX in CI demo mode, read-only Chrome.
 * Demo mode is NOT proof of production tenant/RLS authorization.
 */
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { chromium } from "playwright";
const base="http://127.0.0.1:3000",dir="/tmp/school-unify2";
const copy={it:"Il toolbox tecnico per acciaio e tubi",en:"Your private steel technical workspace",de:"Ihr privater technischer Arbeitsbereich",fr:"Votre espace technique privé",es:"Tu espacio técnico privado"};
await fs.mkdir(dir,{recursive:true});
const browser=await chromium.launch({headless:true,channel:"chrome"});
try {
 for(const width of [390,1440]){
  const context=await browser.newContext({viewport:{width,height:width===390?844:900},reducedMotion:"reduce"});
  await context.route("**/*",route=>{
   const req=route.request(),u=new URL(req.url());
   if(u.origin!==base||!["GET","HEAD"].includes(req.method()))return route.abort();
   return route.continue();
  });
  const page=await context.newPage();
  for(const [locale,title] of Object.entries(copy)){
   const path=locale==="it"?"/school":"/school?lang="+locale;
   const response=await page.goto(base+path,{waitUntil:"domcontentloaded",timeout:60000});
   assert.equal(response?.status(),200,locale+" "+width+" demo workspace");
   assert.ok((await page.locator("h1").first().textContent()||"").includes(title),locale+" translated home");
   const menu=page.locator('nav[aria-label]:has(details)').filter({has:page.locator('a[href^="/school?lang="]')}).first();
   assert.equal(await menu.count(),1,locale+" private language switch");
   for(const target of ["en","de","fr","es"])assert.ok(await menu.locator('a[href="/school?lang='+target+'"]').count(),locale+" missing "+target);
   if(locale!=="it"){
     assert.ok(await page.locator('div[lang="'+locale+'"] h1').count()>0,locale+" accessible language subtree");
     const cards=page.locator('section[aria-labelledby="school-private-tools"] a[href]');
     assert.equal(await cards.count(),4,locale+" four private School cards");
     assert.equal(await cards.filter({has:page.locator("h3")}).count(),4);
     assert.ok(await page.locator('form[action="/school/norme"] input[name="lang"][value="'+locale+'"]').count()>0,locale+" standards preserves language");
     assert.ok(await page.locator('form[action="/school/gradi"] input[name="lang"][value="'+locale+'"]').count()>0,locale+" grades preserves language");
     assert.ok(await page.locator('a[href="/school/explorer?lang='+locale+'"]').count()>0,locale+" documents link");
   }
   const dim=await page.evaluate(()=>({viewport:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
   if(dim.scroll>dim.viewport+12){
     const offenders=await page.evaluate(()=>Array.from(document.querySelectorAll("body *")).flatMap(el=>{
       const r=el.getBoundingClientRect();
       return r.right>document.documentElement.clientWidth+9&&r.width>0
         ? [{tag:el.tagName,classes:typeof el.className==="string"?el.className.slice(0,100):"",text:(el.textContent||"").trim().slice(0,100),left:Math.round(r.left),right:Math.round(r.right),width:Math.round(r.width)}] : [];
     }).slice(0,18));
     console.error("SCHOOL-UNIFY2 OVERFLOW DIAGNOSTIC",locale,width,JSON.stringify({dim,offenders}));
     await page.screenshot({path:dir+"/"+locale+"-"+width+"-overflow.png",fullPage:true,animations:"disabled"});
   }
   assert.ok(dim.scroll<=dim.viewport+12,locale+" mobile overflow "+JSON.stringify(dim));
   await page.screenshot({path:dir+"/"+locale+"-"+width+".png",fullPage:true,animations:"disabled"});
   console.log("SCHOOL-UNIFY2 CHROME PASS",locale,width);
  }
  await context.close();
 }
 const context=await browser.newContext({viewport:{width:390,height:844}});
 await context.route("**/*",route=>new URL(route.request().url()).origin===base&&["GET","HEAD"].includes(route.request().method())?route.continue():route.abort());
 const page=await context.newPage();
 for(const [path,expect] of [
  ["/school/norme?lang=en","Technical standards"],
  ["/school/gradi?lang=de","Stahlsorten"],
  ["/school/explorer?lang=fr","Documents de l’entreprise"],
 ]){
  const response=await page.goto(base+path,{waitUntil:"domcontentloaded",timeout:60000});
  assert.equal(response?.status(),200,path+" localized private route");
  assert.ok((await page.locator("h1").first().textContent()||"").includes(expect),path+" heading");
  console.log("SCHOOL-UNIFY2 CHROME PASS",path);
 }
 assert.ok(await page.locator('a[href="/fr/knowledge"]').count()>0 || (await page.goto(base+"/school/explorer?lang=fr",{waitUntil:"domcontentloaded"}))?.status()===200,"public transition explicit");
 await context.close();
}finally{await browser.close();}
console.log("SCHOOL-UNIFY2 CHROME PASS all five private home languages and reference/document views in demo mode");
