import assert from "node:assert/strict";
import { chromium } from "playwright";

// CALC-INT4.4C — real Chrome UI verification: last-edited €/t and €/m,
// explicit row selection, editing/removal, clipboard and session privacy.
const browser = await chromium.launch({headless:true,channel:"chrome"});
try {
  for (const width of [390,1440]) {
    const ctx=await browser.newContext({viewport:{width,height:860},reducedMotion:"reduce",
      permissions:["clipboard-read","clipboard-write"]});
    await ctx.route("**/*",route=>route.request().url().startsWith("http://127.0.0.1:3000")?route.continue():route.abort());
    const page=await ctx.newPage();
    const response=await page.goto("http://127.0.0.1:3000/knowledge/tubes",
      {waitUntil:"domcontentloaded",timeout:60000});
    assert.equal(response?.status(),200);
    const calculator=page.locator("#calcolatore-pesi"),bill=page.locator("#distinta-inline");
    await calculator.waitFor({state:"visible"});
    const eurT=calculator.getByLabel("Prezzo €/ton");
    const eurM=calculator.getByLabel("Prezzo €/m");
    await eurT.fill("850");
    assert.equal(await calculator.locator("[data-target-opt-in]").isEnabled(),true);
    assert.equal(await bill.locator("[data-buyer-target]").count(),0);
    assert.equal(await page.evaluate(()=>sessionStorage.getItem("sss:inline-distinta:v1")),null);

    await calculator.getByRole("button",{name:/Aggiungi alla distinta/}).click();
    await bill.locator("article").first().waitFor({state:"visible"});
    assert.equal(await bill.locator("[data-buyer-target]").count(),0,
      "Adding a tube may never automatically import the quick price.");
    await calculator.locator("[data-target-opt-in]").click();
    assert.equal(await bill.locator("[data-target-pending]").count(),1);
    assert.equal(await bill.locator("[data-buyer-target]").count(),0);
    await bill.getByRole("button",{name:"Associa target interno alla riga 1"}).click();
    assert.match(await bill.locator("[data-buyer-target]").innerText(),/850(?:[,.]0+)? €/);
    assert.match(await bill.locator("[data-buyer-target]").innerText(),/€/);
    assert.equal(await bill.locator("[data-target-pending]").count(),0);

    await bill.getByRole("button",{name:"Modifica target interno"}).click();
    await bill.getByLabel("Unità target").selectOption("metre");
    await bill.getByLabel("Importo riservato").fill("19,50");
    await bill.getByRole("button",{name:"Salva target"}).click();
    assert.match(await bill.locator("[data-buyer-target]").innerText(),/19,5 €/);

    await bill.getByRole("button",{name:"Copia distinta"}).click();
    await bill.getByText(/Distinta tecnica copiata/).waitFor({state:"visible"});
    const copy=await page.evaluate(()=>navigator.clipboard.readText());
    assert.doesNotMatch(copy,/850|19,50|19\.5/,"Public copy must exclude private buyer targets.");
    const session=await page.evaluate(()=>({
      draft:sessionStorage.getItem("sss:inline-distinta:v1"),
      keys:Object.keys(sessionStorage),
    }));
    assert.ok(session.draft);
    // Check the persisted pricing boundary structurally. A raw "850"
    // substring can occur legitimately inside a timestamp or random line ID.
    const persistedLines = JSON.parse(session.draft).lines;
    assert.ok(persistedLines.every(line =>
      !Object.keys(line).some(key => /price|commercial|buyerTarget|targetEurM/i.test(key))),
      "Session draft must not persist private commercial fields");
    assert.deepEqual(persistedLines.map(x=>x.targetEurT),[""]);
    assert.ok(!session.keys.some(k=>/buyer-target|commercial-price/.test(k)));

    await page.reload({waitUntil:"domcontentloaded"});
    await page.locator("#distinta-inline article").first().waitFor({state:"visible"});
    assert.equal(await page.locator("[data-buyer-target]").count(),0,
      "Private prices must disappear on reload, unlike the public bill");
    assert.equal(await page.locator("#distinta-inline article").count(),1);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+12),false);
    await ctx.close();
    console.log("CALC-INT4.4C CHROME PASS",width,"explicit target, metre editing, no clipboard/session leakage");
  }
} finally { await browser.close(); }
