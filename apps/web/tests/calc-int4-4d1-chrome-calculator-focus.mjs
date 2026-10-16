import assert from "node:assert/strict";
import {chromium} from "playwright";

// CALC-INT4.4D.1 — live behavior against disposable Next.js production build.
const browser=await chromium.launch({headless:true,channel:"chrome"});
try{
for(const width of [390,1440]){
 const ctx=await browser.newContext({viewport:{width,height:850},reducedMotion:"reduce"});
 await ctx.route("**/*",route=>route.request().url().startsWith("http://127.0.0.1:3000")?route.continue():route.abort());
 const page=await ctx.newPage();
 const response=await page.goto("http://127.0.0.1:3000/knowledge/tubes",{waitUntil:"domcontentloaded",timeout:60000});
 assert.equal(response?.status(),200);
 const calc=page.locator("#calcolatore-pesi");
 await calc.waitFor({state:"visible"});
 const bill=page.locator("#distinta-inline");
 await bill.waitFor({state:"visible"});
 const editorial=page.locator('[data-testid="calculator-editorial-disclosure"]');
 const technical=page.locator('[data-testid="calculator-technical-disclosure"]');
 assert.equal(await editorial.evaluate(el=>el.open),false);
 assert.equal(await technical.evaluate(el=>el.open),false);
 assert.equal(await page.getByRole("heading",{name:"Domande frequenti"}).isVisible(),false);
 assert.equal(await page.getByRole("heading",{name:/pesi di riferimento|riferimenti disponibili/i}).isVisible(),false);
 assert.equal(await bill.getByRole("heading",{name:"La tua distinta"}).isVisible(),true);
 const rects=await page.evaluate(()=>({
  calculator:document.querySelector("#calcolatore-pesi").getBoundingClientRect().top+scrollY,
  bill:document.querySelector("#distinta-inline").getBoundingClientRect().top+scrollY,
  technical:document.querySelector('[data-testid="calculator-technical-disclosure"]').getBoundingClientRect().top+scrollY,
  editorial:document.querySelector('[data-testid="calculator-editorial-disclosure"]').getBoundingClientRect().top+scrollY,
 }));
 assert.ok(rects.calculator<rects.bill && rects.bill<rects.technical && rects.technical<rects.editorial,
  "Expected calculator → bill → collapsed references → collapsed editorial, got "+JSON.stringify(rects));

 await calc.getByRole("button",{name:/Aggiungi alla distinta/}).click();
 await bill.locator("article").first().waitFor({state:"visible"});
 assert.equal(await bill.locator("article").count(),1);
 assert.equal(new URL(page.url()).pathname,"/knowledge/tubes");
 await technical.locator("summary").click();
 assert.equal(await technical.evaluate(el=>el.open),true);
 await page.locator("#tube-reference-heading").waitFor({state:"visible"});
 const sources=page.locator('[data-testid="tube-reference-catalogue"]');
 await sources.waitFor({state:"attached"});
 assert.equal(await sources.evaluate(el=>el.open),false);
 await sources.locator("summary").click();
 assert.equal(await sources.evaluate(el=>el.open),true);
 await technical.locator("summary").click();
 assert.equal(await technical.evaluate(el=>el.open),false);
 await editorial.locator("summary").click();
 assert.equal(await editorial.evaluate(el=>el.open),true);
 await page.getByRole("heading",{name:"Domande frequenti"}).waitFor({state:"visible"});
 await page.getByRole("heading",{name:"Come si calcola il peso di un tubo in acciaio"}).waitFor({state:"visible"});
 assert.ok(await editorial.locator('a[href="/knowledge/norme"]').count()>=1);
 assert.ok(await editorial.locator('a[href="/knowledge/gradi"]').count()>=1);
 await editorial.locator("summary").click();
 assert.equal(await editorial.evaluate(el=>el.open),false);
 const seo=await page.evaluate(()=>({
   canonical:document.querySelector('link[rel="canonical"]')?.getAttribute("href"),
   lang:document.documentElement.lang,
   ld:[...document.querySelectorAll('script[type="application/ld+json"]')].map(x=>x.textContent),
   pageText:document.documentElement.outerHTML.includes("Come si calcola il peso di un tubo in acciaio"),
   width:document.documentElement.scrollWidth,clientWidth:document.documentElement.clientWidth,
 }));
 assert.equal(seo.canonical,"http://127.0.0.1:3000/knowledge/tubes");
 assert.equal(seo.lang,"it");
 for(const type of ["WebApplication","TechArticle","FAQPage","BreadcrumbList"])
   assert.ok(seo.ld.some(x=>x.includes('"@type":"'+type+'"')),type);
 assert.equal(seo.pageText,true);
 assert.ok(seo.width<=seo.clientWidth+12,"No horizontal overflow");
 console.log("CALC-INT4.4D.1 IT FOCUSED CHROME PASS",width,rects);
 await ctx.close();
}
}finally{await browser.close();}
