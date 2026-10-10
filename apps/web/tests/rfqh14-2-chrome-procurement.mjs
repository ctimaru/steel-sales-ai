/**
 * RFQH14.2 — Real Google Chrome stable + local Supabase GoTrue + Next.js.
 * Two supplier tokens are random, ephemeral and never printed or persisted.
 * No Vercel, production DB, Resend/SMTP, external buyer or supplier requests.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const origin = process.env.DEMOTEST23_WEB_URL;
assert.equal(origin, "http://127.0.0.1:3000", "External Next URL prohibited");
assert.equal(process.env.NEXT_PUBLIC_SUPABASE_URL, "http://127.0.0.1:54321", "External Supabase prohibited");
const temp = process.env.RUNNER_TEMP;
assert.ok(temp, "GitHub runner ephemeral directory required");
const personas = JSON.parse(readFileSync(path.join(temp, "demotest23-personas.json"), "utf8"));
const tokens = JSON.parse(readFileSync(path.join(temp, "rfqh14-2-tokens.json"), "utf8"));
const buyer = personas.find(p => p.id === "buyer");
const producer = personas.find(p => p.id === "producer");
const trader = personas.find(p => p.id === "trader");
assert.ok(buyer && producer && trader && tokens.producer.token && tokens.trader.token);
const rfqPath = "/rfq-hub/" + buyer.rfq;
const checks = [];
const browser = await chromium.launch({ headless: true, channel: "chrome" });

const redact = x => String(x).replaceAll(tokens.producer.token, "[private producer token]")
  .replaceAll(tokens.trader.token, "[private trader token]");

async function step(label, fn) {
  try {
    await fn();
    checks.push(label);
    console.log("RFQH14.2 Chrome PASS", label);
  } catch (error) {
    console.error("RFQH14.2 Chrome FAIL", label, redact(error instanceof Error ? error.message : error));
    throw new Error("RFQH14.2 Chrome check failed: " + label);
  }
}
async function visit(page, href) {
  const res = await page.goto(origin + href, {waitUntil: "domcontentloaded",timeout: 90000});
  assert.ok(res, "No HTTP response");
  assert.ok(res.status() < 500, "Unexpected server HTTP " + res.status());
}
async function realLogin(page, person) {
  await visit(page, "/login");
  await page.locator('input[name="email"]').fill(person.email);
  await page.locator('input[name="password"]').fill(person.password);
  await page.getByRole("button",{name:"Accedi",exact:true}).click();
  await page.waitForURL(url => url.pathname === "/dashboard", {timeout:90000});
  await page.getByRole("heading", {name: "Oggi in " + person.name, exact:true})
    .waitFor({state:"visible",timeout:60000});
}
async function checkMobile(page, label) {
  await page.waitForLoadState("domcontentloaded");
  await page.locator("body").waitFor({state:"visible"});
  const widths = await page.evaluate(() => ({
    viewport:document.documentElement.clientWidth,full:document.documentElement.scrollWidth,
  }));
  assert.ok(widths.full <= widths.viewport + 12,
    label + " body overflow " + widths.full + " vs " + widths.viewport);
  const body = await page.locator("body").innerText();
  assert.ok(!body.includes("Application error: a server-side exception"),label + " runtime crash");
  assert.ok(body.trim().length > 40,label + " blank page");
}

try {
  const anon = await browser.newContext({viewport:{width:1440,height:900},locale:"it-IT"});
  const anonPage = await anon.newPage();
  await step("anonymous buyer RFQ redirects to login or real not-found", async () => {
    await visit(anonPage,rfqPath);
    await anonPage.waitForURL(url => url.pathname === "/login" || url.pathname === rfqPath,
      {timeout:30000});
    const body = await anonPage.locator("body").innerText();
    assert.ok(!body.includes(buyer.rfqTitle),"buyer RFQ title leaked");
  });
  await step("unknown supplier RFQ capability reveals no business details", async () => {
    await visit(anonPage,"/rfq/respond/" + "0".repeat(64));
    await anonPage.getByRole("heading",{name:"Link RFQ non disponibile"}).waitFor();
    const body = await anonPage.locator("body").innerText();
    assert.ok(!body.includes(buyer.rfqTitle));
  });
  await step("unknown supplier PO capability is rejected", async () => {
    await visit(anonPage,"/po/respond/" + "0".repeat(64));
    await anonPage.getByRole("heading",{name:"Link ordine non valido"}).waitFor();
  });
  await anon.close();

  const supplierContexts = {};
  for (const supplier of [producer,trader]) {
    const name = supplier.id;
    const ctx = await browser.newContext({viewport:{width:1440,height:900},locale:"it-IT"});
    supplierContexts[name] = ctx;
    const page = await ctx.newPage();
    const route = "/rfq/respond/" + tokens[name].token;
    await step(name + " anonymous isolated capability opens requested RFQ", async () => {
      await visit(page,route);
      await page.getByRole("heading",{name:buyer.rfqTitle,exact:true})
        .waitFor({state:"visible",timeout:60000});
      const body = await page.locator("body").innerText();
      assert.match(body,/EN 10210/);
      assert.match(body,/EN 10219/);
      assert.ok(!body.includes("DEMO Steel Processing"));
      const competitor = name === "producer" ? "DEMO Tubes Trading" : "DEMO Steel Manufacturing";
      assert.ok(!body.includes(competitor),"Competing supplier identity leaked");
      // Buyer has target price 900€/t and 22.5€/m in source data.
      assert.ok(!/Target\s*(?:€|EUR|prezzo)?\s*900\b/i.test(body),"Buyer private target disclosed");
      assert.ok(!body.includes("€ 22,5/m"),"Buyer private metre target disclosed");
      assert.ok(body.includes("Target buyer non condiviso"),"Supplier privacy guidance missing");
    });
    await step(name + " Chrome guest UI supports private line-level quote",async()=>{
      assert.ok(await page.getByRole("button",{name:"Salva bozza"}).isVisible());
      assert.ok(await page.getByRole("button",{name:"Invia offerta"}).isVisible());
    });
    if (name === "producer") {
      await step("producer submits local quote in browser with normalized prices",async()=>{
        const prices=page.locator('input[placeholder="es. 760"]');
        assert.equal(await prices.count(),2,"Expected mixed two-line RFQ");
        await prices.nth(0).fill("735");
        await prices.nth(1).fill("755");
        await page.getByRole("button",{name:"Salva bozza"}).click();
        await page.getByText("Bozza salvata.",{exact:true})
          .waitFor({state:"visible",timeout:45000});
        await page.getByRole("button",{name:"Invia offerta"}).click();
        await page.getByText(/Offerta inviata|submitted/i).first()
          .waitFor({state:"visible",timeout:45000});
      });
    }
  }

  await step("trader cannot see producer private offer after producer submission", async () => {
    const page = supplierContexts.trader.pages()[0];
    await page.reload({waitUntil:"domcontentloaded"});
    await page.getByRole("heading",{name:buyer.rfqTitle,exact:true})
      .waitFor({state:"visible",timeout:60000});
    const body = await page.locator("body").innerText();
    assert.ok(!/\b735\b|\b755\b/.test(body),"Competing supplier unit prices leaked");
  });
  for (const context of Object.values(supplierContexts)) await context.close();

  const buyerContext=await browser.newContext({viewport:{width:1440,height:900},locale:"it-IT"});
  const buyerPage=await buyerContext.newPage();
  await step("buyer uses real GoTrue login",()=>realLogin(buyerPage,buyer));
  await step("buyer private RFQ detail receives supplier quote",async()=>{
    await visit(buyerPage,rfqPath);
    await buyerPage.getByRole("heading",{name:buyer.rfqTitle,exact:true})
      .waitFor({state:"visible",timeout:60000});
    const body=await buyerPage.locator("body").innerText();
    assert.ok(body.includes("735"),"Normalized submitted supplier quote not shown");
    assert.ok(body.includes("DEMO Steel Manufacturing"),"Supplier missing");
  });
  for (const route of ["/rfq-hub/inbox","/rfq-hub/suppliers","/rfq-hub/intelligence"]) {
    await step("buyer own procurement page "+route,async()=>{
      await visit(buyerPage,route);
      const body=await buyerPage.locator("body").innerText();
      assert.ok(body.trim().length>80);
      assert.ok(!body.includes("Application error: a server-side exception"));
    });
  }
  await buyerContext.close();

  for (const other of [trader,producer]) {
    const ctx=await browser.newContext({viewport:{width:1440,height:900},locale:"it-IT"});
    const page=await ctx.newPage();
    await step(other.id + " real GoTrue login for cross-tenant RFQH14 security",()=>realLogin(page,other));
    await step(other.id + " cannot read buyer procurement",async()=>{
      await visit(page,rfqPath);
      await page.waitForFunction(title=>{
        const txt=document.body.innerText;
        return /404|non trovata|not found|could not be found/i.test(txt)||txt.includes(title);
      },buyer.rfqTitle,{timeout:60000});
      const body=await page.locator("body").innerText();
      assert.ok(!body.includes(buyer.rfqTitle),"Cross-tenant RFQ exposed");
      assert.ok(!body.includes("735"),"Cross-tenant supplier price exposed");
    });
    await ctx.close();
  }

  for (const width of [390,430]) {
    const mctx=await browser.newContext({
      viewport:{width,height:width===390?844:932},isMobile:true,deviceScaleFactor:2,locale:"it-IT"
    });
    const page=await mctx.newPage();
    await step("Chrome mobile "+width+" buyer real login",()=>realLogin(page,buyer));
    for (const route of [rfqPath,"/rfq-hub/inbox","/rfq-hub/suppliers","/rfq-hub/intelligence"]) {
      await step("Chrome mobile "+width+" buyer "+route,async()=>{
        await visit(page,route);
        await checkMobile(page,route);
      });
    }
    const guest=await mctx.newPage();
    await step("Chrome mobile "+width+" supplier portal without login",async()=>{
      await visit(guest,"/rfq/respond/"+tokens.trader.token);
      await guest.getByRole("heading",{name:buyer.rfqTitle,exact:true})
        .waitFor({state:"visible",timeout:60000});
      await checkMobile(guest,"supplier portal");
    });
    await mctx.close();
  }

  console.log("RFQH14.2 CHROME PASS",checks.length,
    "checks, ephemeral GoTrue identities, supplier quote submitted locally, no Vercel traffic");
} finally {
  await browser.close();
}
