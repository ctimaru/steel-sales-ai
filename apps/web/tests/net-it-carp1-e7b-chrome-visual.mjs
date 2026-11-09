/**
 * NET-IT-CARP1.E.7.B: REAL Chrome viewport QA using ONLY ephemeral local
 * Supabase/GoTrue and 100 fictitious .invalid company records.
 * Authenticates a synthetic Platform superadmin; never contacts hosted data.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const base=process.env.DEMOTEST23_WEB_URL;
assert.equal(base,"http://127.0.0.1:3000");
assert.equal(process.env.NEXT_PUBLIC_SUPABASE_URL,"http://127.0.0.1:54321");
assert.equal(process.env.FLOW1_LOCAL_PROVIDER,"true");
assert.ok(process.env.RUNNER_TEMP);
const admin=JSON.parse(fs.readFileSync(path.join(process.env.RUNNER_TEMP,"netgrowth2c1-auditor.json"),"utf8"));
const out=path.join(process.env.RUNNER_TEMP,"net-it-carp1-e7b-visual");
fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({channel:"chrome",headless:true});
let checks=0;
const route="/platform/company-discovery/carpenterie";
async function createPage(width){
  const context=await browser.newContext({
    viewport:{width,height:width===1440?900:width===390?844:720},
    locale:"it-IT",reducedMotion:"reduce",serviceWorkers:"block",
    deviceScaleFactor:width<1000?2:1,
  });
  await context.route("**/*",r=>{
    const host=new URL(r.request().url()).hostname;
    return host==="127.0.0.1"||host==="localhost" ? r.continue() : r.abort();
  });
  const page=await context.newPage();
  const errors=[];
  page.on("pageerror",e=>errors.push(e.message));
  return {context,page,errors};
}
async function login(page){
  await page.goto(base+"/login",{waitUntil:"domcontentloaded",timeout:90000});
  await page.locator('input[name="email"]').fill(admin.email);
  await page.locator('input[name="password"]').fill(admin.password);
  await page.getByRole("button",{name:"Accedi",exact:true}).click();
  await page.waitForURL(u=>["/dashboard","/platform"].includes(u.pathname),{timeout:90000});
  const cookie=page.getByTestId("mobile-cookie-consent");
  if(await cookie.isVisible().catch(()=>false)){
    const accept=cookie.getByRole("button",{name:/Accetta necessari|Cookie necessari/i});
    if(await accept.count()) await accept.first().click();
  }
}
async function assertNoOverflow(page,width,label){
  const m=await page.evaluate(()=>({
    viewport:document.documentElement.clientWidth,
    document:document.documentElement.scrollWidth,
    body:document.body.scrollWidth,
  }));
  assert.ok(m.document<=m.viewport+12,
    "Horizontal overflow "+label+"/"+width+": "+JSON.stringify(m));
  checks++;
}
try{
  for(const width of [1440,390,320]){
    const {context,page,errors}=await createPage(width);
    try{
      await login(page);
      const response=await page.goto(base+route,{waitUntil:"domcontentloaded",timeout:90000});
      assert.equal(response.status(),200,"Platform route must be 200 at "+width);
      await page.getByTestId("net-it-carp1-e5-cockpit").waitFor({timeout:60000});
      await page.getByRole("heading",{name:"Carpenterie · dati e riconciliazione"}).waitFor();
      assert.equal(await page.getByTestId("net-it-carp1-e5-company").count(),40,
        "First page must show forty fictional companies");
      assert.match(await page.locator("main").innerText(),/100 risultati|100 risultati/i);
      await assertNoOverflow(page,width,"all");
      await page.screenshot({
        path:path.join(out,"carpenterie-overview-"+width+".png"),
        fullPage:false,animations:"disabled"
      });
      checks+=4;

      await page.getByRole("link",{name:"Alias collegati",exact:true}).click();
      await page.waitForURL(u=>u.searchParams.get("state")==="domain_alias_linked",{timeout:30000});
      assert.equal(await page.getByTestId("net-it-carp1-e5-company").count(),16,
        "Sixteen existing brand aliases must be visible");
      await assertNoOverflow(page,width,"linked aliases");
      await page.screenshot({
        path:path.join(out,"carpenterie-alias-"+width+".png"),
        fullPage:false,animations:"disabled"
      });
      checks++;

      await page.getByRole("link",{name:"Solo candidature",exact:true}).click();
      await page.waitForURL(u=>u.searchParams.get("state")==="research_seed_missing",{timeout:30000});
      assert.equal(await page.getByTestId("net-it-carp1-e5-company").count(),40);
      assert.match(await page.locator("main").innerText(),/66 candidature principali|66 risultati/i);
      await page.getByRole("link",{name:/Successiva/}).click();
      await page.waitForURL(u=>u.searchParams.get("page")==="2",{timeout:30000});
      assert.equal(await page.getByTestId("net-it-carp1-e5-company").count(),26,
        "Candidate-first page 2 should render 26 fictitious companies");
      checks+=3;

      await page.goto(base+route+"?q=035",{waitUntil:"domcontentloaded",timeout:90000});
      assert.equal(await page.getByTestId("net-it-carp1-e5-company").count(),1);
      assert.match(await page.getByTestId("net-it-carp1-e5-company").innerText(),
        /P\.IVA storica distinta/);
      assert.deepEqual(errors,[], "No browser errors at "+width+": "+errors.join("; "));
      await assertNoOverflow(page,width,"VAT note");
      checks+=3;
      console.log("NET-IT-CARP1.E.7.B CHROME PASS",width,"pixels");
    }finally{await context.close();}
  }
  const {context,page}=await createPage(390);
  try{
    await page.goto(base+route,{waitUntil:"domcontentloaded",timeout:90000});
    assert.equal(await page.getByTestId("net-it-carp1-e5-company").count(),0,
      "Anonymous visitors must not see private candidate or contact cards");
    const body=await page.locator("body").innerText();
    assert.ok(!body.includes("ufficio-001@"),"Private fictional company email leaked to anon");
    checks+=2;
  }finally{await context.close();}
  console.log("NET-IT-CARP1.E.7.B FINAL CHROME VISUAL PASS",checks,
    "checks, 1440/390/320, all data synthetic and local.");
}finally{await browser.close();}
