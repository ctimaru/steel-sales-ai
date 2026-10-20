import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

// Hosted QA is confined to our two previously verified Vercel previews.
const hosts = [
  "https://steel-sales-jl6222xfv-ctimaru-5113.vercel.app",
  "https://steel-sales-gaq3y2k9i-ctimaru-5113.vercel.app",
];
assert.equal(process.env.CI,"true");
assert.equal(process.env.GITHUB_REF,"refs/heads/main");
assert.equal(process.env.GITHUB_EVENT_NAME,"workflow_dispatch");
assert.equal(process.env.REQUESTED_PROJECT_REF,"lwrrrphakpbjhbzljqhn");
assert.ok(process.env.RUNNER_TEMP);
const personas=JSON.parse(readFileSync(path.join(process.env.RUNNER_TEMP,"sr2b-personas.json"),"utf8"));
assert.deepEqual(personas.map(x=>x.id),["adminA","adminB","viewerA"]);
const names={adminA:"SR2B Demo Buyer A",adminB:"SR2B Demo Trader B",viewerA:"SR2B Demo Buyer A"};
const titles={adminA:"SR2B BUYER A PRIVATE RFQ",adminB:"SR2B TRADER B PRIVATE RFQ"};
const ids={adminA:"00000000-0000-4000-8000-000000072211",adminB:"00000000-0000-4000-8000-000000072212"};
let passed=0;
const browser=await chromium.launch({headless:true,channel:"chrome"});
try{
  for(const origin of hosts){
    for(const width of [1440,390]){
      for(const actor of personas){
        const context=await browser.newContext({
          viewport:{width,height:width===390?844:900},
          locale:"it-IT",serviceWorkers:"block",acceptDownloads:false,
          ...(process.env.UI4_VERCEL_BYPASS?
             {extraHTTPHeaders:{"x-vercel-protection-bypass":process.env.UI4_VERCEL_BYPASS}}:{})
        });
        try {
          const page=await context.newPage();
          const response=await page.goto(origin+"/login?next=%2Fdashboard",{waitUntil:"domcontentloaded",timeout:60000});
          assert.ok(response&&response.status()===200,"Staging login unavailable");
          await page.locator('input[name="email"]').fill(actor.email);
          await page.locator('input[name="password"]').fill(actor.password);
          await page.getByRole("button",{name:"Accedi",exact:true}).click();
          await page.waitForURL(url=>url.pathname==="/dashboard",{timeout:90000});
          await page.getByRole("heading",{name:"Oggi in "+names[actor.id]}).waitFor({timeout:45000});
          if(actor.id==="viewerA") assert.ok((await page.locator("body").innerText()).includes("Sola lettura"));
          for(const route of ["/dashboard","/commercial","/network"]){
            const result=await page.goto(origin+route,{waitUntil:"domcontentloaded",timeout:60000});
            assert.ok(result&&result.status()<500,"Hosted route failed");
            const body=await page.locator("body").innerText({timeout:20000});
            assert.ok(!body.includes("Application error: a server-side exception"));
            if(actor.id==="adminA") assert.ok(!body.includes(titles.adminB),"Tenant B leakage");
            if(actor.id==="adminB") assert.ok(!body.includes(titles.adminA),"Tenant A leakage");
            if(actor.id==="viewerA") assert.ok(!body.includes(titles.adminB),"Viewer leakage");
          }
          const foreign=actor.id==="adminB"?"adminA":"adminB";
          await page.goto(origin+"/commercial?item=campaign:"+ids[foreign],{waitUntil:"domcontentloaded"});
          assert.ok(!(await page.locator("body").innerText()).includes(titles[foreign]),"Foreign RFQ leaked");
          const size=await page.evaluate(()=>({client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
          assert.ok(size.scroll<=size.client+12,"Horizontal overflow");
          passed++;
          console.log("STAGING-READY2B hosted PASS",width,actor.id,origin===hosts[0]?"NEXT1A":"NEXT1B");
        }finally{await context.close();}
      }
    }
  }
}finally{await browser.close();}
assert.equal(passed,12);
console.log("STAGING-READY2B hosted acceptance PASS 12 role/viewport/preview checks");
