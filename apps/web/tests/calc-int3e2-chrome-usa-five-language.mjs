import assert from "node:assert/strict";
import { chromium } from "playwright";

const BASE=process.env.NEXT_PUBLIC_SITE_URL||"http://127.0.0.1:3000";
const browser=await chromium.launch({headless:true,channel:"chrome"});
try{
  for(const v of [
    {locale:"de",title:/USA-Rohrgewichtsrechner/,group:"EU- oder USA-Rechner wählen",
      nps:"Nennweite (NPS)",custom:"Freie Maße",hss:"ASTM A500: strukturelle HSS-Hohlprofile",
      shape:"Querschnitt",library:"USA-Abmessungen · Atlas Tube",
      add:"HSS zur Anfrage-Stückliste hinzufügen"},
    {locale:"fr",title:/Calculateur de tubes USA/,group:"Choisir le calculateur Europe ou États-Unis",
      nps:"Diamètre nominal NPS",custom:"Dimensions libres",hss:"Profilés creux structuraux ASTM A500 (HSS)",
      shape:"Section",library:"Dimensions américaines · Atlas Tube",
      add:"Ajouter HSS à la liste de demande de prix"},
    {locale:"es",title:/Calculadora de tubos USA/,group:"Elegir calculadora europea o estadounidense",
      nps:"Tamaño nominal NPS",custom:"Dimensiones libres",hss:"Perfiles huecos estructurales ASTM A500 (HSS)",
      shape:"Sección",library:"Medidas USA · Atlas Tube",
      add:"Añadir HSS a la lista de solicitud de oferta"},
  ]){
    const context=await browser.newContext({
      viewport:{width:390,height:844},
      locale:v.locale==="de"?"de-DE":v.locale==="fr"?"fr-FR":"es-ES",
      reducedMotion:"reduce",serviceWorkers:"block",
    });
    const page=await context.newPage();
    const pathname=`/${v.locale}/knowledge/tubes`;
    const resp=await page.goto(BASE+pathname,{waitUntil:"domcontentloaded",timeout:60000});
    assert.equal(resp?.status(),200);
    assert.equal(await page.locator("html").getAttribute("lang"),v.locale);
    assert.equal(await page.locator('link[rel="canonical"]').getAttribute("href"),BASE+pathname);
    const toggle=page.getByRole("group",{name:v.group});
    const eu=toggle.getByRole("button",{name:/EUROPA|EUROPE/i});
    const us=toggle.getByRole("button",{name:/USA/i});
    assert.equal(await eu.getAttribute("aria-pressed"),"true");
    await us.click();
    assert.equal(await us.getAttribute("aria-pressed"),"true");
    assert.equal(page.url(),BASE+pathname,"Region switch must not navigate");
    const nps=page.getByRole("combobox",{name:v.nps});
    await nps.selectOption("8");
    assert.equal(await nps.inputValue(),"8");
    await page.getByRole("button",{name:v.custom,exact:true}).click();
    const pipe=page.getByRole("region",{name:v.title});
    const diameter=pipe.getByRole("textbox",{name:/Außendurchmesser|Diamètre extérieur|Diámetro exterior/});
    await diameter.fill("168,3");
    assert.equal(await diameter.inputValue(),"168,3");
    const customFlag=pipe.getByRole("link",{name:"FR",exact:true});
    const customUrl=await customFlag.getAttribute("href");
    assert.ok(customUrl?.startsWith("/fr/knowledge/tubes?"),customUrl);
    assert.ok(customUrl.includes("system=us")&&customUrl.includes("usMode=custom"),customUrl);
    assert.ok(customUrl.includes("customDiameter=168%2C3"),customUrl);
    await eu.click();
    assert.equal(await page.locator("#calcolatore-pesi").isVisible(),true);
    await us.click();
    assert.equal(await diameter.inputValue(),"168,3","US dimensions survive toggles");
    await pipe.getByRole("button",{name:/HSS · ASTM A500/}).click();
    const hss=page.getByRole("region",{name:v.hss});
    await hss.getByRole("combobox",{name:v.shape,exact:true}).selectOption("rectangular");
    await hss.getByRole("combobox",{name:v.library}).selectOption("x-6-4-250");
    assert.match(await hss.innerText(),/Atlas Tube/i);
    assert.match(await hss.innerText(),/kg\/m/);
    const frFlag=hss.getByRole("link",{name:"FR",exact:true});
    const href=await frFlag.getAttribute("href");
    assert.ok(href?.startsWith("/fr/knowledge/tubes?"),href);
    assert.ok(href.includes("system=us")&&href.includes("usMode=hss"),href);
    assert.ok(href.includes("hssReferenceId=x-6-4-250"),href);
    await hss.getByRole("button",{name:v.add}).click();
    await page.waitForURL(url=>url.pathname==="/en/distinta",{timeout:60000});
    await page.getByText(/HSS Rectangular/i).first().waitFor({state:"visible",timeout:30000});
    assert.match(await page.locator("body").innerText(),/ASTM A500/i);
    console.log("CALC-INT3E.2 CHROME PASS",v.locale,"NPS/custom/HSS, region retained, localized RFQ");
    await context.close();
  }
  // Cross-language HSS state uses the exact source record, without
  // mixing the nominal Atlas weight and the calculated AISC design mass.
  const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:"block"});
  const page=await context.newPage();
  const u=BASE+"/de/knowledge/tubes?system=us&usMode=hss&hssReferenceId=x-6-4-250&hssUnits=in";
  const r=await page.goto(u,{waitUntil:"domcontentloaded",timeout:60000});
  assert.equal(r?.status(),200);
  const group=page.getByRole("group",{name:"EU- oder USA-Rechner wählen"});
  assert.equal(await group.getByRole("button",{name:/USA/}).getAttribute("aria-pressed"),"true");
  const hss=page.getByRole("region",{name:"ASTM A500: strukturelle HSS-Hohlprofile"});
  const library=hss.getByRole("combobox",{name:"USA-Abmessungen · Atlas Tube"});
  assert.equal(await library.inputValue(),"x-6-4-250");
  await hss.getByRole("link",{name:"FR",exact:true}).click();
  await page.waitForURL(url=>url.pathname==="/fr/knowledge/tubes",{timeout:60000});
  const fr=page.getByRole("region",{name:"Profilés creux structuraux ASTM A500 (HSS)"});
  assert.equal(await fr.getByRole("combobox",{name:"Dimensions américaines · Atlas Tube"}).inputValue(),"x-6-4-250");
  assert.match(await fr.innerText(),/AISC/i);
  assert.equal(await page.locator('link[rel="canonical"]').getAttribute("href"),BASE+"/fr/knowledge/tubes");
  assert.match(await page.locator('meta[name="robots"]').getAttribute("content")??"",/noindex/i);
  console.log("CALC-INT3E.2 LANG SWITCH CHROME PASS", "DE HSS -> FR HSS retained");
  await context.close();
}finally{await browser.close();}
