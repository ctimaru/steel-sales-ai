/**
 * RFQH14.2b — Chrome real GoTrue second-person PO approval & supplier confirmation.
 *
 * LOCAL ONLY (GitHub Actions ephemeral Supabase/Next). No screenshots, traces,
 * token logs, browser storage exports, external email/production calls.
 * Runs after DEMOTEST2.3 (41 checks), RFQH14.2 (30 checks), and local PO seed.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const origin = process.env.DEMOTEST23_WEB_URL;
assert.equal(origin, "http://127.0.0.1:3000", "RFQH14.2b external frontend prohibited");
assert.equal(process.env.NEXT_PUBLIC_SUPABASE_URL, "http://127.0.0.1:54321",
  "RFQH14.2b external database prohibited");
assert.equal(process.env.RESEND_API_KEY, "", "RFQH14.2b must disable external email");
assert.ok(process.env.RUNNER_TEMP, "Ephemeral runner is required");
const personas = JSON.parse(
  readFileSync(path.join(process.env.RUNNER_TEMP,"demotest23-personas.json"),"utf8")
);
const buyer = personas.find(p=>p.id==="buyer");
const approver = personas.find(p=>p.id==="buyerViewer");
assert.ok(buyer && approver && buyer.org === approver.org && buyer.userId !== approver.userId,
  "Independent authorized buyer members required");
const rfqRoute = "/rfq-hub/" + buyer.rfq;

const browser = await chromium.launch({headless:true,channel:"chrome"});
const checks = [];
async function step(name,run){
  try {
    await run();
    checks.push(name);
    console.log("RFQH14.2b Chrome PASS",name);
  }catch(err){
    // Do not print raw URLs or trace: PO capability links are confidential.
    console.error("RFQH14.2b Chrome FAIL",name);
    throw new Error("RFQH14.2b failed: "+name);
  }
}
async function open(page,href){
  const response=await page.goto(origin+href,{waitUntil:"domcontentloaded",timeout:90000});
  assert.ok(response && response.status()<500,"Local frontend failed");
}
async function login(page,person){
  await open(page,"/login");
  await page.locator('input[name="email"]').fill(person.email);
  await page.locator('input[name="password"]').fill(person.password);
  await page.getByRole("button",{name:"Accedi",exact:true}).click();
  await page.waitForURL(url=>url.pathname==="/dashboard",{timeout:90000});
  await page.getByRole("heading",{name:"Oggi in "+person.name,exact:true})
    .waitFor({state:"visible",timeout:60000});
}
async function onCampaign(page){
  await open(page,rfqRoute);
  await page.getByRole("heading",{name:buyer.rfqTitle,exact:true})
    .waitFor({state:"visible",timeout:60000});
  await page.getByRole("heading",{name:"Governance, recovery e readiness della RFQ"})
    .waitFor({state:"visible",timeout:60000});
}

let buyerContext,approverContext,supplierContext;
try {
  buyerContext=await browser.newContext({
    viewport:{width:1440,height:900},locale:"it-IT",
    permissions:["clipboard-read","clipboard-write"]
  });
  const buyerPage=await buyerContext.newPage();
  await step("buyer logs in with real local GoTrue",()=>login(buyerPage,buyer));
  await step("buyer sees pending PO approval but cannot approve own request",async()=>{
    await onCampaign(buyerPage);
    await buyerPage.getByText("Emissione PO",{exact:true}).waitFor({state:"visible"});
    assert.equal(await buyerPage.getByRole("button",{name:"Approva",exact:true}).count(),0,
      "Self-approval must not be offered");
  });
  await step("buyer cannot issue PO while second-person approval is pending",async()=>{
    buyerPage.once("dialog",dialog=>dialog.accept());
    await buyerPage.getByRole("button",{name:"Emetti Purchase Order",exact:true}).click();
    await buyerPage.getByText(/Emissione PO inviata in approvazione/).waitFor({
      state:"visible",timeout:45000
    });
    assert.equal(await buyerPage.getByText("Emesso · attesa conferma").count(),0,
      "PO issued despite pending independent approval");
  });

  approverContext=await browser.newContext({viewport:{width:1440,height:900},locale:"it-IT"});
  const approverPage=await approverContext.newPage();
  await step("independent approver signs in with second real GoTrue account",()=>{
    return login(approverPage,approver);
  });
  await step("approver sees buyer RFQ but cannot issue a PO",async()=>{
    await onCampaign(approverPage);
    await approverPage.getByText("Emissione PO",{exact:true})
      .waitFor({state:"visible",timeout:45000});
    assert.equal(await approverPage.getByRole("button",{name:"Emetti Purchase Order"}).count(),0,
      "Approver must not become RFQ owner");
    assert.equal(await approverPage.getByRole("button",{name:"Approva",exact:true}).count(),1,
      "Independent approval action unavailable");
  });
  await step("approver performs real UI approval, not seeded SQL decision",async()=>{
    await approverPage.getByRole("button",{name:"Approva",exact:true}).click();
    await approverPage.getByText(/Approvazione registrata/)
      .waitFor({state:"visible",timeout:45000});
  });
  await step("owner issues immutable PO version using approved exact payload",async()=>{
    await onCampaign(buyerPage);
    buyerPage.once("dialog",dialog=>dialog.accept());
    await buyerPage.getByRole("button",{name:"Emetti Purchase Order",exact:true}).click();
    await buyerPage.getByText(/PO emesso/).first().waitFor({state:"visible",timeout:45000});
    await buyerPage.getByText(/Link personale supplier disponibile/)
      .waitFor({state:"visible",timeout:45000});
  });

  // Read the capability exclusively inside isolated browser memory; never log it
  // or save it to GitHub artifacts / attachments.
  let supplierUrl=null;
  await step("browser supplies a valid local PO capability without logging token",async()=>{
    await buyerPage.getByRole("button",{name:"Copia link",exact:true}).click();
    supplierUrl=await buyerPage.evaluate(()=>navigator.clipboard.readText());
    assert.ok(supplierUrl?.startsWith(origin+"/po/respond/") && supplierUrl.length>origin.length+25,
      "Expected a local capability-scoped PO link");
    assert.equal(new URL(supplierUrl).origin,origin);
  });

  supplierContext=await browser.newContext({viewport:{width:430,height:932},isMobile:true,
    deviceScaleFactor:2,locale:"it-IT"});
  const supplierPage=await supplierContext.newPage();
  await step("supplier opens valid versioned PO without buyer credentials",async()=>{
    // URL comes only from the local clipboard and MUST remain on localhost.
    await supplierPage.goto(supplierUrl,{waitUntil:"domcontentloaded",timeout:90000});
    await supplierPage.getByRole("heading",{name:/^PO-/}).first()
      .waitFor({state:"visible",timeout:60000});
    const body=await supplierPage.locator("body").innerText();
    assert.ok(body.includes(buyer.name),"PO buyer organization missing");
    assert.ok(body.includes("DEMO Steel Manufacturing"),"Wrong supplier on PO");
    assert.ok(body.includes("EN 10210")&&body.includes("EN 10219"));
    const widths=await supplierPage.evaluate(()=>({
      viewport:document.documentElement.clientWidth,
      body:document.documentElement.scrollWidth,
    }));
    assert.ok(widths.body<=widths.viewport+12,"PO mobile horizontal overflow");
  });
  await step("supplier confirms the exact PO version through real UI",async()=>{
    await supplierPage.getByLabel("Riferimento ordine supplier")
      .fill("RFQH14-LOCAL-ONLY");
    await supplierPage.getByRole("button",{name:"Registra risposta",exact:true}).click();
    await supplierPage.getByText("Risposta registrata.",{exact:true})
      .waitFor({state:"visible",timeout:45000});
    await supplierPage.getByRole("heading",{name:"Confermato",exact:true})
      .waitFor({state:"visible",timeout:45000});
    assert.equal(await supplierPage.getByRole("button",{name:"Registra risposta"}).count(),0,
      "Confirmation action must not be available after decision");
  });
  await step("buyer sees supplier-confirmed immutable PO after refresh",async()=>{
    await onCampaign(buyerPage);
    await buyerPage.getByText("Confermato supplier",{exact:true}).first()
      .waitFor({state:"visible",timeout:45000});
    const body=await buyerPage.locator("body").innerText();
    assert.ok(body.includes("RFQH14-LOCAL-ONLY"),"Supplier confirmation missing");
  });

  // No supplier token, RFQ customer data, secrets, screenshots or traces leave this runner.
  console.log("RFQH14.2b CHROME PASS",checks.length,
    "browser checks; independent UI approval, exact PO, supplier confirmation; LOCAL ONLY");
} finally {
  await Promise.all([supplierContext?.close(),approverContext?.close(),buyerContext?.close()]
    .filter(Boolean));
  await browser.close();
}
