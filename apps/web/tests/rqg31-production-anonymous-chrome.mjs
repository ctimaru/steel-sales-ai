/**
 * RQG3.1: strict anonymous Chrome against deployed production.
 * No saved sessions, no privileged credentials, no non-GET/HEAD requests.
 * Only validates authentication boundaries; cannot replace signed-in E2E.
 */
import assert from "node:assert/strict";
import { chromium } from "playwright";
const origin="https://www.smartsteelsales.com";
const browser=await chromium.launch({headless:true,channel:"chrome"});
let passed=0;
try {
  for(const width of [390,1440]) {
    const context=await browser.newContext({viewport:{width,height:850},locale:"it-IT",serviceWorkers:"block",acceptDownloads:false});
    await context.route("**/*",route=>{
      if(!["GET","HEAD"].includes(route.request().method()))return route.abort();
      return route.continue();
    });
    const page=await context.newPage();
    for(const route of [
      "/platform/review","/platform/registrations","/platform/company-claims",
      "/platform/network-trust","/operations/review","/review","/review/identities",
    ]) {
      const result=await page.goto(origin+route,{waitUntil:"domcontentloaded",timeout:90000});
      assert.ok(result&&result.status()<500,route+" is unavailable");
      await page.waitForURL(u=>u.origin===origin&&u.pathname==="/login",{timeout:45000});
      const body=await page.locator("body").innerText();
      assert.ok(body.includes("Accedi"),"Login gate missing "+route);
      assert.ok(!body.includes("RQG31 PRIVATE"),"Review evidence on public response");
      passed++;
      console.log("RQG3.1 PRODUCTION ANON PASS",width,route);
    }
    await context.close();
  }
  console.log("RQG3.1 PRODUCTION ANONYMOUS Chrome:",passed,"denied routes; authenticated decision acceptance NOT tested here; write requests sent=0");
} finally {
  await browser.close();
}
