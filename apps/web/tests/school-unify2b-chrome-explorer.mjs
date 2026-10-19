/** SCHOOL-UNIFY2B: real browser, local demo only. No production credentials. */
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import {chromium} from "playwright";
const origin="http://127.0.0.1:3000",out="/tmp/school-unify2b";
const fixtures={
 it:{header:"Cerca nel knowledge layer",company:"Azienda",role:"Ruolo automatico",filename:"Titolo / filename",date:"Da data"},
 en:{header:"Search company knowledge",company:"Company",role:"Any item role",filename:"Title / filename",date:"From date"},
 de:{header:"Firmenwissen durchsuchen",company:"Unternehmen",role:"Alle Positionstypen",filename:"Titel / Dateiname",date:"Datum von"},
 fr:{header:"Rechercher dans les documents",company:"Entreprise",role:"Tous les rôles",filename:"Titre / fichier",date:"Date de début"},
 es:{header:"Buscar en el conocimiento empresarial",company:"Empresa",role:"Cualquier rol",filename:"Título / archivo",date:"Desde la fecha"},
};
await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,channel:"chrome"});
try{
 for(const width of [390,1440]){
  const context=await browser.newContext({viewport:{width,height:width===390?844:900},serviceWorkers:"block",reducedMotion:"reduce"});
  await context.route("**/*",r=>{
    const q=r.request(),u=new URL(q.url());
    return u.origin===origin&&["GET","HEAD"].includes(q.method())?r.continue():r.abort();
  });
  const page=await context.newPage();
  for(const [lang,f] of Object.entries(fixtures)){
   const path="/school/explorer"+(lang==="it"?"":"?lang="+lang);
   const response=await page.goto(origin+path,{waitUntil:"domcontentloaded",timeout:60000});
   assert.equal(response?.status(),200,lang+" demo explorer");
   await page.getByRole("heading",{name:f.header,exact:true}).waitFor();
   const controls=page.locator("form").filter({has:page.locator('input[name="query"]')}).first();
   const search=controls.locator('input[name="query"]');
   assert.equal(await search.count(),1,lang+" main query");
   await controls.locator("details summary").click();
   for(const [name,placeholder] of [["company",f.company],["document_query",f.filename]]){
     assert.equal(await controls.locator('[name="'+name+'"]').getAttribute("placeholder"),placeholder,lang+" "+name);
   }
   assert.equal(await controls.locator('select[name="item_role"] option').first().textContent(),f.role);
   assert.equal(await controls.locator('select[name="item_role"] option[value="requested"]').count(),1);
   assert.equal(await controls.locator('select[name="item_role"] option[value="offered"]').count(),1);
   assert.equal(await controls.locator('select[name="item_role"] option[value="ordered"]').count(),1);
   assert.equal(await controls.locator('select[name="item_role"] option[value="delivered"]').count(),1);
   assert.equal((await controls.locator('input[name="date_from"]').locator("xpath=..").textContent()).trim(),f.date);
   for(const name of ["source_class","source_type","document_type","document_query","date_from","date_to","outer_diameter_mm","thickness_mm","width_mm","height_mm","length_mm"]){
     assert.equal(await controls.locator('[name="'+name+'"]').count(),1,lang+" "+name);
   }
   const resultOrder=await controls.locator('select[name="limit"] option').evaluateAll(nodes=>nodes.map(x=>x.value));
   assert.deepEqual(resultOrder,["10","12","20","30"],lang+" result limit");
   await search.fill("EN 10219 S355J2H");
   assert.equal(await search.inputValue(),"EN 10219 S355J2H",lang+" must preserve original technical codes");
   const widthInfo=await page.evaluate(()=>({viewport:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
   assert.ok(widthInfo.scroll<=widthInfo.viewport+12,lang+" horizontal overflow "+JSON.stringify(widthInfo));
   await page.screenshot({path:out+"/"+lang+"-"+width+".png",fullPage:true,animations:"disabled"});
   console.log("SCHOOL-UNIFY2B LOCAL CHROME PASS",lang,width);
  }
  await context.close();
 }
}finally{await browser.close();}
console.log("SCHOOL-UNIFY2B LOCAL CHROME PASS: 5 locales x 2 viewports, translated filter contract, no app writes");
