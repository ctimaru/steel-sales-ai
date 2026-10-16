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
  // CALC-INT4.5: same-page localized calculator → bill; the legacy /distinta
  // route remains available independently, but is no longer the EU CTA handoff.
  for(const c of [
    {locale:"de",region:"de-DE",accept:"Analyse akzeptieren",edit:"Bearbeiten",
      grade:"Stahlsorte",save:"Position speichern",copy:"Stückliste kopieren",title:"Ihre Stückliste"},
    {locale:"fr",region:"fr-FR",accept:"Accepter les statistiques",edit:"Modifier",
      grade:"Nuance d'acier",save:"Enregistrer la ligne",copy:"Copier la liste",title:"Votre liste de matériaux"},
    {locale:"es",region:"es-ES",accept:"Aceptar analítica",edit:"Editar",
      grade:"Grado de acero",save:"Guardar línea",copy:"Copiar lista",title:"Tu lista de materiales"},
  ]){
    const context=await browser.newContext({viewport:{width:360,height:780},locale:c.region,
      permissions:["clipboard-read","clipboard-write"],serviceWorkers:"block"});
    const page=await context.newPage();
    const route="/"+c.locale+"/knowledge/tubes";
    const response=await page.goto(BASE+route,{waitUntil:"domcontentloaded",timeout:60000});
    assert.equal(response?.status(),200,route);
    const accept=page.getByRole("button",{name:c.accept});
    await accept.waitFor({state:"visible",timeout:25000});
    await accept.click();
    assert.match(await page.evaluate(()=>localStorage.getItem("sss.analytics-consent.v2")||""),/"decision":"granted"/);
    const source=page.locator("#calcolatore-pesi"),bill=page.locator("#distinta-inline");
    await source.getByRole("button",{name:/RFQ|Anfrage|liste|lista/i}).first().click();
    await bill.locator("article").first().waitFor({state:"visible",timeout:30000});
    assert.equal(page.url(),BASE+route,"EU calculator must not navigate on add");
    await bill.getByRole("heading",{name:c.title}).waitFor({state:"visible"});
    assert.equal(await page.locator("html").getAttribute("lang"),c.locale);
    assert.equal(await page.locator('link[rel="canonical"]').getAttribute("href"),BASE+route);
    for(const lang of ["it","en","de","fr","es"])
      assert.equal(await page.locator('link[rel="alternate"][hreflang="'+lang+'"]').count(),1);
    await bill.getByRole("button",{name:c.edit,exact:true}).first().click();
    const grade=bill.getByLabel(c.grade,{exact:true}).first();
    await grade.fill("S355J2H");
    await bill.getByRole("button",{name:c.save}).click();
    await bill.getByRole("button",{name:c.copy}).click();
    const copied=await page.evaluate(()=>navigator.clipboard.readText());
    assert.match(copied,/S355J2H/);
    assert.match(copied,/EN 10219/);
    assert.doesNotMatch(copied,/Target €/);
    const draft=JSON.parse(await page.evaluate(()=>sessionStorage.getItem("sss:inline-distinta:v1")));
    assert.equal(draft.lines.length,1);
    assert.equal(draft.lines[0].targetEurT,"");
    assert.ok(await bill.locator("[data-create-inline-private-rfq]").isVisible());
    console.log("CALC-INT4.5 LOCALE MOBILE PASS",c.locale,"inline bill and localized copy / private target boundary");
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
