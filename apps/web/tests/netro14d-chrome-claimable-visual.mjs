/**
 * NET-RO1.4.C.1 — source-backed Romania claimable profiles in REAL Chrome,
 * but only against disposable 127.0.0.1 Supabase / synthetic GoTrue users.
 * NEVER hits hosted production and NEVER submits a company-claim request.
 * 1440/390/320 screenshot evidence accompanies guarded admin/viewer checks.
 */
import assert from "node:assert/strict";
import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";

const base = process.env.DEMOTEST23_WEB_URL;
const dbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
assert.equal(base, "http://127.0.0.1:3000", "Hosted browser target is forbidden");
assert.equal(dbUrl, "http://127.0.0.1:54321", "Hosted Supabase is forbidden");
assert.equal(process.env.FLOW1_LOCAL_PROVIDER, "true", "Synthetic fixture is mandatory");
assert.ok(process.env.RUNNER_TEMP, "RUNNER_TEMP required");
const serviceKey = process.env.DEMOTEST23_LOCAL_SERVICE_ROLE_KEY;
assert.ok(serviceKey && serviceKey.length > 20, "Local-only key required");
const adminClient = createClient(dbUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const people = JSON.parse(readFileSync(path.join(process.env.RUNNER_TEMP, "demotest23-personas.json"), "utf8"));
const admin = people.find(x => x.id === "buyer");
const viewer = people.find(x => x.id === "buyerViewer");
assert.ok(admin && viewer, "Isolated admin and viewer personas required");
const out = path.join(process.env.RUNNER_TEMP, "netro14d-synthetic-visual");
mkdirSync(out, { recursive: true });

const domains = [
  { domain: "artrom.com", role: "producer" },
  { domain: "baurom.ro", role: "trader" },
  { domain: "laser-rmc.ro", role: "processor" },
];
const { data: records, error } = await adminClient
  .from("network_companies")
  .select("id,legal_name,website_domain,publication_status,claimed_status,verification_status")
  .eq("country_code", "RO")
  .in("website_domain", domains.map(x => x.domain));
assert.ifError(error);
assert.equal(records?.length, 3, "Expected one local canonical company per reference role");
const companies = domains.map(({domain,role}) => {
  const record = records.find(x => x.website_domain === domain);
  assert.ok(record, "Missing disposable profile " + domain);
  assert.equal(record.publication_status, "published");
  assert.equal(record.claimed_status, "unclaimed");
  assert.equal(record.verification_status, "unverified");
  return { ...record, role };
});

const browser = await chromium.launch({ channel: "chrome", headless: true });
let assertions = 0;
async function session(person, width) {
  const height = width === 1440 ? 900 : width === 390 ? 844 : 720;
  const context = await browser.newContext({
    viewport: {width, height}, locale:"it-IT", reducedMotion:"reduce",
    deviceScaleFactor: width < 1000 ? 2 : 1, serviceWorkers:"block",
  });
  await context.route("**/*", route => {
    const url = route.request().url();
    const target = new URL(url);
    return target.hostname === "127.0.0.1" || target.hostname === "localhost"
      ? route.continue() : route.abort();
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", err => errors.push(err.message));
  await page.goto(base + "/login", { waitUntil:"domcontentloaded", timeout:90000 });
  await page.locator('input[name="email"]').fill(person.email);
  await page.locator('input[name="password"]').fill(person.password);
  await page.getByRole("button",{name:"Accedi",exact:true}).click();
  await page.waitForURL(u=>u.pathname==="/dashboard",{timeout:90000});
  return {context,page,height,errors};
}
async function navigate(page, href) {
  const response = await page.goto(base + href, {waitUntil:"domcontentloaded",timeout:90000});
  assert.ok(response,"Missing response "+href);
  assert.equal(response.status(),200,"Unexpected HTTP response "+href);
  assert.ok((await page.locator("body").innerText()).length>80,"Blank or inaccessible "+href);
}
async function noOverflow(page, tag) {
  const metrics = await page.evaluate(() => ({
    width: document.documentElement.clientWidth,
    documentWidth: document.documentElement.scrollWidth,
  }));
  assert.ok(metrics.documentWidth <= metrics.width + 12,
    "Horizontal overflow on "+tag+": "+JSON.stringify(metrics));
  assertions++;
}
async function screenshot(page,slug,width) {
  // All credentials are synthetic; screenshots never include tokens or keys.
  await page.screenshot({path:path.join(out,slug+"-"+width+".png"),fullPage:false,animations:"disabled"});
}

try {
  for (const width of [1440,390,320]) {
    const {context,page,height,errors}=await session(admin,width);
    try {
      await navigate(page,"/network?country=RO");
      assert.match(await page.locator("body").innerText(), /ARTROM|Baurom/);
      await noOverflow(page,"Romania-directory/admin/"+width);
      await screenshot(page,"romania-directory-admin",width);
      assertions += 2;

      for (const co of companies) {
        const profilePath="/network/"+co.id;
        await navigate(page,profilePath);
        await page.getByRole("heading",{level:1,name:co.legal_name}).waitFor({state:"visible",timeout:45000});
        const claim=page.getByTestId("network-unclaimed-company-claim");
        await claim.waitFor({state:"visible",timeout:45000});
        assert.match(await claim.innerText(),/Profilo non rivendicato/);
        const link=claim.getByRole("link",{name:"Rivendica questa azienda"});
        assert.equal(await link.count(),1);
        assert.equal(new URL(await link.getAttribute("href"),base).pathname,profilePath+"/claim");
        const claimRect=await claim.boundingBox();
        const connectRect=await page.getByTestId("network-profile-connect-disabled").boundingBox().catch(()=>null);
        assert.ok(claimRect && claimRect.y < height,
          "Claim action must appear inside viewport at "+width+"/"+co.role+": "+JSON.stringify(claimRect));
        if(connectRect) assert.ok(claimRect.y < connectRect.y,
          "Claim CTA must precede disabled connection action for "+co.role);
        await noOverflow(page,co.role+"/admin/"+width);
        await screenshot(page,"romania-"+co.role+"-admin",width);
        assertions+=7;

        if(co.role==="producer") {
          await navigate(page,profilePath+"/claim");
          await page.getByRole("heading",{name:/^Rivendica /}).waitFor({state:"visible"});
          assert.match(await page.locator("body").innerText(), /Non verificata/);
          assert.equal(await page.locator('input[name="network_company_id"]').inputValue(),co.id);
          await noOverflow(page,"claim/admin/"+width);
          await screenshot(page,"romania-claim-admin",width);
          assertions+=3;
          // Only inspect the form: NEVER click submit, send an email or claim a real company.
        }
      }
      assert.deepEqual(errors,[],"Hydration/runtime errors on admin "+width);
    } finally { await context.close(); }

    // Same entitled synthetic organization but viewer role: the claim CTA must
    // enter registration, never expose the owner submission form.
    const v=await session(viewer,width);
    try {
      const company=companies[0];
      const profilePath="/network/"+company.id;
      await navigate(v.page,profilePath);
      const claim=v.page.getByTestId("network-unclaimed-company-claim");
      await claim.waitFor({state:"visible"});
      const link=claim.getByRole("link",{name:"Rivendica questa azienda"});
      assert.equal(await link.count(),1);
      const next=new URL(await link.getAttribute("href"),base);
      assert.equal(next.pathname,"/register");
      assert.equal(next.searchParams.get("company"),company.legal_name);
      assert.equal(next.searchParams.get("return_to"),profilePath+"/claim");
      assert.equal(next.hash,"#company-check");
      await noOverflow(v.page,"producer/viewer/"+width);
      await screenshot(v.page,"romania-producer-viewer",width);
      // A viewer may not open the privileged claim form.
      await v.page.goto(base+profilePath+"/claim",{waitUntil:"domcontentloaded",timeout:90000});
      await v.page.waitForURL(u=>u.pathname!==profilePath+"/claim",{timeout:45000});
      assert.equal(await v.page.locator('input[name="network_company_id"]').count(),0);
      assert.deepEqual(v.errors,[],"Hydration/runtime errors on viewer "+width);
      assertions+=7;
    } finally { await v.context.close(); }
    console.log("NET-RO1.4.C.1 LOCAL CHROME PASS",width,"admin / viewer, 3 company roles, claim safety");
  }
} finally {
  await browser.close();
}
console.log("NET-RO1.4.C.1 SYNTHETIC CHROME PASS",assertions,
  "local-only assertions, no profile ownership changes, 1440/390/320 screenshots");
