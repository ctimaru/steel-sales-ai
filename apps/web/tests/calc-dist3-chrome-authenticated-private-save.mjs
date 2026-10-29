/**
 * CALC-DIST3 acceptance: real GoTrue login + company-private named Distinta
 * stored via existing server action, then archive/reopen in Commerciale.
 * Runs ONLY with disposable FLOW1 local Supabase and synthetic personas.
 * NEVER creates a campaign, chooses recipients, or sends email.
 */
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import path from "node:path";
import {createClient} from "@supabase/supabase-js";
import {chromium} from "playwright";

const URL_ROOT=process.env.DEMOTEST23_WEB_URL;
assert.equal(URL_ROOT,"http://127.0.0.1:3000","No external application allowed");
assert.equal(process.env.NEXT_PUBLIC_SUPABASE_URL,"http://127.0.0.1:54321","No external database allowed");
assert.equal(process.env.FLOW1_LOCAL_PROVIDER,"true","Only CI-local synthetic transport");
assert.ok(process.env.RUNNER_TEMP,"CI ephemeral fixture directory is required");
const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
assert.ok(key&&key.length>20,"Local publishable key is required");
const personas=JSON.parse(readFileSync(path.join(process.env.RUNNER_TEMP,"demotest23-personas.json"),"utf8"));
const buyer=personas.find(p=>p.id==="buyer"),producer=personas.find(p=>p.id==="producer");
assert.ok(buyer&&producer,"Two distinct tenant fixtures are required");

async function authenticatedClient(person) {
  const client=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,key,
    {auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
  const {error}=await client.auth.signInWithPassword({email:person.email,password:person.password});
  assert.equal(error,null,"Local user authentication failed");
  return client;
}
async function readRows(query) {
  const {data,error}=await query;
  assert.equal(error,null,"Local RLS read failed");
  return data;
}
const browser=await chromium.launch({headless:true,channel:"chrome"});
try {
  const buyerDb=await authenticatedClient(buyer);
  const differentOrgDb=await authenticatedClient(producer);
  for(const width of [390,1440]) {
    const ctx=await browser.newContext({viewport:{width,height:900},locale:"it-IT",reducedMotion:"reduce"});
    await ctx.route("**/*",route=>{
      const host=new URL(route.request().url()).hostname;
      return ["127.0.0.1","localhost","[::1]"].includes(host)?route.continue():route.abort();
    });
    const page=await ctx.newPage(),errors=[];
    page.on("pageerror",e=>errors.push(e.message));
    try {
      const suffix="CALC-DIST3 LOCAL PRIVATE "+width;
      await page.goto(URL_ROOT+"/login",{waitUntil:"domcontentloaded",timeout:90000});
      await page.locator('input[name="email"]').fill(buyer.email);
      await page.locator('input[name="password"]').fill(buyer.password);
      await page.getByRole("button",{name:"Accedi",exact:true}).click();
      await page.waitForURL(u=>u.pathname==="/dashboard",{timeout:90000});
      const consent=page.getByTestId("mobile-cookie-consent");
      if(await consent.isVisible()) await consent.getByRole("button",{name:"Accetta necessari"}).click();

      await page.goto(URL_ROOT+"/knowledge/tubes",{waitUntil:"domcontentloaded",timeout:60000});
      const calc=page.locator("#calcolatore-pesi[data-calculator-ready='true']");
      await calc.waitFor({timeout:60000});
      const articles=[
        {standard:"en10219",shape:0,dimensions:["168.3","6"],bars:"2",length:"12"},
        {standard:"en10210",shape:1,dimensions:["100","6"],bars:"3",length:"6"},
        {standard:"en10219",shape:2,dimensions:["150","100","5"],bars:"1",length:"8"},
      ];
      for(const [index,item] of articles.entries()) {
        await calc.getByRole("combobox",{name:"Norma"}).selectOption(item.standard);
        await calc.locator("[data-calc-shape-buttons] button").nth(item.shape).click();
        const dims=calc.locator("[data-cockpit-measurements] input");
        assert.equal(await dims.count(),item.dimensions.length,"Correct geometry controls");
        for(const [i,value] of item.dimensions.entries()) await dims.nth(i).fill(value);
        await calc.locator("[data-cockpit-length-quantity] input").first().fill(item.length);
        await calc.locator("#tube-calculator-quantity").fill(item.bars);
        await calc.locator("[data-cockpit-add]").click();
      }
      await page.getByTestId("calculator-cart-trigger").click();
      const drawer=page.locator("#distinta-inline-dialog");
      assert.equal(await drawer.locator("[data-distinta-compact-row]").count(),3);
      await drawer.locator("[data-distinta-name-field] input").fill(suffix);
      const privateSave=drawer.locator("[data-save-private-distinta]");
      assert.equal(await privateSave.isEnabled(),true);
      await privateSave.click();
      const link=drawer.locator("[data-distinta-saved-link]");
      await link.waitFor({state:"visible",timeout:60000});
      const href=await link.getAttribute("href");
      assert.match(href,/^\/rfq-hub\/distinte\/[0-9a-f-]{36}$/i);
      const distinctId=href.split("/").at(-1);

      const saved=await readRows(buyerDb.from("buyer_distintas")
        .select("id,title,owner_user_id,organization_id,line_count,total_meters,total_tonnes")
        .eq("id",distinctId));
      assert.equal(saved.length,1,"Exactly one private snapshot exists");
      assert.equal(saved[0].title,suffix,"Custom name must survive RPC");
      assert.equal(saved[0].owner_user_id,buyer.userId,"Authenticated owner is stored");
      assert.equal(saved[0].organization_id,buyer.org,"Snapshot belongs to active company");
      assert.equal(saved[0].line_count,3,"All different technical lines must persist");
      assert.equal(Number(saved[0].total_meters),50,"Theoretical lengths match 24+18+8 m");
      const savedLines=await readRows(buyerDb.from("buyer_distinta_lines")
        .select("line_position,description,standard_code,quantity,bar_length_m,target_eur_t")
        .eq("distinta_id",distinctId).order("line_position"));
      assert.equal(savedLines.length,3);
      assert.deepEqual(savedLines.map(x=>x.standard_code),["EN 10219","EN 10210","EN 10219"]);
      assert.deepEqual(savedLines.map(x=>Number(x.quantity)),[2,3,1]);
      assert.deepEqual(savedLines.map(x=>Number(x.bar_length_m)),[12,6,8]);
      assert.ok(savedLines.every(x=>x.target_eur_t===null),"Targets are private and opt-in only");

      const campaigns=await readRows(buyerDb.from("buyer_rfq_campaigns")
        .select("id").eq("source_distinta_id",distinctId));
      const deliveries=await readRows(buyerDb.from("buyer_distinta_deliveries")
        .select("id").eq("distinta_id",distinctId));
      assert.equal(campaigns.length,0,"Private save must not create RFQ campaign");
      assert.equal(deliveries.length,0,"Private save must not send suppliers");

      await page.goto(URL_ROOT+"/commercial",{waitUntil:"domcontentloaded",timeout:60000});
      const entry=page.locator("[data-commercial-saved-distinte-entry]");
      await entry.waitFor({timeout:60000});
      assert.equal(await entry.getAttribute("href"),"/rfq-hub/distinte");
      await entry.click();
      await page.waitForURL(u=>u.pathname==="/rfq-hub/distinte",{timeout:60000});
      const storedLink=page.getByRole("link",{name:new RegExp(suffix)});
      await storedLink.waitFor({timeout:60000});
      await storedLink.click();
      await page.waitForURL(u=>u.pathname==="/rfq-hub/distinte/"+distinctId,{timeout:60000});
      assert.ok((await page.locator("h1").innerText()).includes(suffix));
      assert.match(await page.locator("body").innerText(),/168[.,]3/);
      assert.match(await page.locator("body").innerText(),/EN 10210/);
      assert.match(await page.locator("body").innerText(),/EN 10219/);

      const outsider=await readRows(differentOrgDb.from("buyer_distintas")
        .select("id").eq("id",distinctId));
      assert.equal(outsider.length,0,"Cross-tenant user must not read private snapshot");

      // CALC-DIST4: manage the same REAL authenticated local record.
      const manage=page.locator("[data-saved-distinta-actions]").first();
      await manage.locator("[data-action-rename]").click();
      const renamedTitle="CALC-DIST4 RENAMED "+width;
      await manage.locator("[data-saved-distinta-rename-input]").fill(renamedTitle);
      await manage.getByRole("button",{name:"Conferma"}).click();
      await page.getByRole("heading",{name:renamedTitle}).waitFor();
      const renamed=await readRows(buyerDb.from("buyer_distintas")
        .select("title,archived_at,total_meters,line_count").eq("id",distinctId));
      assert.equal(renamed[0].title,renamedTitle);
      assert.equal(renamed[0].archived_at,null);
      assert.equal(renamed[0].line_count,3);
      assert.equal(Number(renamed[0].total_meters),50);

      // Non-owner and non-business data are inaccessible on both SELECT and UPDATE.
      const {data:deniedRename,error:crossError}=await differentOrgDb.from("buyer_distintas")
        .update({title:"UNAUTHORIZED"}).eq("id",distinctId).select("id");
      assert.ok(crossError!==null||!deniedRename?.length,"RLS must reject cross-org metadata edit");
      const {error:deniedTechnical}=await buyerDb.from("buyer_distintas")
        .update({total_tonnes:999}).eq("id",distinctId);
      assert.ok(deniedTechnical,"Column-level UPDATE must reject technical mass rewrite");

      const oldLines=await readRows(buyerDb.from("buyer_distinta_lines")
        .select("line_position,description,standard_code,weight_kg_m,quantity,bar_length_m,target_eur_t")
        .eq("distinta_id",distinctId).order("line_position"));
      await manage.locator("[data-action-duplicate]").click();
      await page.waitForURL(u=>u.pathname.startsWith("/rfq-hub/distinte/")&&
        u.pathname!=="/rfq-hub/distinte/"+distinctId,{timeout:60000});
      const copyId=page.url().split("/").at(-1);
      const copy=await readRows(buyerDb.from("buyer_distintas")
        .select("id,title,line_count,total_meters,total_tonnes,archived_at")
        .eq("id",copyId));
      assert.equal(copy.length,1);
      assert.equal(copy[0].title,"Copia di "+renamedTitle);
      assert.equal(copy[0].line_count,3);
      assert.equal(copy[0].archived_at,null);
      const copyLines=await readRows(buyerDb.from("buyer_distinta_lines")
        .select("line_position,description,standard_code,weight_kg_m,quantity,bar_length_m,target_eur_t")
        .eq("distinta_id",copyId).order("line_position"));
      assert.deepEqual(copyLines,oldLines,"Duplicate must preserve every technical/private line exactly");
      const copyCampaigns=await readRows(buyerDb.from("buyer_rfq_campaigns")
        .select("id").eq("source_distinta_id",copyId));
      assert.equal(copyCampaigns.length,0,"Duplicate must never create an RFQ");

      // Archive and restore are reversible, preserving the same snapshot id.
      await page.goto(URL_ROOT+"/rfq-hub/distinte/"+distinctId,{waitUntil:"domcontentloaded"});
      await page.locator("[data-saved-distinta-actions] [data-action-archive]").click();
      await page.getByText(/Distinta archiviata: conservata/).waitFor({timeout:60000});
      await page.goto(URL_ROOT+"/rfq-hub/distinte?q="+encodeURIComponent(renamedTitle),{waitUntil:"domcontentloaded"});
      assert.equal(await page.locator("[data-dist4-row]").count(),0,"Archived bill absent in active list");
      await page.locator("[data-dist4-archived-tab]").click();
      assert.equal(await page.locator("[data-dist4-row]").count(),1);
      await page.locator("[data-dist4-row] [data-action-archive]").click();
      await page.locator("[data-dist4-active-tab]").click();
      assert.equal(await page.locator("[data-dist4-row]").count(),1,"Restored bill visible in active view");
      const restored=await readRows(buyerDb.from("buyer_distintas")
        .select("id,archived_at,title").eq("id",distinctId));
      assert.equal(restored[0].id,distinctId);
      assert.equal(restored[0].archived_at,null);
      assert.equal(restored[0].title,renamedTitle);
      const afterLines=await readRows(buyerDb.from("buyer_distinta_lines")
        .select("line_position,description,standard_code,weight_kg_m,quantity,bar_length_m,target_eur_t")
        .eq("distinta_id",distinctId).order("line_position"));
      assert.deepEqual(afterLines,oldLines,"Rename/archive/restore must never edit buyer lines");
      assert.deepEqual(errors,[],"No browser exceptions");
      console.log("CALC-DIST3 AUTHENTICATED SAVE/REOPEN/RLS PASS",width);
    } finally {await ctx.close();}
  }
} finally {await browser.close();}
