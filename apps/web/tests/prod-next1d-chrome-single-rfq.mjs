/**
 * PROD-NEXT1.D — the SAME RFQ created by BD15's Chrome Distinta flows is
 * quoted and confirmed as PO. Local browser + disposable Supabase ONLY.
 * NOTE: award/PO approval preparation are via existing authenticated business
 * RPCs in a local SQL step. Quote, independent approval, issue and confirmation
 * are executed through actual Chrome interfaces.
 * No provider calls, external accounts, token logs, screenshots or traces.
 */
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, chmodSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const stage=process.argv[2];
assert.ok(["quote","po"].includes(stage),"Expected quote or po phase");
const origin=process.env.DEMOTEST23_WEB_URL;
assert.equal(origin,"http://127.0.0.1:3000","Local Next.js ONLY");
assert.equal(process.env.NEXT_PUBLIC_SUPABASE_URL,"http://127.0.0.1:54321","Local Supabase ONLY");
assert.equal(process.env.RESEND_API_KEY??"","","External provider sends forbidden");
const temp=process.env.RUNNER_TEMP;
assert.ok(temp && path.isAbsolute(temp),"Ephemeral runner required");
const id=readFileSync(path.join(temp,"prod-next1d-rfq-id.txt"),"utf8").trim();
assert.match(id,/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
const tokens=JSON.parse(readFileSync(path.join(temp,"prod-next1d-tokens.json"),"utf8"));
const personas=JSON.parse(readFileSync(path.join(temp,"demotest23-personas.json"),"utf8"));
const buyer=personas.find(p=>p.id==="buyer");
const approver=personas.find(p=>p.id==="buyerViewer");
const trader=personas.find(p=>p.id==="trader");
assert.ok(buyer&&approver&&trader&&buyer.userId!==approver.userId&&buyer.org===approver.org);
const title="BD15 E2E LOCAL 1440";
const route="/rfq-hub/"+id;
const browser=await chromium.launch({headless:true,channel:"chrome"});
const metrics=[];
async function step(name,fn){
  const start=Date.now();
  try { await fn(); metrics.push({stage:name, duration_ms:Date.now()-start});
    console.log("PROD-NEXT1.D Chrome PASS",name); }
  catch(e){console.error("PROD-NEXT1.D Chrome FAIL",name);
    throw new Error("PROD-NEXT1.D failed: "+name); }
}
async function visit(page,suffix){
  const res=await page.goto(origin+suffix,{waitUntil:"domcontentloaded",timeout:90000});
  assert.ok(res&&res.status()<500,"Local app error");
}
async function login(page,person){
  await visit(page,"/login");
  await page.locator('input[name="email"]').fill(person.email);
  await page.locator('input[name="password"]').fill(person.password);
  await page.getByRole("button",{name:"Accedi",exact:true}).click();
  await page.waitForURL(u=>u.pathname==="/dashboard",{timeout:90000});
  await page.getByRole("heading",{name:"Oggi in "+person.name,exact:true})
    .waitFor({state:"visible",timeout:60000});
}
async function buyerRFQ(page){
  await visit(page,route);
  await page.getByRole("heading",{name:title,exact:true})
    .waitFor({state:"visible",timeout:60000});
}
const proofFile=path.join(temp,"prod-next1d-single-rfq-proof.json");
try {
  if(stage==="quote"){
    const ctx=await browser.newContext({viewport:{width:1440,height:900},locale:"it-IT"});
    const supplierPage=await ctx.newPage();
    await step("same_rfq_supplier_portal",async()=>{
      await visit(supplierPage,"/rfq/respond/"+tokens.producer.token);
      await supplierPage.getByRole("heading",{name:title,exact:true})
        .waitFor({state:"visible",timeout:60000});
      const text=await supplierPage.locator("body").innerText();
      assert.ok(text.includes("EN 10219")&&text.includes("EN 10210"),
        "Supplier portal is not the mixed-standard BD15-created RFQ");
      assert.ok(text.includes("Target buyer non condiviso"),
        "Buyer-only targets must remain private");
    });
    await step("same_rfq_quote_submitted",async()=>{
      await supplierPage.locator('[data-supplier-response-ready="true"]')
        .waitFor({state:"attached",timeout:60000});
      const prices=supplierPage.locator('input[placeholder="es. 760"]');
      assert.equal(await prices.count(),2,"Expected original two BD15 lines");
      await prices.nth(0).fill("735");
      await prices.nth(1).fill("755");
      assert.equal(await prices.nth(0).inputValue(),"735");
      assert.equal(await prices.nth(1).inputValue(),"755");
      await supplierPage.getByRole("button",{name:"Salva bozza"}).click();
      await supplierPage.getByText("Bozza salvata.",{exact:true})
        .waitFor({state:"visible",timeout:45000});
      assert.equal(await prices.nth(0).inputValue(),"735");
      assert.equal(await prices.nth(1).inputValue(),"755");
      await supplierPage.getByRole("button",{name:"Invia offerta"}).click();
      await supplierPage.getByText(/Offerta inviata|submitted/i).first()
        .waitFor({state:"visible",timeout:45000});
    });
    await step("same_rfq_trader_cannot_see_quote",async()=>{
      const pg=await ctx.newPage();
      await visit(pg,"/rfq/respond/"+tokens.trader.token);
      await pg.getByRole("heading",{name:title,exact:true}).waitFor({state:"visible",timeout:60000});
      const body=await pg.locator("body").innerText();
      assert.ok(!/\b735\b|\b755\b/.test(body),"Other supplier's prices leaked");
    });
    await ctx.close();
    const ownerContext=await browser.newContext({viewport:{width:1440,height:900},locale:"it-IT"});
    const owner=await ownerContext.newPage();
    await step("same_rfq_buyer_receives_quote",async()=>{
      await login(owner,buyer);
      await buyerRFQ(owner);
      const body=await owner.locator("body").innerText();
      assert.ok(body.includes("735")&&body.includes("DEMO Steel Manufacturing"),
        "Submitted quote missing from original BD15 RFQ");
    });
    await ownerContext.close();
    const otherCtx=await browser.newContext({viewport:{width:1440,height:900},locale:"it-IT"});
    await step("same_rfq_cross_company_denial",async()=>{
      const pg=await otherCtx.newPage();
      await login(pg,trader);
      await visit(pg,route);
      await pg.waitForFunction(t=>{
        const body=document.body.innerText;
        return !body.includes("Caricamento workspace") &&
          (body.includes(t)||/404|non trovata|not found|could not be found/i.test(body));
      },title,{timeout:60000});
      const body=await pg.locator("body").innerText();
      assert.ok(!body.includes(title)&&!body.includes("735"),
        "Another company accessed the same buyer's private RFQ/price");
    });
    await otherCtx.close();
    writeFileSync(proofFile,JSON.stringify({
      schema:"prod-next1d/v1",classification:"synthetic_ci_only",
      environment:"disposable_local_next_supabase",quote_browser_pass:true,
      steps:metrics},null,2)+"\n",{mode:0o600});
    chmodSync(proofFile,0o600);
  } else {
    const previous=JSON.parse(readFileSync(proofFile,"utf8"));
    assert.equal(previous.quote_browser_pass,true,"Exact same RFQ quote stage must pass");
    assert.equal(previous.classification,"synthetic_ci_only");
    const buyerCtx=await browser.newContext({viewport:{width:1440,height:900},locale:"it-IT",
      permissions:["clipboard-read","clipboard-write"]});
    const buyerPage=await buyerCtx.newPage();
    await step("same_rfq_owner_cannot_self_approve",async()=>{
      await login(buyerPage,buyer); await buyerRFQ(buyerPage);
      await buyerPage.getByText("Emissione PO",{exact:true}).waitFor({state:"visible",timeout:45000});
      assert.equal(await buyerPage.getByRole("button",{name:"Approva",exact:true}).count(),0);
    });
    const approverCtx=await browser.newContext({viewport:{width:1440,height:900},locale:"it-IT"});
    const approverPage=await approverCtx.newPage();
    await step("same_rfq_independent_approval",async()=>{
      await login(approverPage,approver); await buyerRFQ(approverPage);
      assert.equal(await approverPage.getByRole("button",{name:"Emetti Purchase Order"}).count(),0);
      await approverPage.getByRole("button",{name:"Approva",exact:true}).click();
      await approverPage.getByText(/Approvazione registrata/)
        .waitFor({state:"visible",timeout:45000});
    });
    let supplierUrl=null;
    await step("same_rfq_immutable_po_issued",async()=>{
      await buyerRFQ(buyerPage);
      buyerPage.once("dialog",d=>d.accept());
      await buyerPage.getByRole("button",{name:"Emetti Purchase Order",exact:true}).click();
      await buyerPage.getByText(/PO emesso/).first().waitFor({state:"visible",timeout:45000});
      await buyerPage.getByText(/Link personale supplier disponibile/)
        .waitFor({state:"visible",timeout:45000});
      await buyerPage.getByRole("button",{name:"Copia link",exact:true}).click();
      supplierUrl=await buyerPage.evaluate(()=>navigator.clipboard.readText());
      assert.equal(new URL(supplierUrl).origin,origin,"Only local PO capability accepted");
      assert.ok(new URL(supplierUrl).pathname.startsWith("/po/respond/"));
    });
    const supplierCtx=await browser.newContext({viewport:{width:430,height:932},
      isMobile:true,deviceScaleFactor:2,locale:"it-IT"});
    const supplierPage=await supplierCtx.newPage();
    await step("same_rfq_supplier_confirms_po",async()=>{
      // Never log or persist the PO capability URL.
      await supplierPage.goto(supplierUrl,{waitUntil:"domcontentloaded",timeout:90000});
      await supplierPage.getByRole("heading",{name:/^PO-/}).first()
        .waitFor({state:"visible",timeout:60000});
      const body=await supplierPage.locator("body").innerText();
      assert.ok(body.includes(buyer.name));
      assert.ok(body.includes("EN 10210")&&body.includes("EN 10219"));
      await supplierPage.getByLabel("Riferimento ordine supplier").fill("NEXT1D-LOCAL-ONLY");
      await supplierPage.getByRole("button",{name:"Registra risposta",exact:true}).click();
      await supplierPage.getByText("Risposta registrata.",{exact:false})
        .waitFor({state:"visible",timeout:45000});
      await supplierPage.getByRole("heading",{name:"Confermato",exact:true})
        .waitFor({state:"visible",timeout:30000});
    });
    await step("same_rfq_buyer_sees_confirmed_po",async()=>{
      await buyerRFQ(buyerPage);
      await buyerPage.getByText("Confermato supplier",{exact:true}).first()
        .waitFor({state:"visible",timeout:45000});
      assert.ok((await buyerPage.locator("body").innerText()).includes("NEXT1D-LOCAL-ONLY"));
    });
    await Promise.all([supplierCtx.close(),approverCtx.close(),buyerCtx.close()]);
    // No RFQ IDs, persons or tokens in this report; SQL checks exact id separately.
    const clean={...previous,po_browser_pass:true,steps:[...previous.steps,...metrics],
      live_customer_metrics_collected:false,external_provider_sends:0};
    writeFileSync(proofFile,JSON.stringify(clean,null,2)+"\n",{mode:0o600});
  }
  console.log("PROD-NEXT1.D Chrome",stage,"PASS",metrics.length,
    "verified milestones on one browser-created local RFQ; no external sends");
} finally { await browser.close(); }
