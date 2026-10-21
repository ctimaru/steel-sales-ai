import assert from "node:assert/strict";
import {chromium} from "playwright";

// Read-only local production-build acceptance: no live credentials, no RFQ
// action can write in this disposable test runtime. Verifies guest handoff,
// explicit commercial consent and same-tab technical restore.
const browser=await chromium.launch({headless:true,channel:"chrome"});
try {
 for(const width of [390,1440]){
  const context=await browser.newContext({viewport:{width,height:860},reducedMotion:"reduce"});
  await context.route("**/*",route=>route.request().url().startsWith("http://127.0.0.1:3000")?route.continue():route.abort());
  const page=await context.newPage();
  const response=await page.goto("http://127.0.0.1:3000/knowledge/tubes",{waitUntil:"domcontentloaded",timeout:60000});
  assert.equal(response?.status(),200);
  const calculator=page.locator("#calcolatore-pesi"),bill=page.locator("#distinta-inline-dialog");
  const trigger=page.locator('[data-testid="calculator-cart-trigger"]');
  await calculator.waitFor({state:"visible"});
    // Dismiss the platform's first-visit consent overlay before exercising
    // the floating cart. Never bypass consent or force clicks behind it.
    await page.locator('[data-testid="mobile-cookie-consent"]')
      .getByRole("button",{name:"Accetta necessari"}).click();
  assert.equal(await bill.locator("[data-create-inline-private-rfq]").count(),0,
   "No empty RFQ button before there is a bill");
  await calculator.getByLabel("Numero barre").fill("3");
  await calculator.getByRole("button",{name:/Aggiungi alla distinta/}).click();
  await trigger.click();
  await bill.locator("article").first().waitFor({state:"visible"});
  assert.equal(await bill.locator("[data-create-inline-private-rfq]").count(),1);
  assert.equal(await bill.getByRole("checkbox",{name:/Includi i target buyer/}).count(),0);
  await bill.getByRole("button",{name:/Chiudi/}).click();
  await calculator.getByLabel("Prezzo €/ton").fill("850");
  await calculator.locator("[data-target-opt-in]").click();
  await bill.getByRole("button",{name:"Associa target interno alla riga 1"}).click();
  const consent=bill.getByRole("checkbox",{name:/Includi i target buyer/});
  assert.equal(await consent.isChecked(),false,"Internal target snapshot is opt-in OFF");
  await consent.check();
  assert.equal(await consent.isChecked(),true);
  const create=bill.locator("[data-create-inline-private-rfq]");
  await create.click();
  // Without configured credentials the local production server may report
  // "unavailable" rather than an authenticated guest. Do not mislabel an
  // outage as an invitation to register.
  await bill.getByRole("alert").waitFor({state:"visible",timeout:15000});
  assert.match(await bill.innerText(),/RFQ privata/);
  const guestHandoff=bill.locator("[data-inline-guest-handoff]");
  if (await guestHandoff.count()) {
    const login=bill.getByRole("link",{name:"Accedi e riprendi"});
    assert.equal(await login.getAttribute("href"),"/login?next=%2Fknowledge%2Ftubes");
    assert.equal(await bill.getByRole("link",{name:"Registra azienda"}).getAttribute("href"),"/register");
    assert.equal(await guestHandoff.getByRole("button",{name:"Copia distinta"}).count(),1);
  } else {
    assert.match(await bill.getByRole("alert").innerText(),/Impossibile verificare l'accesso/);
    assert.equal(await bill.getByRole("link",{name:"Registra azienda"}).count(),0,
      "Unavailable access must not masquerade as guest registration");
  }
  const restored=JSON.parse(await page.evaluate(()=>sessionStorage.getItem("sss:inline-distinta:v1")));
  assert.equal(restored.lines.length,1);
  assert.equal(restored.lines[0].targetEurT,"","No private buyer target in guest session");
  assert.equal(new URL(page.url()).pathname,"/knowledge/tubes",
   "Guest click does not navigate/dispatch or create RFQ");
  await page.reload({waitUntil:"domcontentloaded"});
  await trigger.click();
  await bill.locator("article").first().waitFor({state:"visible"});
  assert.equal(await page.locator("[data-buyer-target]").count(),0);
  assert.equal(await page.locator("[data-create-inline-private-rfq]").count(),1);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+12),false);
  console.log("CALC-INT4.4D CHROME PASS",width,"guest handoff + target consent + technical resume, no dispatch");
  await context.close();
 }
}finally{await browser.close();}
