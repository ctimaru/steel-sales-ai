/**
 * NET-PERF1.A — actual headless Google Chrome, disposable LOCAL GoTrue + Next
 * production build. Synthetic seed only; NOT production Real User Monitoring.
 * Artifacts contain numeric summaries only. No URL, user, session, query value.
 */
import assert from "node:assert/strict";
import {readFileSync,writeFileSync,mkdirSync} from "node:fs";
import path from "node:path";
import {chromium} from "playwright";

const base=process.env.NETPERF_WEB_URL;
assert.equal(base,"http://127.0.0.1:3010","No external URLs or real user accounts allowed");
const temp=process.env.RUNNER_TEMP;
assert.ok(temp,"Ephemeral GitHub runner only");
const personas=JSON.parse(readFileSync(path.join(temp,"perf1-personas.json"),"utf8"));
const owner=personas.find(p=>p.id==="owner");
assert.ok(owner?.email&&owner?.password);
const out=path.join(temp,"netperf1a-synthetic-numeric");
mkdirSync(out,{recursive:true});
const browser=await chromium.launch({channel:"chrome",headless:true});
const widths=[1440,390,320];
const trials=5;
const round=x=>Math.round(x*10)/10;
function summary(values){
  if(!values.length)return {n:0,p50:null,p75:null,max:null};
  const sorted=[...values].sort((a,b)=>a-b);
  return {n:sorted.length,p50:round(sorted[Math.ceil(sorted.length/2)-1]),
    p75:round(sorted[Math.ceil(sorted.length*.75)-1]),max:round(sorted.at(-1))};
}
const report={contract:"net-perf1a-chrome-lab-v1",environment:"localhost_next_production_build",
  auth:"disposable_local_GoTrue_platform_owner",dataset:"36_fictional_directory_companies",
  fieldData:false,notice:"Numbers are local synthetic lab only, NOT production Core Web Vitals p75",
  viewports:{}};
const allErrors=[];

try{
 for(const width of widths){
  const ctx=await browser.newContext({viewport:{width,height:width===1440?900:860},
    locale:"it-IT",reducedMotion:"reduce",serviceWorkers:"block"});
  await ctx.route("**/*",route=>{
    let host;try{host=new URL(route.request().url()).hostname;}catch{return route.abort();}
    return ["127.0.0.1","localhost"].includes(host)?route.continue():route.abort();
  });
  const page=await ctx.newPage();
  const scriptErrors=[];
  page.on("pageerror",error=>scriptErrors.push(error.name));
  const numbers={ttfb:[],fcp:[],navigateToResults:[],countrySwitch:[],
    returnToItaly:[],roleSelect:[],search:[],openProfile:[],documentWidthOverflow:[]};

  const visit=async pathAndQuery=>{
    const start=Date.now();
    const response=await page.goto(base+pathAndQuery,{waitUntil:"domcontentloaded",timeout:90000});
    assert.ok(response?.status()<500,"Unexpected localhost server error");
    try{
      await page.getByTestId("network-compact-experience").waitFor({timeout:18000});
    }catch(error){
      // Synthetic data only. Do not print URL, cookies, user identity,
      // requests, company names or arbitrary page text.
      const diagnostic=await page.evaluate(()=>({
        pageKind:document.querySelector('[data-testid="network-compact-experience"]')?"compact":
          document.querySelector('[data-testid="network-access-mode"]')?"network_other":
          document.querySelector('form[role="search"]')?"network_search_fallback":"other",
        testIds:[...document.querySelectorAll("[data-testid]")].slice(0,25)
          .map(n=>n.getAttribute("data-testid")),
        hasLoginForm:Boolean(document.querySelector('input[name="email"]')),
        hasNetworkResults:Boolean(document.getElementById("network-results")),
        hasMain:Boolean(document.querySelector("main")),
      }));
      console.error("NET-PERF1.A LOCAL FALLBACK DIAGNOSTIC",JSON.stringify(diagnostic));
      throw error;
    }
    await page.locator("#network-results").waitFor({timeout:90000});
    const data=await page.evaluate(()=>{
      const nav=performance.getEntriesByType("navigation")[0];
      const paint=performance.getEntriesByType("paint").find(x=>x.name==="first-contentful-paint");
      return {ttfb:nav?.responseStart??null,fcp:paint?.startTime??null,
        overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth};
    });
    numbers.navigateToResults.push(Date.now()-start);
    if(data.ttfb!==null&&data.ttfb>=0)numbers.ttfb.push(data.ttfb);
    if(data.fcp!==null&&data.fcp>=0)numbers.fcp.push(data.fcp);
    numbers.documentWidthOverflow.push(data.overflow);
    assert.ok(data.overflow<=12,"Horizontal overflow on "+width+"px: "+data.overflow);
  };

  try{
   await page.goto(base+"/login",{waitUntil:"domcontentloaded",timeout:90000});
   await page.locator('input[name="email"]').fill(owner.email);
   await page.locator('input[name="password"]').fill(owner.password);
   await page.getByRole("button",{name:"Accedi",exact:true}).click();
   await page.waitForURL(u=>u.pathname!=="/login",{timeout:90000});
   assert.ok(page.url().startsWith(base),"Auth did not stay on localhost");

   for(let attempt=0;attempt<trials;attempt++){
    await visit("/network?netperf=1&country=IT");
    const overlay=page.locator("[data-netperf-panel]");
    await overlay.waitFor({state:"visible",timeout:25000});
    assert.ok((await overlay.innerText()).includes("Misurazione attiva"),
      "Platform Owner opt-in panel missing at width "+width);
    assert.equal(await page.getByTestId("network-europe-persistent-map").isVisible(),true);
    assert.ok(await page.getByTestId("network-compact-company-row").count()>=1,
      "No synthetic company rows. Fallback/empty fixtures invalidate benchmark");

    let start=Date.now();
    await page.locator('a[data-country="RO"]').first().click();
    await page.waitForURL(u=>u.pathname==="/network"&&u.searchParams.get("country")==="RO",{timeout:90000});
    await page.waitForFunction(()=>document.querySelector('select[name="country"]')?.value==="RO",{timeout:90000});
    numbers.countrySwitch.push(Date.now()-start);

    start=Date.now();
    await page.locator('a[data-country="IT"]').first().click();
    await page.waitForURL(u=>u.pathname==="/network"&&u.searchParams.get("country")==="IT",{timeout:90000});
    await page.waitForFunction(()=>document.querySelector('select[name="country"]')?.value==="IT",{timeout:90000});
    numbers.returnToItaly.push(Date.now()-start);

    if(width<1024){
      const drawer=page.getByTestId("network-filter-drawer");
      if(!(await drawer.locator("nav[aria-label='Ruolo nella filiera']").isVisible())){
        await drawer.getByRole("button",{name:/^Filtri/}).click();
      }
    }
    start=Date.now();
    await page.locator("nav[aria-label='Ruolo nella filiera'] a[href*='role=']").first().click();
    await page.waitForURL(u=>u.pathname==="/network"&&u.searchParams.has("role"),{timeout:90000});
    await page.getByTestId("network-compact-experience").waitFor({timeout:90000});
    numbers.roleSelect.push(Date.now()-start);

    await visit("/network?netperf=1&country=IT");
    const search=page.locator('input[name="q"]').first();
    await search.waitFor({state:"visible",timeout:90000});
    start=Date.now();
    await search.fill("Synthetic Steel");
    await page.waitForURL(u=>u.pathname==="/network"&&u.searchParams.has("q"),{timeout:90000});
    await page.getByTestId("network-compact-experience").waitFor({timeout:90000});
    numbers.search.push(Date.now()-start);

    await visit("/network?netperf=1&country=IT");
    const profile=page.locator('a[aria-label^="Apri profilo di"]').first();
    await profile.waitFor({state:"visible",timeout:90000});
    start=Date.now();
    await profile.click();
    await page.waitForURL(u=>/^\/network\/[^/]+$/.test(u.pathname),{timeout:90000});
    await page.locator("main").first().waitFor({state:"visible",timeout:90000});
    numbers.openProfile.push(Date.now()-start);
   }
   const metrics=Object.fromEntries(Object.entries(numbers).map(([name,values])=>[name,summary(values)]));
   report.viewports[String(width)]={trials,metrics,runtimeErrorCount:scriptErrors.length};
   console.log("NET-PERF1.A LOCAL CHROME",JSON.stringify({width,metrics,runtimeErrorCount:scriptErrors.length}));
   if(scriptErrors.length)allErrors.push(...scriptErrors);
  }finally{await ctx.close();}
 }
 assert.deepEqual(allErrors,[],"Synthetic Chrome runtime errors detected");
 writeFileSync(path.join(out,"numeric-summary.json"),JSON.stringify(report,null,2));
 console.log("NET-PERF1.A CHROME LAB BASELINE PASS: 1440/390/320, 5 cycles each; numeric-only artifact");
}finally{await browser.close();}
