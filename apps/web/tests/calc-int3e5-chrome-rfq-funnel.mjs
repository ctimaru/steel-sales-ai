/**
 * CALC-INT3E.5 — local production-build browser acceptance.
 * Synthetic dimensions only; public browser-tab handoff + clipboard only.
 * No emails, signup submissions, marketplace publication or private writes.
 */
import assert from "node:assert/strict";
import {chromium} from "playwright";
const BASE=process.env.NEXT_PUBLIC_SITE_URL||"http://127.0.0.1:3000";
const browser=await chromium.launch({headless:true,channel:"chrome"});
try{
  for(const c of [
    {locale:"de",region:"de-DE",start:"/de/knowledge/tubes",accept:"Analyse akzeptieren",
      fix:"Erste unvollständige Position prüfen",grade:"Stahlgüte",copy:"Anfrage-E-Mail kopieren",
      confirmation:"Anfrage kopiert.",cta:"Firmenkonto für spätere RFQ-Hub-Funktionen erstellen",disclaimer:"Die Registrierung speichert"},
    {locale:"fr",region:"fr-FR",start:"/fr/knowledge/tubes",accept:"Accepter les statistiques",
      fix:"Corriger la première ligne incomplète",grade:"Nuance d'acier",copy:"Copier le courriel de demande",
      confirmation:"Demande copiée.",cta:"Créer un compte entreprise pour les futurs outils RFQ Hub",disclaimer:"L’inscription ne sauvegarde"},
    {locale:"es",region:"es-ES",start:"/es/knowledge/tubes",accept:"Aceptar analítica",
      fix:"Revisar la primera línea incompleta",grade:"Calidad de acero",copy:"Copiar correo de solicitud",
      confirmation:"Solicitud copiada.",cta:"Crear cuenta de empresa para futuras funciones RFQ Hub",disclaimer:"El registro no guarda"},
  ]){
    const context=await browser.newContext({viewport:{width:360,height:780},locale:c.region,
      permissions:["clipboard-read","clipboard-write"],serviceWorkers:"block"});
    const page=await context.newPage();
    let response=await page.goto(BASE+c.start,{waitUntil:"domcontentloaded",timeout:60000});
    assert.equal(response?.status(),200,c.start);
    const accept=page.getByRole("button",{name:c.accept});
    await accept.waitFor({state:"visible",timeout:25000});
    await accept.click();
    assert.match(await page.evaluate(()=>localStorage.getItem("sss.analytics-consent.v2")||""),/"decision":"granted"/);
    const source=page.locator("#calcolatore-pesi");
    await source.getByRole("button",{name:/RFQ|Anfrage|liste|lista/i}).first().click();
    await page.waitForURL(url=>url.pathname==="/"+c.locale+"/distinta",{timeout:60000});
    assert.equal(await page.locator("html").getAttribute("lang"),c.locale);
    assert.equal(await page.locator('link[rel="canonical"]').getAttribute("href"),BASE+"/"+c.locale+"/distinta");
    for(const lang of ["it","en","de","fr","es"]){
      assert.equal(await page.locator('link[rel="alternate"][hreflang="'+lang+'"]').count(),1,
        "Missing reciprocal hreflang "+lang+" on "+c.locale);
    }
    const grade=page.getByRole("textbox",{name:c.grade}).first();
    await grade.waitFor({state:"visible"});
    assert.equal(await grade.inputValue(),"","A sourced calculator never selects a grade");
    const copy=page.getByRole("button",{name:c.copy});
    assert.equal(await copy.isDisabled(),true);
    await page.getByRole("button",{name:c.fix}).first().click();
    assert.equal(await grade.evaluate(el=>document.activeElement===el),true,
      "Review action must focus the missing grade");
    await grade.fill("S355J2H");
    assert.equal(await copy.isDisabled(),false);
    await copy.click();
    await page.getByText(c.confirmation,{exact:false}).first().waitFor({state:"visible"});
    const email=await page.evaluate(()=>navigator.clipboard.readText());
    assert.match(email,/S355J2H/);
    assert.match(email,/EN 10219/);
    const cta=page.getByRole("link",{name:new RegExp(c.cta)});
    await cta.waitFor({state:"visible"});
    assert.equal(await cta.getAttribute("href"),"/en/register");
    assert.ok((await page.getByRole("status").last().innerText()).includes(c.disclaimer),
      "Disclosure must match the actual current language");
    console.log("CALC-INT3E.5 LOCALE MOBILE PASS",c.locale,"valid copied synthetic RFQ, guided grade and non-persistent signup CTA");
    await context.close();
  }
  {
    const context=await browser.newContext({viewport:{width:390,height:844},
      locale:"en-GB",permissions:["clipboard-read","clipboard-write"],serviceWorkers:"block"});
    const page=await context.newPage();
    const start=await page.goto(BASE+"/en/knowledge/tubes/american-pipe",{waitUntil:"domcontentloaded",timeout:60000});
    assert.equal(start?.status(),200);
    const add=page.getByRole("button",{name:/Add to RFQ bill/i}).first();
    await add.waitFor({state:"visible",timeout:30000});
    await add.click();
    await page.waitForURL(url=>url.pathname==="/en/distinta",{timeout:60000});
    await page.getByText(/Requested product specification — supplier confirmation required/i).first().waitFor({state:"visible"});
    const grade=page.getByRole("textbox",{name:"Steel grade"}).first();
    assert.equal(await grade.inputValue(),"");
    await page.getByRole("button",{name:"Review first incomplete item"}).first().click();
    assert.equal(await grade.evaluate(el=>document.activeElement===el),true);
    await grade.fill("ASTM A106 Gr B");
    await page.getByRole("button",{name:"Copy RFQ email"}).click();
    const email=await page.evaluate(()=>navigator.clipboard.readText());
    assert.match(email,/ASTM A106|API Spec 5L/i);
    assert.match(email,/supplier/i);
    assert.equal(await page.getByRole("link",{name:/Create a company account for future RFQ Hub workflows/}).getAttribute("href"),"/en/register");
    assert.match(await page.locator("body").innerText(),/Registration does not save or transfer this public bill/);
    console.log("CALC-INT3E.5 US PIPE MOBILE PASS", "source provenance + supplier approval + copy-only");
    await context.close();
  }
}finally{await browser.close();}
