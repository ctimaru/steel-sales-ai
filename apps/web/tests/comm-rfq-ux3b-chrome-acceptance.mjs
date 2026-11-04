/**
 * COMM-RFQ-UX3.B — end-to-end buyer acceptance against disposable FLOW1.
 * Explicit AI analysis -> missing information -> human corrections ->
 * nine approved rows -> private save -> Supabase RLS -> saved document reopen.
 * LOCAL SYNTHETIC ONLY: no external AI provider or supplier delivery.
 */
import assert from "node:assert/strict";
import { readFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";
import fixture from "./comm-rfq-ux3b-local-fixture.cjs";

const base = process.env.DEMOTEST23_WEB_URL;
assert.equal(process.env.CI, "true");
assert.equal(process.env.FLOW1_LOCAL_PROVIDER, "true");
assert.equal(base, "http://127.0.0.1:3000");
assert.equal(process.env.NEXT_PUBLIC_SUPABASE_URL, "http://127.0.0.1:54321");
assert.ok(process.env.RUNNER_TEMP);
assert.equal(fixture.lines.length, 10);
assert.equal(fixture.lines[7].grade, "");
assert.equal(fixture.lines[8].standard, "");
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
assert.ok(key && key.length > 20);
const personas = JSON.parse(readFileSync(path.join(process.env.RUNNER_TEMP,"demotest23-personas.json"),"utf8"));
const buyer = personas.find(x=>x.id==="buyer");
const outsider = personas.find(x=>x.id==="producer");
assert.ok(buyer && outsider);
const screenshotDir = path.join(process.env.RUNNER_TEMP,"comm-rfq-ux3b-visual-evidence");
mkdirSync(screenshotDir,{recursive:true});

async function dbFor(p) {
  const client=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,key,{
    auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
  });
  const {error}=await client.auth.signInWithPassword({email:p.email,password:p.password});
  assert.equal(error,null,"synthetic local user must authenticate");
  return client;
}
async function rows(query,label) {
  const {data,error}=await query;
  assert.equal(error,null,label+" local RLS query failed");
  return data;
}
async function login(page,p) {
  await page.goto(base+"/login",{waitUntil:"domcontentloaded",timeout:90000});
  await page.locator('input[name="email"]').fill(p.email);
  await page.locator('input[name="password"]').fill(p.password);
  await page.getByRole("button",{name:"Accedi",exact:true}).click();
  await page.waitForURL(url=>url.pathname==="/dashboard",{timeout:90000});
}
async function noHorizontalOverflow(page,label) {
  const size=await page.evaluate(()=>({
    client:document.documentElement.clientWidth,
    scroll:document.documentElement.scrollWidth,
  }));
  assert.ok(size.scroll<=size.client+12,label+" horizontal overflow "+JSON.stringify(size));
}
const browser=await chromium.launch({channel:"chrome",headless:true});
try {
  const buyerDb=await dbFor(buyer);
  const outsiderDb=await dbFor(outsider);
  for(const width of [1440,390,320]) {
    const height=width===1440?900:width===390?844:720;
    const ctx=await browser.newContext({
      viewport:{width,height},isMobile:width<1000,
      deviceScaleFactor:width<1000?2:1,locale:"it-IT",reducedMotion:"reduce",
    });
    await ctx.route("**/*",route=>{
      const host=new URL(route.request().url()).hostname;
      return ["127.0.0.1","localhost","[::1]"].includes(host)?route.continue():route.abort();
    });
    try {
      const page=await ctx.newPage();
      await login(page,buyer);
      await page.goto(base+"/commercial?compose=1&method=ai#commercial-ai-intake",{
        waitUntil:"domcontentloaded",timeout:90000,
      });
      const composer=page.locator("#rfqai2-text-input");
      await composer.waitFor({state:"visible",timeout:60000});
      await composer.fill(fixture.text);
      await page.getByRole("button",{name:"Analizza la richiesta con AI"}).click();
      const articles=page.locator(".rfqai3-candidate");
      // Fail fast with the existing user-visible error instead of waiting
      // 60 seconds for a candidate if the protected AI action refused input.
      const firstOutcome = await Promise.race([
        articles.first().waitFor({state:"visible",timeout:60000}).then(()=> "proposals"),
        page.getByText("Limite temporaneo raggiunto: riprova più tardi.",{exact:true})
          .waitFor({state:"visible",timeout:60000}).then(()=> "rate-limited"),
      ]);
      assert.equal(firstOutcome,"proposals","Local UX3.B AI analysis must respect the per-user burst window");
      assert.equal(await articles.count(),10,"Ten sourced lines actually entered the reviewer");
      const live=page.getByTestId("commercial-rfq-live-preview");
      const proposed=page.getByTestId("commercial-rfq-ai-proposals");
      const approved=page.getByTestId("commercial-rfq-approved-lines");
      assert.equal(await proposed.locator("li").count(),10);
      assert.match(await approved.textContent(),/0 righe/);
      assert.equal(await live.locator("button").filter({hasText:"Salva distinta privata"}).isDisabled(),true);
      const row8=page.getByRole("article",{name:"Articolo AI 8",exact:true});
      const row9=page.getByRole("article",{name:"Articolo AI 9",exact:true});
      assert.equal(await row8.locator('input[type="checkbox"]').isDisabled(),true,
        "Missing grade must block confirmation");
      assert.equal(await row9.locator('input[type="checkbox"]').isDisabled(),true,
        "Missing standard must block confirmation");
      assert.match(await row8.innerText(),/informazione mancante|Conferma disabilitata/);
      await noHorizontalOverflow(page,"proposals-"+width);
      await page.screenshot({path:path.join(screenshotDir,"ux3b-"+width+"-ten-mixed-proposals.png"),animations:"disabled"});

      // Every correction is local, numbered and unapproved until human review.
      const fixes=[
        {command:"riga 2: 20 barre",index:1,match:"20 PZ"},
        {command:"riga 8: qualità S235JRH",index:7,match:"S235JRH"},
        {command:"riga 9: norma EN 10210",index:8,match:"EN 10210"},
      ];
      for(const fix of fixes) {
        await composer.fill(fix.command);
        await page.getByRole("button",{name:"Correggi proposta AI"}).click();
        await page.waitForFunction(({index,match})=>
          [...document.querySelectorAll(".rfqai3-candidate")][index]?.textContent?.includes(match),
          {index:fix.index,match:fix.match},{timeout:30000});
      }
      await page.getByRole("article",{name:"Articolo AI 9",exact:true})
        .locator('input[type="checkbox"]').waitFor({state:"attached"});
      // Wait for corrected review state, not just the initial checkbox.
      await page.waitForFunction(()=>{
        const articles=[...document.querySelectorAll(".rfqai3-candidate")];
        return articles.length===10 && !articles[7].querySelector('input[type="checkbox"]')?.disabled &&
          !articles[8].querySelector('input[type="checkbox"]')?.disabled;
      },null,{timeout:30000});
      assert.match(await row8.innerText(),/S235JRH/);
      assert.match(await row9.innerText(),/EN 10210/);
      assert.match(await approved.textContent(),/0 righe/);
      assert.equal(await live.locator("button").filter({hasText:"Salva distinta privata"}).isDisabled(),true);

      // Do not select line 10: only 9 explicitly verified lines may persist.
      for(let i=1;i<=9;i++)
        await page.getByRole("article",{name:"Articolo AI "+i,exact:true})
          .locator('input[type="checkbox"]').check();
      await page.getByRole("button",{name:"Inserisci 9 articoli nella distinta"}).click();
      await page.waitForFunction(()=>
        document.querySelector('[data-testid="commercial-rfq-approved-lines"]')?.textContent?.includes("9 righe"),
        null,{timeout:30000});
      assert.equal(await approved.locator("li").count(),9);
      assert.equal(await proposed.count(),0,"Non-imported candidate cannot leak into the saved Distinta");
      await noHorizontalOverflow(page,"approved-"+width);

      if(width<1000) await page.getByRole("tab",{name:/Distinta/}).click();
      const title="COMM-RFQ-UX3B PRIVATE LOCAL "+width;
      await live.getByLabel("Nome della distinta").fill(title);
      await page.screenshot({path:path.join(screenshotDir,"ux3b-"+width+"-nine-approved-preview.png"),animations:"disabled"});
      const save=live.getByRole("button",{name:"Salva distinta privata"});
      assert.equal(await save.isEnabled(),true);
      await save.click();
      const savedLink=live.getByTestId("comm-rfq-saved-distinta-link");
      await savedLink.waitFor({state:"visible",timeout:60000});
      // The save CTA deliberately changes label after success; the old
      // role/name locator no longer exists. Assert the actual post-save state.
      const savedButton=live.getByRole("button",{name:"Distinta salvata ✓",exact:true});
      assert.equal(await savedButton.isDisabled(),true,
        "Second save cannot create a duplicate snapshot");
      const href=await savedLink.getAttribute("href");
      assert.match(href,/^\/rfq-hub\/distinte\/[0-9a-f-]{36}$/i);
      const savedId=href.split("/").at(-1);
      const saved=await rows(buyerDb.from("buyer_distintas")
        .select("id,title,owner_user_id,organization_id,line_count,total_meters,total_tonnes")
        .eq("id",savedId),"buyer Distinta");
      assert.equal(saved.length,1);
      assert.equal(saved[0].title,title);
      assert.equal(saved[0].owner_user_id,buyer.userId);
      assert.equal(saved[0].organization_id,buyer.org);
      assert.equal(saved[0].line_count,9);
      assert.ok(Math.abs(Number(saved[0].total_meters)-1278)<0.01,"Corrected quantities and lengths determine total meters");
      assert.ok(Number(saved[0].total_tonnes)>0);
      const storedLines=await rows(buyerDb.from("buyer_distinta_lines")
        .select("line_position,standard_code,grade_code,quantity,bar_length_m,target_eur_t")
        .eq("distinta_id",savedId).order("line_position"),"buyer Distinta lines");
      assert.equal(storedLines.length,9);
      assert.deepEqual(storedLines.map(x=>x.line_position),[1,2,3,4,5,6,7,8,9]);
      assert.equal(Number(storedLines[1].quantity),20,"Chat correction persists into the private snapshot");
      assert.equal(storedLines[7].grade_code,"S235JRH");
      assert.equal(storedLines[8].standard_code,"EN 10210");
      assert.ok(storedLines.every(x=>x.target_eur_t===null));
      const campaigns=await rows(buyerDb.from("buyer_rfq_campaigns")
        .select("id").eq("source_distinta_id",savedId),"RFQ campaigns");
      const deliveries=await rows(buyerDb.from("buyer_distinta_deliveries")
        .select("id").eq("distinta_id",savedId),"supplier deliveries");
      assert.equal(campaigns.length,0,"Private save must never create a campaign");
      assert.equal(deliveries.length,0,"Private save must never dispatch supplier mail");
      const crossTenant=await rows(outsiderDb.from("buyer_distintas")
        .select("id").eq("id",savedId),"cross-tenant snapshot");
      assert.equal(crossTenant.length,0,"RLS denies another organization");
      await savedLink.click();
      await page.waitForURL(url=>url.pathname==="/rfq-hub/distinte/"+savedId,{timeout:60000});
      assert.match(await page.locator("h1").innerText(),new RegExp(title));
      assert.match(await page.locator("body").innerText(),/EN 10210/);
      await noHorizontalOverflow(page,"reopened-"+width);
      await page.screenshot({path:path.join(screenshotDir,"ux3b-"+width+"-reopened-private-distinta.png"),animations:"disabled"});
      console.log("COMM-RFQ-UX3.B TEN -> CORRECT MISSING -> NINE -> PRIVATE SAVE -> REOPEN + RLS PASS",width);
    } finally {
      await ctx.close();
    }
  }
} finally {
  await browser.close();
}
console.log("COMM-RFQ-UX3.B AUTHENTICATED LOCAL ACCEPTANCE PASS");
