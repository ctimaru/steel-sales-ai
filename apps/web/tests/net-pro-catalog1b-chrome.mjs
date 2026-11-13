/**
 * NET-PRO-CATALOG1.B: synthetic-only end-to-end per-module, per-country access.
 * Never points to production, never records payment, and never grants live access.
 */
import assert from "node:assert/strict";
import {readFileSync,mkdirSync} from "node:fs";
import path from "node:path";
import {chromium} from "playwright";
import {createClient} from "@supabase/supabase-js";

assert.equal(process.env.DEMOTEST23_WEB_URL,"http://127.0.0.1:3000");
assert.equal(process.env.NEXT_PUBLIC_SUPABASE_URL,"http://127.0.0.1:54321");
assert.equal(process.env.FLOW1_LOCAL_PROVIDER,"true");
assert.ok(process.env.RUNNER_TEMP);
const base=process.env.DEMOTEST23_WEB_URL;
const dbUrl=process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey=process.env.DEMOTEST23_LOCAL_SERVICE_ROLE_KEY;
assert.ok(serviceKey && serviceKey.length>20);
const anonKey=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
assert.ok(anonKey);
const people=JSON.parse(readFileSync(path.join(process.env.RUNNER_TEMP,"demotest23-personas.json"),"utf8"));
const buyer=people.find(p=>p.id==="buyer");
const producer=people.find(p=>p.id==="producer");
const buyerViewer=people.find(p=>p.id==="buyerViewer");
const trader=people.find(p=>p.id==="trader");
assert.ok(buyer&&producer&&buyerViewer&&trader);
const out=path.join(process.env.RUNNER_TEMP,"netro14d-synthetic-visual");
mkdirSync(out,{recursive:true});
const service=createClient(dbUrl,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
const event={
  p_organization_id:producer.org,p_module:"producers",p_territory:"IT",
  p_event_type:"granted",p_source_kind:"pilot",p_source_reference:"netpro1b-ci-only",
  p_idempotency_key:"netpro1b-ci-local-producer-it",
  p_expires_at:null,
};
const granted=await service.rpc("netpro1b_module_event",event);
assert.ifError(granted.error);
assert.equal(granted.data?.product_key,"network_pro_producers_it");
const duplicate=await service.rpc("netpro1b_module_event",event);
assert.ifError(duplicate.error);
assert.equal(duplicate.data?.idempotent,true);

async function authRpc(person,name,args){
  const db=createClient(dbUrl,anonKey,{auth:{persistSession:false,autoRefreshToken:false}});
  const signed=await db.auth.signInWithPassword({email:person.email,password:person.password});
  assert.ifError(signed.error);
  return db.rpc(name,args);
}

// Negative DB assertions: no cross-tenant, country, category, or self-grant.
// Cross-tenant caller must be from ANOTHER organization; the producer is the grant owner.
assert.notEqual(buyer.org,producer.org,"Test fixtures must be separate organizations");
const cross=await authRpc(buyer,"netpro1b_scoped_directory",{
  p_organization_id:producer.org,p_module:"producers",p_country:"IT",
  p_page:1,p_limit:18,
});
assert.equal(cross.error?.code,"42501","Cross-tenant scope must be denied");
const otherCountry=await authRpc(producer,"netpro1b_scoped_directory",{
  p_organization_id:producer.org,p_module:"producers",p_country:"RO",
  p_page:1,p_limit:18,
});
assert.equal(otherCountry.error?.code,"42501","Italy-only must not unlock Romania");
const otherModule=await authRpc(producer,"netpro1b_scoped_directory",{
  p_organization_id:producer.org,p_module:"distributors",p_country:"IT",
  p_page:1,p_limit:18,
});
assert.equal(otherModule.error?.code,"42501","Producer grant must not unlock traders");
const selfGrant=await authRpc(producer,"netpro1b_module_event",{
  ...event,p_module:"distributors",p_idempotency_key:"netpro1b-ci-forbidden-user-grant",
});
assert.equal(selfGrant.error?.code,"42501","Customer cannot grant their own PRO modules");

// A historical, expired grant must never unlock a paid module, even when its
// event is the most recent one. Insert directly only in the disposable CI DB
// to simulate elapsed wall-clock time without sleeping/flaky timers.
const expiredFixture=await service.from("organization_product_entitlement_events").insert({
  organization_id:trader.org,
  product_key:"network_pro_distributors_it",
  event_type:"granted",source_kind:"pilot",source_reference:"netpro1b-ci-expiry",
  idempotency_key:"netpro1b-ci-local-trader-expired-it",
  effective_at:new Date(Date.now()-86_400_000).toISOString(),
  expires_at:new Date(Date.now()-3_600_000).toISOString(),
  actor_authority_type:"system",
  metadata:{fixture:"netpro1b-disposable-expiry-check"},
});
assert.ifError(expiredFixture.error);
const expiredAccess=await authRpc(trader,"netpro1b_scoped_directory",{
  p_organization_id:trader.org,p_module:"distributors",p_country:"IT",
  p_page:1,p_limit:18,
});
assert.equal(expiredAccess.error?.code,"42501","Expired module grant must not unlock access");

const browser=await chromium.launch({channel:"chrome",headless:true});
let checks=0;
async function login(person,width){
  const context=await browser.newContext({viewport:{width,height:width===1440?900:width===390?844:720},
    locale:"it-IT",reducedMotion:"reduce",serviceWorkers:"block"});
  await context.route("**/*",route=>{
    const host=new URL(route.request().url()).hostname;
    return (host==="127.0.0.1"||host==="localhost")?route.continue():route.abort();
  });
  const page=await context.newPage();
  const pageErrors=[];
  page.on("pageerror",e=>pageErrors.push(e.message));
  await page.goto(base+"/login",{waitUntil:"domcontentloaded",timeout:90000});
  await page.locator('input[name="email"]').fill(person.email);
  await page.locator('input[name="password"]').fill(person.password);
  await page.getByRole("button",{name:"Accedi",exact:true}).click();
  await page.waitForURL(u=>u.pathname==="/dashboard",{timeout:90000});
  return {page,context,pageErrors};
}
async function visit(page,url){
  const response=await page.goto(base+url,{waitUntil:"domcontentloaded",timeout:90000});
  assert.equal(response?.status(),200,url+" status");
}
try{
  for(const width of [1440,390,320]){
    const {page,context,pageErrors}=await login(producer,width);
    try{
      await visit(page,"/network/pro");
      await page.getByTestId("netpro1b-coverage").waitFor({state:"visible",timeout:90000});
      await page.getByTestId("netpro1b-license-producers").getByText("Accesso PRO attivo").waitFor({state:"visible",timeout:90000});
      await page.getByTestId("netpro1b-country-IT").waitFor({state:"visible",timeout:90000});
      const liveCount=page.getByTestId("netpro1d-live-count-producers");
      const inItaly=(await liveCount.innerText()).replace(/\s+/g," ").trim();
      assert.match(inItaly,/^\d+ profil[oi] pubblicat[oi] in Italia$/,
        "Module card must show actual Italian published coverage");
      await page.getByRole("button",{name:"Europa",exact:true}).click();
      const inEurope=(await liveCount.innerText()).replace(/\s+/g," ").trim();
      assert.match(inEurope,/^\d+ profil[oi] pubblicat[oi] nei Paesi europei censiti$/,
        "European module card must describe only catalogued countries");
      await page.getByRole("button",{name:"Italia",exact:true}).click();
      assert.equal((await liveCount.innerText()).replace(/\s+/g," ").trim(),inItaly,
        "Italian coverage must return after territory switch");
      const rights=page.getByTestId("netpro1b-browse-IT-producers");
      assert.equal(await rights.count(),1,"Active IT producer link missing");
      assert.equal(await page.getByTestId("netpro1b-browse-IT-distributors").count(),0,
        "Unpaid distributors must not display browse link");
      if(width<1024){
        const priceBox=await page.getByTestId("network-pro-price").boundingBox();
        const moduleBox=await page.getByTestId("network-pro-module-producers").boundingBox();
        assert.ok(priceBox&&moduleBox&&priceBox.y<moduleBox.y,
          "Mobile must show configuration and live price before the module cards");
        checks++;
      }
      const overflow=await page.evaluate(()=>({
        viewport:document.documentElement.clientWidth,
        content:document.documentElement.scrollWidth,
      }));
      assert.ok(overflow.content<=overflow.viewport+2,"Catalog overflow "+width+": "+JSON.stringify(overflow));
      await page.screenshot({path:path.join(out,"net-pro-catalog1b-coverage-"+width+".png"),
        fullPage:true,animations:"disabled"});
      await rights.click();
      await page.getByTestId("netpro1b-scoped-explore").waitFor({state:"visible",timeout:90000});
      await page.getByRole("heading",{name:/Produttori · Italia/}).waitFor({state:"visible"});
      await page.getByText("Aziende pubblicate",{exact:true}).waitFor({state:"visible"});
      await page.screenshot({path:path.join(out,"net-pro-catalog1b-scoped-"+width+".png"),
        fullPage:true,animations:"disabled"});
      await visit(page,"/network/pro/explore?module=producers&country=RO");
      await page.getByText("Modulo non attivo per questa azienda e questo Paese").waitFor({state:"visible"});
      await visit(page,"/network/pro/explore?module=distributors&country=IT");
      await page.getByText("Modulo non attivo per questa azienda e questo Paese").waitFor({state:"visible"});
      assert.deepEqual(pageErrors,[],"Browser errors "+width);
      checks+=8;
    }finally{await context.close();}
  }
  const {page,context,pageErrors}=await login(trader,390);
  try{
    await visit(page,"/network/pro/explore?module=producers&country=IT");
    await page.getByText("Modulo non attivo per questa azienda e questo Paese").waitFor({state:"visible"});
    assert.deepEqual(pageErrors,[]);
    checks+=2;
  }finally{await context.close();}
  // Legacy full-Network PRO buyer and viewer must retain existing full-scope access.
  const shared=await authRpc(buyerViewer,"netpro1b_scoped_directory",{
    p_organization_id:buyer.org,p_module:"producers",p_country:"IT",
    p_page:1,p_limit:18,
  });
  assert.ifError(shared.error);
  assert.equal(shared.data?.contract,"netpro1b-scoped-directory-v1");
  // An explicit revocation must immediately remove access, without modifying legacy PRO.
  const revoked=await service.rpc("netpro1b_module_event",{
    ...event,p_event_type:"revoked",p_idempotency_key:"netpro1b-ci-local-revoke-producer-it",
  });
  assert.ifError(revoked.error);
  const afterRevoke=await authRpc(producer,"netpro1b_scoped_directory",{
    p_organization_id:producer.org,p_module:"producers",p_country:"IT",
    p_page:1,p_limit:18,
  });
  assert.equal(afterRevoke.error?.code,"42501","Revocation must fail closed");
  checks+=8;
  console.log("NET-PRO-CATALOG1.B PASS:",checks,"checks, real local JWT + 1440/390/320");
}finally{await browser.close();}
