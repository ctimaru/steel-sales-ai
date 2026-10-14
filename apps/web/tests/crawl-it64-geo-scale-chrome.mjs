/** CRAWL-IT6.4: Chrome multi-role KPI/readiness acceptance, disposable localhost only. */
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import path from "node:path";
import {chromium} from "playwright";
const WEB="http://127.0.0.1:3000";
assert.equal(process.env.CI,"true","Ephemeral CI only");
assert.equal(process.env.PERF1_WEB_URL,WEB);
assert.match(process.env.NEXT_PUBLIC_SUPABASE_URL??"",/^http:\/\/(?:localhost|127\.0\.0\.1):54321\/?$/);
assert.ok(process.env.RUNNER_TEMP,"Local-only GoTrue identities needed");
const people=JSON.parse(readFileSync(path.join(process.env.RUNNER_TEMP,"perf1-personas.json"),"utf8"));
function persona(id){
  const p=people.find(x=>x.id===id);
  assert.ok(p?.userId && p.email?.endsWith("@example.test") && p.password,"Synthetic identity required");
  return p;
}
async function visit(page,route){
  const response=await page.goto(WEB+route,{waitUntil:"domcontentloaded",timeout:90000});
  assert.ok(!response || response.status()<500,"Local Next route failed");
}
async function login(page,id){
  const p=persona(id);
  await visit(page,"/login");
  await page.locator('input[name="email"]').fill(p.email);
  await page.locator('input[name="password"]').fill(p.password);
  await page.getByRole("button",{name:"Accedi",exact:true}).click();
  await page.waitForURL(u=>u.origin===WEB && u.pathname!=="/login",{timeout:90000});
}
const browser=await chromium.launch({headless:true,channel:"chrome"});
const route="/platform/company-discovery/coverage";
let passed=0;
async function check(name,fn){await fn();passed++;console.log("CRAWL-IT64 LOCAL PASS",name);}
try{
  const owner=await browser.newContext({locale:"it-IT",viewport:{width:390,height:860},serviceWorkers:"block"});
  try{
    const page=await owner.newPage();
    await login(page,"owner");
    await check("Platform Owner sees real authorization-gated geographic KPIs",async()=>{
      await visit(page,route);
      await page.getByRole("heading",{name:"Copertura geografica e readiness",level:1})
        .waitFor({state:"visible",timeout:60000});
      assert.equal(new URL(page.url()).pathname,route);
      const body=await page.locator("body").innerText();
      assert.ok(body.includes("Aziende pubblicate"));
      assert.ok(body.includes("Con città pubblicata"));
      assert.ok(body.includes("Località mancanti"));
      assert.ok(body.includes("Fonti abilitate idonee"));
      assert.ok(!body.includes("KPI non disponibili:"),"DB migration/read failed");
      assert.ok(!body.includes("RQG31 PRIVATE"),"Company private evidence leaked");
    });
    await check("No source approvals: activation stays blocked without pretending worker state",async()=>{
      const body=await page.locator("body").innerText();
      assert.ok(body.includes("Espansione autonoma non pronta"),"Default-off sources misreported");
      assert.ok(body.includes("nessuna fonte italiana risulta idonea"));
      assert.ok(!body.includes("scansione attiva"),"No actual Railway activation evidence");
      const links=page.getByRole("main").getByRole("link");
      assert.equal(await links.filter({hasText:"Esamina le fonti"}).first().getAttribute("href"),
        "/platform/company-discovery/sources");
      assert.equal(await links.filter({hasText:"Revisiona evidenze geografiche"}).first().getAttribute("href"),
        "/platform/company-discovery/geo-review");
      assert.equal(await links.filter({hasText:"Governance Discovery"}).first().getAttribute("href"),
        "/platform/company-discovery/governance");
      assert.equal(await page.getByRole("button",{name:/avvia|attiva|pubblica/i}).count(),0,
        "Staged readiness UI must not expose ungated activation controls");
    });
    await check("Owner mobile/desktop KPI page stays readable and does not scroll horizontally",async()=>{
      for(const width of [320,390,768,1440]){
        await page.setViewportSize({width,height:860});
        const dims=await page.evaluate(()=>({
          client:document.documentElement.clientWidth,
          scroll:document.documentElement.scrollWidth
        }));
        assert.ok(dims.scroll<=dims.client+8,
          "Horizontal overflow at "+width+"px: "+JSON.stringify(dims));
        await page.getByRole("heading",{name:"Copertura geografica e readiness"}).waitFor();
      }
    });
  }finally{await owner.close();}
  for(const id of ["buyer","buyerViewer","trader","platformStaff"]){
    const ctx=await browser.newContext({locale:"it-IT",viewport:{width:390,height:860},serviceWorkers:"block"});
    try{
      const page=await ctx.newPage();
      await login(page,id);
      await check(id+" denied Platform geographic coverage direct URL",async()=>{
        try{await visit(page,route);}
        catch(e){if(!String(e).includes("net::ERR_ABORTED"))throw e;}
        const allowed=new Set(["/dashboard","/login","/register","/onboarding","/platform","/staff/access","/legal/accept"]);
        await page.waitForURL(u=>u.origin===WEB&&allowed.has(u.pathname),{timeout:60000});
        const body=await page.locator("body").innerText();
        assert.ok(!body.includes("Copertura geografica e readiness"));
        assert.ok(!body.includes("Fonti abilitate idonee"));
        assert.ok(!body.includes("RQG31 PRIVATE"));
      });
    }finally{await ctx.close();}
  }
  console.log("CRAWL-IT64 LOCAL GEO SCALE READINESS PASS",passed,
    "checks; real local GoTrue and DB/RPC, no worker activation, no production reads");
}finally{await browser.close();}
