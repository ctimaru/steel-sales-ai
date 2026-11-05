/**
 * NET-UX-MAP1: visual and functional sign-off with ephemeral local GoTrue.
 * Does not use production accounts, domains, data or secrets.
 */
import assert from "node:assert/strict";
import {readFileSync,mkdirSync} from "node:fs";
import path from "node:path";
import {chromium} from "playwright";

assert.equal(process.env.DEMOTEST23_WEB_URL,"http://127.0.0.1:3000");
assert.equal(process.env.NEXT_PUBLIC_SUPABASE_URL,"http://127.0.0.1:54321");
assert.equal(process.env.FLOW1_LOCAL_PROVIDER,"true");
assert.ok(process.env.RUNNER_TEMP);
const personas=JSON.parse(readFileSync(path.join(process.env.RUNNER_TEMP,"demotest23-personas.json"),"utf8"));
const buyer=personas.find(p=>p.id==="buyer");
assert.ok(buyer?.email&&buyer?.password);
const out=path.join(process.env.RUNNER_TEMP,"net-ux-map1-visual");
mkdirSync(out,{recursive:true});
const browser=await chromium.launch({channel:"chrome",headless:true});
let assertions=0;

async function loggedInPage(width){
 const context=await browser.newContext({
  viewport:{width,height:width===1440?900:880},
  locale:"it-IT",reducedMotion:"reduce",serviceWorkers:"block",
 });
 await context.route("**/*",route=>{
  const hostname=new URL(route.request().url()).hostname;
  return ["127.0.0.1","localhost","[::1]"].includes(hostname)?route.continue():route.abort();
 });
 const page=await context.newPage();
 const runtimeErrors=[];
 page.on("pageerror",error=>runtimeErrors.push(error.message));
 await page.goto(process.env.DEMOTEST23_WEB_URL+"/login",{waitUntil:"domcontentloaded",timeout:90000});
 await page.locator('input[name="email"]').fill(buyer.email);
 await page.locator('input[name="password"]').fill(buyer.password);
 await page.getByRole("button",{name:"Accedi",exact:true}).click();
 await page.waitForURL(url=>["/dashboard","/platform"].includes(url.pathname),{timeout:90000});
 const cookie=page.getByTestId("mobile-cookie-consent");
 if(await cookie.isVisible().catch(()=>false)){
  const choice=cookie.getByRole("button",{name:/Accetta necessari|Cookie necessari/i});
  if(await choice.count())await choice.first().click();
 }
 return {context,page,runtimeErrors};
}

try {
 for(const width of [1440,390,320]){
  const {context,page,runtimeErrors}=await loggedInPage(width);
  try{
   await page.goto(process.env.DEMOTEST23_WEB_URL+"/network",{waitUntil:"domcontentloaded",timeout:90000});
   await page.getByTestId("network-compact-experience").waitFor({timeout:60000});
   const sidebar=page.getByTestId("network-side-column");
   const persistent=page.getByTestId("network-europe-persistent-map");
   const mini=persistent.getByTestId("network-europe-mini-map");
   const ticker=page.getByTestId("network-country-ticker");
   const drawer=page.getByTestId("network-filter-drawer");
   for(const element of [sidebar,persistent,mini,ticker]){
    assert.equal(await element.isVisible(),true,"Must be visible at "+width);
    assertions++;
   }
   const [mapBox,drawerBox,tickerBox]=await Promise.all([
    persistent.boundingBox(),drawer.boundingBox(),ticker.boundingBox(),
   ]);
   assert.ok(mapBox&&drawerBox&&tickerBox,"UI bounding boxes at "+width);
   assert.ok(mapBox.y+mapBox.height<=drawerBox.y+8,"Map must precede filters at "+width);
   assert.ok(tickerBox.height>=32&&tickerBox.height<=70,"Compact banner height "+width+": "+tickerBox.height);
   assertions+=2;
   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
   assert.ok(overflow<=12,"No horizontal overflow at "+width+" delta "+overflow);
   assertions++;
   const track=ticker.locator('[class*="track"]').first();
   if(await track.count()){
    const animation=await track.evaluate(node=>getComputedStyle(node).animationName);
    assert.equal(animation,"none","Reduced-motion ticker must not animate");
    assertions++;
   }
   assert.deepEqual(runtimeErrors,[],"No page runtime errors at "+width);
   assertions++;
   await page.screenshot({
    path:path.join(out,"network-map-ticker-"+width+".png"),
    fullPage:false,animations:"disabled",
   });
   if(width<1024){
    const filterButton=page.getByRole("button",{name:/^Filtri/}).first();
    assert.equal(await filterButton.isVisible(),true);
    assert.equal(await filterButton.getAttribute("aria-expanded"),"false");
    assert.equal(await mini.isVisible(),true,"Map must remain visible while filters collapsed");
    await filterButton.click();
    assert.equal(await filterButton.getAttribute("aria-expanded"),"true");
    assert.equal(await page.getByText("Ruolo nella filiera",{exact:true}).first().isVisible(),true);
    assertions+=5;
   }
   if(width===1440){
    const romania=persistent.locator('a[data-country="RO"]').first();
    assert.equal(await romania.count(),1,"Clickable Romania map shape");
    await romania.click();
    await page.waitForURL(url=>url.searchParams.get("country")==="RO",{timeout:60000});
    assert.ok(page.url().includes("country=RO"),"Country click should update URL");
    assertions+=2;
   }
  }finally{await context.close();}
 }
 console.log("NET-UX-MAP1 CHROME PASS",assertions,"local GoTrue checks; 1440/390/320; screenshot artifacts");
}finally{await browser.close();}
