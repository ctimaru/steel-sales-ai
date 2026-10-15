import assert from "node:assert/strict";
import { chromium } from "playwright";
const BASE=process.env.NEXT_PUBLIC_SITE_URL||"http://127.0.0.1:3000";
const browser=await chromium.launch({headless:true,channel:"chrome"});
try{
  for(const c of [
    {locale:"de",title:/Stahlrohr-Gewichtsrechner/,shape:"Querschnitt",standard:"Berechnungsmethode",
      width:"Außenbreite B (mm)",wall:"Wanddicke t (mm)",bill:/Zur Anfrage-Stückliste hinzufügen/i},
    {locale:"fr",title:/Calculateur de poids de tubes acier/,shape:"Section",standard:"Méthode de calcul",
      width:"Largeur extérieure B (mm)",wall:"Épaisseur t (mm)",bill:/Ajouter à la liste/i},
    {locale:"es",title:/Calculadora de peso de tubos de acero/,shape:"Sección",standard:"Método de cálculo",
      width:"Ancho exterior B (mm)",wall:"Espesor t (mm)",bill:/Añadir a la lista/i},
  ]){
    const context=await browser.newContext({viewport:{width:360,height:780},locale:
      c.locale==="de"?"de-DE":c.locale==="fr"?"fr-FR":"es-ES",
      serviceWorkers:"block"});
    const page=await context.newPage();
    const route=`/${c.locale}/knowledge/tubes`;
    const r=await page.goto(BASE+route,{waitUntil:"domcontentloaded",timeout:60000});
    assert.equal(r?.status(),200,route);
    assert.equal(await page.locator("html").getAttribute("lang"),c.locale);
    assert.equal(await page.locator('link[rel="canonical"]').getAttribute("href"),BASE+route);
    await page.getByRole("heading",{level:1,name:c.title}).waitFor({state:"visible"});
    for(const l of ["it","en","de","fr","es"]){
      assert.ok(await page.locator(`link[rel="alternate"][hreflang="${l}"]`).count()>0,`Missing ${l} hreflang`);
    }
    const root=page.locator("#calcolatore-pesi");
    await root.getByRole("combobox",{name:c.shape,exact:true}).selectOption("rectangular");
    await root.getByRole("combobox",{name:c.standard,exact:true}).selectOption("en10210");
    const width=root.getByRole("textbox",{name:c.width});
    await width.fill("155,5");
    assert.equal(await width.inputValue(),"155,5","Numeric editing must preserve focus/state");
    const wall=root.getByRole("textbox",{name:c.wall});
    await wall.fill("6,3");
    assert.match(await root.innerText(),/kg\/m/);
    assert.equal(await root.getByRole("button",{name:c.bill}).isDisabled(),false);
    const frFlag=root.getByRole("link",{name:"FR",exact:true});
    const href=await frFlag.getAttribute("href");
    assert.ok(href?.startsWith("/fr/knowledge/tubes?"));
    assert.match(href,/width=155%2C5/);
    assert.match(href,/standard=en10210/);
    // Query links are shareable but noindex; canonical always points to clean route.
    const parameterized=await page.goto(BASE+route+"?standard=en10219&family=round_tube&od=219.1&thickness=8",{waitUntil:"domcontentloaded"});
    assert.equal(parameterized?.status(),200);
    assert.equal(await page.locator('link[rel="canonical"]').getAttribute("href"),BASE+route);
    const robots=await page.locator('meta[name="robots"]').getAttribute("content");
    assert.match(robots??"",/noindex/i);
    await page.goto(BASE+route,{waitUntil:"domcontentloaded",timeout:60000});
    const section=page.locator("#calcolatore-pesi");
    await section.getByRole("combobox",{name:c.shape,exact:true}).selectOption("square");
    await section.getByRole("button",{name:c.bill}).click();
    await page.waitForURL(url=>url.pathname==="/en/distinta",{timeout:60000});
    await page.getByText(/EN 10219/i).first().waitFor({state:"visible",timeout:30000});
    const text=await page.locator("body").innerText();
    assert.match(text,/EN 10219/);
    console.log("CALC-INT3E.1 CHROME PASS",c.locale,"translated 200 / canonical hreflang / noindex / EU RFQ");
    await context.close();
  }
}finally{await browser.close();}
