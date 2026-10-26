import assert from "node:assert/strict";
import { chromium } from "playwright";
const BASE=process.env.NEXT_PUBLIC_SITE_URL||"http://127.0.0.1:3000";
const browser=await chromium.launch({headless:true,channel:"chrome"});
try{
  for(const c of [
    {locale:"de",title:/Stahlrohr-Gewichtsrechner/,shape:/Rechteck/,width:"Breite B",wall:"Wanddicke t",bill:/Zur Stückliste hinzufügen/i},
    {locale:"fr",title:/Calculateur de poids de tubes acier/,shape:/Rectangulaire/,width:"Largeur B",wall:"Épaisseur t",bill:/Ajouter à la liste/i},
    {locale:"es",title:/Calculadora de peso de tubos de acero/,shape:/Rectangular/,width:"Ancho B",wall:"Espesor t",bill:/Añadir a la lista/i},
  ]){
    const context=await browser.newContext({viewport:{width:360,height:780},locale:
      c.locale==="de"?"de-DE":c.locale==="fr"?"fr-FR":"es-ES",
      serviceWorkers:"block"});
    const page=await context.newPage();
    const route=`/${c.locale}/knowledge/tubes`;
    // CALC-INT3E.6: new localized homepage is the explicit entry point.
    const homepage=`/${c.locale}`;
    const landing=await page.goto(BASE+homepage,{waitUntil:"domcontentloaded",timeout:60000});
    assert.equal(landing?.status(),200,homepage);
    assert.equal(await page.locator("html").getAttribute("lang"),c.locale);
    assert.equal(await page.locator('link[rel="canonical"]').getAttribute("href"),BASE+homepage);
    assert.equal(await page.locator('main a[href="'+route+'"]').count()>=1,true);
    assert.equal(await page.locator('main a[href="/'+c.locale+'/distinta"]').count()>=1,true);
    for(const lang of ["it","en","de","fr","es"]){
      assert.ok(await page.locator('link[rel="alternate"][hreflang="'+lang+'"]').count()>0);
    }
    const r=await page.goto(BASE+route,{waitUntil:"domcontentloaded",timeout:60000});
    assert.equal(r?.status(),200,route);
    assert.equal(await page.locator("html").getAttribute("lang"),c.locale);
    assert.equal(await page.locator('link[rel="canonical"]').getAttribute("href"),BASE+route);
    await page.getByRole("heading",{level:1,name:c.title}).waitFor({state:"visible"});
    for(const l of ["it","en","de","fr","es"]){
      assert.ok(await page.locator(`link[rel="alternate"][hreflang="${l}"]`).count()>0,`Missing ${l} hreflang`);
    }
    const root=page.locator("#calcolatore-pesi");
    // CALC-INT3E.7: the same full cockpit used by IT/EN, no reduced select-only widget.
    await root.locator('[data-calc-shape-buttons] button').nth(2).click();
    await root.locator('select').filter({has:page.locator('option[value="en10210"]')}).selectOption("en10210");
    const width=root.getByRole("textbox",{name:c.width});
    await width.fill("155,5");
    assert.equal(await width.inputValue(),"155,5","Numeric editing must preserve focus/state");
    const wall=root.getByRole("textbox",{name:c.wall});
    await wall.fill("6,3");
    await root.getByText(/Masse je|Poids par|Peso por|Gewicht je/i).first().waitFor({state:"visible"});
    assert.ok(await root.locator('svg[role="img"]').count()>0,"Proportional diagram remains available on desktop");
    assert.match(await root.innerText(),/Favoriten|Favoris|Favoritos/i);
    await root.locator("[data-commercial-targets] button").nth(1).click();
    assert.match(await root.innerText(),/Zieltonnen|Tonnes cibles|Toneladas objetivo/i);
    assert.match(await root.innerText(),/kg\/m/);
    assert.equal(await root.getByRole("button",{name:c.bill}).isDisabled(),false);
    // CALC-INT3E.6: language lives in the PAGE HEADER, not inside the form.
    assert.equal(await root.getByRole("link",{name:"FR",exact:true}).count(),0);
    const languageMenu=page.locator('header nav[aria-label]');
    await languageMenu.locator("summary").first().click();
    const fr=languageMenu.getByRole("link",{name:"Français",exact:true});
    assert.equal(await fr.getAttribute("href"),"/fr/knowledge/tubes");
    await page.keyboard.press("Escape");
    // Deliberate page language navigation starts from the canonical calculator landing;
    // independently shareable param URLs are still accepted, with noindex.
    // Query links are shareable but noindex; canonical always points to clean route.
    const parameterized=await page.goto(BASE+route+"?standard=en10219&family=round_tube&od=219.1&thickness=8",{waitUntil:"domcontentloaded"});
    assert.equal(parameterized?.status(),200);
    assert.equal(await page.locator('link[rel="canonical"]').getAttribute("href"),BASE+route);
    const robots=await page.locator('meta[name="robots"]').getAttribute("content");
    assert.match(robots??"",/noindex/i);
    await page.goto(BASE+route,{waitUntil:"domcontentloaded",timeout:60000});
    const section=page.locator("#calcolatore-pesi");
    await section.locator('[data-calc-shape-buttons] button').nth(1).click();
    await section.getByRole("button",{name:c.bill}).click();
    const inline=page.locator("#distinta-inline-dialog");
    if (await page.locator('[data-testid="mobile-cookie-consent"] > button').isVisible())
      await page.locator('[data-testid="mobile-cookie-consent"] > button').click();
    await page.locator('[data-testid="calculator-cart-trigger"]').click();
    await inline.locator("article").first().waitFor({state:"visible",timeout:30000});
    assert.equal(new URL(page.url()).pathname,route,"Inline EU bill must not navigate");
    assert.equal(await inline.locator("article").count(),1);
    const expectedTitle={de:"Ihre Stückliste",fr:"Votre liste de matériaux",es:"Tu lista de materiales"}[c.locale];
    assert.equal(await inline.getByRole("heading",{name:expectedTitle}).count(),1);
    assert.equal(await inline.locator("[data-create-inline-private-rfq]").count(),1);
    assert.equal(JSON.parse(await page.evaluate(()=>sessionStorage.getItem("sss:inline-distinta:v1"))).lines[0].targetEurT,"");
    console.log("CALC-INT4.5 CHROME PASS",c.locale,"translated / canonical hreflang / noindex / inline bill");
    await context.close();
  }
}finally{await browser.close();}
