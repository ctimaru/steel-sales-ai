/**
 * NET-PRO-CATALOG1.A — real Chrome acceptance against disposable local Auth/DB.
 * Screenshot evidence uses synthetic tenants only. Never runs on hosted data.
 */
import assert from "node:assert/strict";
import {mkdirSync, readFileSync} from "node:fs";
import path from "node:path";
import {chromium} from "playwright";

const base = process.env.DEMOTEST23_WEB_URL;
assert.equal(base, "http://127.0.0.1:3000");
assert.equal(process.env.NEXT_PUBLIC_SUPABASE_URL, "http://127.0.0.1:54321");
assert.equal(process.env.FLOW1_LOCAL_PROVIDER, "true");
assert.ok(process.env.RUNNER_TEMP, "Ephemeral runner directory required");
const people = JSON.parse(readFileSync(path.join(process.env.RUNNER_TEMP,"demotest23-personas.json"),"utf8"));
const admin = people.find((person)=>person.id==="buyer");
const viewer = people.find((person)=>person.id==="buyerViewer");
assert.ok(admin&&viewer);
const output = path.join(process.env.RUNNER_TEMP,"netro14d-synthetic-visual");
mkdirSync(output,{recursive:true});

const browser = await chromium.launch({channel:"chrome",headless:true});
let checks=0;
const euro=(value)=>new RegExp(String(value).replace(/[.*+?^${\}()|[\]\\]/g,"\\$&")+"\\s*€");
async function signIn(person,width) {
  const height=width===1440?900:width===390?844:720;
  const context=await browser.newContext({viewport:{width,height},locale:"it-IT",reducedMotion:"reduce",
    deviceScaleFactor:width===1440?1:2,serviceWorkers:"block"});
  await context.route("**/*",route=>{
    const hostname=new URL(route.request().url()).hostname;
    return hostname==="127.0.0.1"||hostname==="localhost"?route.continue():route.abort();
  });
  const page=await context.newPage();
  const errors=[];
  page.on("pageerror",error=>errors.push(error.message));
  await page.goto(base+"/login",{waitUntil:"domcontentloaded",timeout:90000});
  await page.locator('input[name="email"]').fill(person.email);
  await page.locator('input[name="password"]').fill(person.password);
  await page.getByRole("button",{name:"Accedi",exact:true}).click();
  await page.waitForURL(url=>url.pathname==="/dashboard",{timeout:90000});
  const response=await page.goto(base+"/network/pro",{waitUntil:"domcontentloaded",timeout:90000});
  assert.equal(response?.status(),200,"Catalog must respond HTTP 200");
  await page.getByTestId("network-pro-catalog").waitFor({state:"visible",timeout:90000});
  return {context,page,errors};
}
async function noHorizontalOverflow(page,width,at) {
  const metrics=await page.evaluate(()=>({
    viewport:document.documentElement.clientWidth,
    page:document.documentElement.scrollWidth,
  }));
  assert.ok(metrics.page<=metrics.viewport+2,
    "Horizontal overflow "+width+" at "+at+": "+JSON.stringify(metrics));
  checks++;
}
async function price(page,amount) {
  const text=(await page.getByTestId("network-pro-price").innerText()).replace(/\s+/g," ");
  assert.match(text,new RegExp("\\b"+amount+"\\b"),"Incorrect price: "+text);
  checks++;
}
async function screenshot(page,width,suffix) {
  await page.screenshot({path:path.join(output,"net-pro-catalog-"+suffix+"-"+width+".png"),
    fullPage:true,animations:"disabled"});
}
try {
  for(const width of [1440,390,320]){
    const {context,page,errors}=await signIn(admin,width);
    try {
      assert.equal(await page.getByRole("heading",{name:"Le aziende che cerchi, in un unico Network."}).count(),1);
      assert.equal(await page.locator('[data-testid^="network-pro-module-"]').count(),4);
      await price(page,66);
      const producer=page.getByTestId("network-pro-module-producers");
      const distributor=page.getByTestId("network-pro-module-distributors");
      assert.equal(await producer.getAttribute("aria-pressed"),"true");
      assert.equal(await distributor.getAttribute("aria-pressed"),"true");
      for(const item of await page.locator('[data-testid^="network-pro-module-"]').all()){
        const rect=await item.boundingBox();
        assert.ok(rect && rect.height>=160 && rect.width>=125,
          "Module card too small at "+width+": "+JSON.stringify(rect));
      }
      await noHorizontalOverflow(page,width,"initial");
      await screenshot(page,width,"italia-2-moduli");
      await page.getByRole("button",{name:"Europa",exact:true}).click();
      await price(page,117);
      for(const key of ["end_users","processors"])await page.getByTestId("network-pro-module-"+key).click();
      await price(page,199);
      await screenshot(page,width,"europa-full-network");
      await page.getByRole("button",{name:"Annuale",exact:true}).click();
      await price(page,2030);
      assert.match(await page.locator("body").innerText(),/prezzi proposti|Prezzi proposti/);
      assert.equal(await page.getByRole("button",{name:/Acquista|Paga|Checkout/i}).count(),0,
        "Prohibited fake purchase action");
      await noHorizontalOverflow(page,width,"full network annual");
      for(const key of ["producers","distributors","end_users","processors"]) {
        await page.getByTestId("network-pro-module-"+key).click();
      }
      await price(page,0);
      assert.match(await page.locator("body").innerText(),/Seleziona almeno un modulo/);
      await screenshot(page,width,"nessun-modulo");
      assert.deepEqual(errors,[],"React page errors: "+errors.join(" | "));
      checks+=10;
    }finally{await context.close();}
  }
  // Read-only company staff must be allowed to inspect prices too (not granted Network PRO).
  const {context,page,errors}=await signIn(viewer,390);
  try {
    await price(page,66);
    assert.equal(await page.getByRole("heading",{name:"Le aziende che cerchi, in un unico Network."}).count(),1);
    assert.deepEqual(errors,[]);
    checks+=2;
  }finally{await context.close();}
  console.log("NET-PRO-CATALOG1.A CHROME PASS "+checks+" checks | 1440,390,320 + viewer | synthetic-only screenshots");
}finally{await browser.close();}
