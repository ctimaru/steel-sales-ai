import assert from "node:assert/strict";
import { chromium } from "playwright";

const origin = "http://127.0.0.1:3000";
const browser = await chromium.launch({ headless: true, channel: "chrome" });
try {
  for (const width of [390, 1440]) {
    for (const arm of ["control", "clarity"]) {
      const context = await browser.newContext({
        viewport: { width, height: width === 390 ? 844 : 900 },
        reducedMotion: "reduce",
      });
      await context.addInitScript((variant) => {
        window.sessionStorage.setItem("sss.bd17.cta.arm.v1", variant);
        window.localStorage.setItem("sss.analytics-consent.v2", JSON.stringify({
          decision: "granted", consentVersion: "ga2-2026-10-07-v1",
          noticeVersion: "2026-10-07", decidedAt: new Date().toISOString(),
        }));
      }, arm);
      await context.route("**/*", async route => {
        if (!route.request().url().startsWith(origin)) return route.abort();
        return route.continue();
      });
      const page = await context.newPage();
      const response = await page.goto(origin + "/distinta", {waitUntil:"domcontentloaded",timeout:60000});
      assert.equal(response?.status(),200);
      const calculator = page.locator("#calcolatore-pesi");
      await calculator.waitFor({state:"visible"});
      await calculator.getByLabel("Numero barre").fill("3");
      await calculator.getByRole("button",{name:/Aggiungi alla distinta/}).click();
      await page.waitForFunction(() => document.querySelectorAll("#buyer-live-preview .bd10-preview-row:not([hidden])").length === 1);
      const label = arm === "control" ? "Accedi per creare una RFQ privata"
        : "Accedi e scegli i fornitori per una RFQ privata";
      const link = page.locator("#buyer-live-preview").getByRole("link",{name:label,exact:true});
      await link.waitFor({state:"visible",timeout:25000});
      await link.scrollIntoViewIfNeeded();
      assert.equal(await link.getAttribute("href"),"/login?next=%2Frfq-hub%2Fdistinta");
      await page.waitForFunction((variant) =>
        window.sessionStorage.getItem("sss.bd17.cta."+variant+".view.v1") === "1",arm,{timeout:12000});
      const measured = await page.evaluate((variant) => ({
        arm:window.sessionStorage.getItem("sss.bd17.cta.arm.v1"),
        other:window.sessionStorage.getItem("sss.bd17.cta."+(variant==="control"?"clarity":"control")+".view.v1"),
      }),arm);
      assert.equal(measured.arm,arm);
      assert.equal(measured.other,null);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 12),false);
      await link.click();
      await page.waitForURL(url=>url.pathname==="/login" && url.searchParams.get("next")==="/rfq-hub/distinta",{timeout:30000});
      const state = await page.evaluate(variant=>({
        click:window.sessionStorage.getItem("sss.bd17.cta."+variant+".click.v1"),
        draft:window.sessionStorage.getItem("smart-steel-sales:buyer-distinta:v1:guest"),
      }),arm);
      assert.equal(state.click,"1");
      assert.ok(state.draft,"Buyer draft must remain in same-tab session when opening login");
      assert.equal(JSON.parse(state.draft).lines.length,1);
      console.log("BD17 CHROME PASS",width,arm,"consented view/click; draft persisted; login handoff; no overflow");
      await context.close();
    }
  }
  const denied = await browser.newContext({viewport:{width:390,height:844},reducedMotion:"reduce"});
  await denied.addInitScript(() => {
    window.sessionStorage.setItem("sss.bd17.cta.arm.v1","clarity");
    window.localStorage.setItem("sss.analytics-consent.v2", JSON.stringify({
      decision:"denied",consentVersion:"ga2-2026-10-07-v1",
      noticeVersion:"2026-10-07", decidedAt:new Date().toISOString(),
    }));
  });
  await denied.route("**/*", async route=>route.request().url().startsWith(origin)?route.continue():route.abort());
  const page=await denied.newPage();
  await page.goto(origin+"/distinta",{waitUntil:"domcontentloaded",timeout:60000});
  const calc=page.locator("#calcolatore-pesi");
  await calc.getByLabel("Numero barre").fill("3");
  await calc.getByRole("button",{name:/Aggiungi alla distinta/}).click();
  const link=page.locator("#buyer-live-preview").getByRole("link",{name:"Accedi e scegli i fornitori per una RFQ privata",exact:true});
  await link.scrollIntoViewIfNeeded();
  await link.click();
  await page.waitForURL(url=>url.pathname==="/login",{timeout:30000});
  const exposure=await page.evaluate(()=>Object.keys(window.sessionStorage).filter(x=>x.startsWith("sss.bd17.cta.clarity.") && (x.includes(".click.")||x.includes(".view."))));
  assert.deepEqual(exposure,[],"Denied consent must produce no experiment events");
  await denied.close();
  console.log("BD17 CHROME PASS declined consent, no experiment events while login works");
} finally { await browser.close(); }
