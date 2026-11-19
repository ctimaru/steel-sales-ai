/** UX4.A — actual Chrome screenshot acceptance against disposable local tenants.
 * No production reads, no real billing and no artificial production grants.
 */
import assert from "node:assert/strict";
import {readFileSync,mkdirSync} from "node:fs";
import path from "node:path";
import {chromium} from "playwright";

const base=process.env.DEMOTEST23_WEB_URL;
assert.equal(base,"http://127.0.0.1:3000");
assert.equal(process.env.NEXT_PUBLIC_SUPABASE_URL,"http://127.0.0.1:54321");
assert.equal(process.env.FLOW1_LOCAL_PROVIDER,"true");
assert.ok(process.env.RUNNER_TEMP);
const people=JSON.parse(readFileSync(path.join(process.env.RUNNER_TEMP,
  "demotest23-personas.json"),"utf8"));
const full=people.find(x=>x.id==="buyer");
const locked=people.find(x=>x.id==="trader");
assert.ok(full&&locked);
const out=path.join(process.env.RUNNER_TEMP,"netro14d-synthetic-visual");
mkdirSync(out,{recursive:true});
const browser=await chromium.launch({channel:"chrome",headless:true});
let checks=0;

async function login(person,width){
  const context=await browser.newContext({
    viewport:{width,height:width===1440?900:width===390?844:720},
    locale:"it-IT",reducedMotion:"reduce",serviceWorkers:"block",
    deviceScaleFactor:width===1440?1:2,
  });
  await context.route("**/*",route=>{
    const url=new URL(route.request().url());
    return url.hostname==="127.0.0.1"||url.hostname==="localhost"
      ?route.continue():route.abort();
  });
  const page=await context.newPage();
  const errors=[];
  page.on("pageerror",error=>errors.push(error.message));
  await page.goto(base+"/login",{waitUntil:"domcontentloaded",timeout:90000});
  await page.locator('input[name="email"]').fill(person.email);
  await page.locator('input[name="password"]').fill(person.password);
  await page.getByRole("button",{name:"Accedi",exact:true}).click();
  await page.waitForURL(url=>url.pathname==="/dashboard",{timeout:90000});
  return {page,context,errors};
}
async function checkOverflow(page,label){
  const widths=await page.evaluate(()=>({
    document:document.documentElement.scrollWidth,
    viewport:document.documentElement.clientWidth,
  }));
  assert.ok(widths.document<=widths.viewport+2,
    "Horizontal overflow "+label+": "+JSON.stringify(widths));
  checks++;
}
async function screenshot(page,width,stage){
  await page.screenshot({
    path:path.join(out,"net-producers-ux4a-"+stage+"-"+width+".png"),
    fullPage:stage==="full"||stage==="locked",
    animations:"disabled",
  });
}
try{
  for(const width of [1440,390,320]){
    const {page,context,errors}=await login(full,width);
    try{
      const response=await page.goto(base+"/network/pro/producers?country=IT",{
        waitUntil:"domcontentloaded",timeout:90000,
      });
      assert.equal(response?.status(),200);
      await page.getByTestId("network-producers-workspace").waitFor({
        state:"visible",timeout:90000,
      });
      await page.getByRole("heading",{name:"Quale tubo cerchi?"}).waitFor({
        state:"visible",timeout:90000,
      });
      assert.equal(await page.getByTestId("eu-producer-intelligence-chat").count(),1);
      const disclosure=page.getByTestId("network-producers-browse-toggle");
      assert.equal(await disclosure.count(),1);
      assert.equal(await page.locator("#manufacturer-query").isVisible(),false,
        "Secondary search should start collapsed");
      const chat=page.getByTestId("eu-producer-intelligence-chat");
      const heading=await chat.boundingBox();
      assert.ok(heading&&heading.y<750,"AI search must remain above fold");
      checks+=4;
      await checkOverflow(page,"initial-"+width);
      await screenshot(page,width,"first-screen");
      await screenshot(page,width,"full");

      await disclosure.click();
      await page.locator("#manufacturer-query").waitFor({state:"visible"});
      await page.locator("#manufacturer-country").waitFor({state:"visible"});
      checks+=2;
      await checkOverflow(page,"expanded-"+width);
      await screenshot(page,width,"browse-expanded");

      const list=page.getByTestId("network-producers-list");
      if(await list.count()){
        const select=list.getByRole("button",{name:"Confronta"}).first();
        if(await select.count()){
          await select.click();
          await page.getByTestId("producer-compare-bar").waitFor({state:"visible"});
          await checkOverflow(page,"compare-"+width);
          await screenshot(page,width,"compare");
          checks+=2;
        }
      }
      assert.deepEqual(errors,[],"Chrome page errors at "+width);
      checks++;
    }finally{await context.close();}
  }
  const {page,context,errors}=await login(locked,390);
  try{
    const response=await page.goto(base+"/network/pro/producers?country=IT",{
      waitUntil:"domcontentloaded",timeout:90000,
    });
    assert.equal(response?.status(),200);
    await page.getByRole("heading",{name:"Sblocca Intelligence Produttori"}).waitFor({
      state:"visible",timeout:90000,
    });
    assert.equal(await page.getByTestId("network-producers-list").count(),0,
      "Unentitled organization must not see producer list");
    await screenshot(page,390,"locked");
    assert.deepEqual(errors,[]);
    checks+=3;
  }finally{await context.close();}
}finally{await browser.close();}
console.log("NET-PRODUCERS-UX4.A Chrome visual PASS:",checks,
  "checks / synthetic auth / 1440-390-320");
