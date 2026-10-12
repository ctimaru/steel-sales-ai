/**
 * BD15 — calculator -> saved private bill -> RFQ -> 2 resolved suppliers -> review.
 * Real Chrome + real LOCAL GoTrue + disposable LOCAL PostgreSQL only.
 * No RESEND_API_KEY, no send action to external recipients, no Marketplace publish.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const origin = process.env.DEMOTEST23_WEB_URL;
assert.equal(origin, "http://127.0.0.1:3000", "BD15 prohibits nonlocal Next.js");
assert.equal(process.env.NEXT_PUBLIC_SUPABASE_URL, "http://127.0.0.1:54321", "BD15 prohibits production Supabase");
assert.equal(process.env.RESEND_API_KEY ?? "", "", "BD15 prohibits a real email provider");
const temp = process.env.RUNNER_TEMP;
assert.ok(temp, "BD15 requires ephemeral GitHub runner files");
const buyer = JSON.parse(readFileSync(path.join(temp, "demotest23-personas.json"), "utf8")).find(p => p.id === "buyer");
assert.ok(buyer?.email && buyer?.password);
const browser = await chromium.launch({ channel: "chrome", headless: true });
const checks = [];
async function step(label, fn) {
  try { await fn(); checks.push(label); console.log("BD15 CHROME PASS", label); }
  catch (e) { console.error("BD15 CHROME FAIL", label, String(e?.message ?? e).slice(0,900)); throw e; }
}
async function goto(page, route) {
  const res = await page.goto(origin + route, { waitUntil: "domcontentloaded", timeout: 90000 });
  assert.ok(res && res.status() < 500, "Page failed: " + route);
}
async function noOverflow(page, label) {
  const state = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
    body: document.body.innerText,
  }));
  assert.ok(state.scroll <= state.client + 12, label + " horizontal overflow " + state.scroll + "/" + state.client);
  assert.ok(!state.body.includes("Application error: a server-side exception"), label + " server crash");
}
async function fillTwoTubularLines(page) {
  const calc = page.locator("#calcolatore-pesi");
  const bill = page.locator("#buyer-live-preview");
  await calc.waitFor({ state: "visible", timeout: 60000 });
  await calc.getByLabel("Numero barre").fill("3");
  const add = calc.getByRole("button", { name: /Aggiungi alla distinta/ });
  await add.click();
  await page.waitForFunction(() =>
    document.querySelectorAll("#buyer-live-preview .bd10-preview-row:not([hidden])").length === 1);
  await calc.getByRole("button", { name: /EN 10210/ }).click();
  await add.click();
  await page.waitForFunction(() =>
    document.querySelectorAll("#buyer-live-preview .bd10-preview-row:not([hidden])").length === 2);
  const summary = await bill.innerText();
  assert.match(summary, /EN 10219/);
  assert.match(summary, /EN 10210/);
  assert.match(summary, /72(?:[,.]0+)? m/);
  return { calc, bill };
}
async function login(page) {
  await goto(page, "/login");
  await page.locator('input[name="email"]').fill(buyer.email);
  await page.locator('input[name="password"]').fill(buyer.password);
  await page.getByRole("button", { name: "Accedi", exact: true }).click();
  await page.waitForURL(url => url.pathname === "/dashboard", { timeout: 90000 });
  await page.getByRole("heading", { name: "Oggi in " + buyer.name, exact: true })
    .waitFor({ state: "visible", timeout: 60000 });
}
try {
  const anon = await browser.newContext({ viewport:{width:390,height:844}, isMobile:true, locale:"it-IT" });
  const a = await anon.newPage();
  await step("public anonymous two-line calculator and copy-only RFQ path", async () => {
    await goto(a, "/distinta");
    const { bill } = await fillTwoTubularLines(a);
    assert.equal(await bill.getByRole("button", {name:/Crea RFQ privata/}).count(),0);
    assert.ok(await a.getByRole("link", {name:/Accedi per creare una RFQ privata/}).isVisible());
    await noOverflow(a,"anonymous mobile bill");
  });
  await anon.close();

  for (const width of [390, 1440]) {
    const ctx = await browser.newContext({
      viewport:{width,height:width===390?844:900},isMobile:width===390,
      locale:"it-IT",reducedMotion:"reduce",
    });
    const page = await ctx.newPage();
    await step("buyer local GoTrue login " + width, () => login(page));
    await step("create mixed-EN 10210/10219 bill with one-click rows " + width, async () => {
      await goto(page, "/rfq-hub/distinta");
      await page.getByLabel("Titolo distinta").fill("BD15 E2E LOCAL " + width);
      await page.getByLabel("Grado acciaio · facoltativo ora").fill("S355J2H");
      const { bill } = await fillTwoTubularLines(page);
      const btn = bill.getByRole("button", { name: /Crea RFQ privata/ });
      await btn.waitFor({state:"visible"});
      assert.equal(await btn.isEnabled(),true,"Mixed EN bill must be valid and immediately RFQ-ready");
      await noOverflow(page,"private bill "+width);
    });
    await step("one action persists bill and opens private draft RFQ " + width, async () => {
      await page.locator("#buyer-live-preview").getByRole("button",{name:/Crea RFQ privata/}).click();
      await page.waitForURL(url => /^\/rfq-hub\/[0-9a-f-]{36}$/.test(url.pathname),{timeout:60000});
      await page.getByRole("heading",{name:"BD15 E2E LOCAL "+width,exact:true})
        .waitFor({state:"visible",timeout:60000});
      const body = await page.locator("body").innerText();
      assert.match(body,/RFQ privata · preparazione/i);
      assert.match(body,/La RFQ è ancora privata/);
      assert.match(body,/1 · Scegli i fornitori/);
      assert.match(body,/2 · Verifica e invia/);
      assert.ok(!body.includes("Pubblicato nel Marketplace"),"Accidental Marketplace publication");
      await noOverflow(page,"new RFQ draft "+width);
    });
    await step("bulk select and add 2 previous suppliers in one click " + width, async () => {
      const first = page.getByRole("checkbox",{name:/Seleziona DEMO Steel Manufacturing/});
      const second = page.getByRole("checkbox",{name:/Seleziona DEMO Tubes Trading/});
      await first.waitFor({state:"visible",timeout:60000});
      await second.waitFor({state:"visible",timeout:60000});
      await first.check();
      await second.check();
      const bulk = page.getByRole("button",{name:"Aggiungi 2 alla RFQ"});
      assert.equal(await bulk.isEnabled(),true);
      await bulk.click();
      await page.getByText(/2 fornitori aggiunti alla RFQ/).waitFor({state:"visible",timeout:60000});
      await page.getByRole("button",{name:/Controlla 2 destinatari/})
        .waitFor({state:"visible",timeout:60000});
      await noOverflow(page,"selected suppliers "+width);
    });
    await step("review exact recipients and cancel without dispatch " + width, async () => {
      await page.getByRole("button",{name:/Controlla 2 destinatari/}).click();
      const review = page.getByRole("region",{name:"Conferma finale invio RFQ"});
      await review.waitFor({state:"visible",timeout:15000});
      const preview = await review.innerText();
      assert.match(preview,/DEMO Steel Manufacturing/);
      assert.match(preview,/DEMO Tubes Trading/);
      assert.match(preview,/rfqh14-producer@example.test/);
      assert.match(preview,/rfqh14-trader@example.test/);
      assert.match(preview,/Canale effettivo: email individuali/);
      assert.match(preview,/Il Marketplace non verrà pubblicato/);
      const confirm = review.getByRole("button",{name:/Conferma e invia a 2 fornitori/});
      assert.equal(await confirm.isEnabled(),false,"No dispatch without explicit affirmative consent");
      await review.getByRole("button",{name:/Annulla, modifica la RFQ/}).click();
      assert.equal(await review.count(),0);
      await noOverflow(page,"RFQ review "+width);
    });
    await step("real-send guarded when mail provider disabled " + width, async () => {
      await page.getByRole("button",{name:/Controlla 2 destinatari/}).click();
      const review=page.getByRole("region",{name:"Conferma finale invio RFQ"});
      await review.getByRole("checkbox",{name:/Ho verificato destinatari e indirizzi/}).check();
      await review.getByRole("button",{name:/Conferma e invia a 2 fornitori/}).click();
      await page.getByText(/canale email RFQ non è ancora configurato/).waitFor({state:"visible",timeout:45000});
      assert.equal(await review.count(),0);
      const body=await page.locator("body").innerText();
      assert.match(body,/RFQ privata · preparazione/i);
      await noOverflow(page,"disabled dispatch "+width);
    });
    await ctx.close();
  }
  console.log("BD15 E2E CHROME PASS",checks.length,
    "isolated checks; anonymous + real buyer; 390/1440; no provider email and no Marketplace publish");
} finally {
  await browser.close();
}
