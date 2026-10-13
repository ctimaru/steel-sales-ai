/**
 * RQG3.2 — authenticated, read-only PRODUCTION Chrome acceptance.
 * No decision buttons, writes, write-RPCs, customer-record mutations or browser traces.
 * Personas come only from an encrypted Actions environment secret.
 */
import assert from "node:assert/strict";
import { chromium } from "playwright";

const origin = "https://www.smartsteelsales.com";
assert.equal(process.env.GITHUB_EVENT_NAME, "workflow_dispatch");
assert.equal(process.env.RQG32_APPROVED_READ_ONLY, "true");
const roleNames = [
  "owner", "registrationStaff", "claimsStaff", "trustStaff", "auditor",
  "companyAdminA", "companyAdminB", "companyViewerA",
];
assert.ok(process.env.RQG32_PERSONAS_JSON, "Missing pre-approved synthetic persona secret");
const personas = JSON.parse(process.env.RQG32_PERSONAS_JSON);
assert.deepEqual(Object.keys(personas).sort(), [...roleNames].sort(), "Exact eight synthetic roles required");
for (const name of roleNames) {
  const p = personas[name];
  assert.ok(p?.synthetic === true && typeof p.email === "string" &&
    p.email.includes("@") && typeof p.password === "string" && p.password.length >= 8,
    name + ": approved synthetic credentials required");
}
const a = personas.companyAdminA.expectedMarker, b = personas.companyAdminB.expectedMarker;
assert.ok(typeof a === "string" && a.startsWith("RQG32-") && a.length >= 12);
assert.ok(typeof b === "string" && b.startsWith("RQG32-") && b.length >= 12);
assert.notEqual(a,b,"Tenant markers must be distinct");

const browser = await chromium.launch({headless:true,channel:"chrome"});
const sessions = new Map();
const landing = new Set(["/login","/dashboard","/onboarding","/register",
  "/platform","/staff/access","/registration/status","/legal/accept"]);
let passes = 0, disallowedPosts = 0;
const passed = name => { passes++; console.log("RQG3.2 PASS", name); };
async function visit(page,path) {
  const res = await page.goto(origin+path,{waitUntil:"domcontentloaded",timeout:90000});
  assert.ok(res && res.status()<500,path+" failed");
  return page.locator("body").innerText();
}
async function login(role) {
  const context = await browser.newContext({locale:"it-IT",serviceWorkers:"block",
    viewport:{width:1440,height:900},acceptDownloads:false});
  let loginOnly = true, loginPosts = 0;
  await context.route("**/*",route=>{
    const request=route.request(),method=request.method(),url=new URL(request.url());
    if (method==="GET" || method==="HEAD") return route.continue();
    if (method==="POST" && loginOnly && url.origin===origin && url.pathname==="/login") {
      loginPosts++;
      return route.continue();
    }
    disallowedPosts++;
    return route.abort("blockedbyclient");
  });
  const page = await context.newPage();
  await visit(page,"/login");
  await page.locator('input[name="email"]').fill(personas[role].email);
  await page.locator('input[name="password"]').fill(personas[role].password);
  await page.getByRole("button",{name:"Accedi",exact:true}).click();
  await page.waitForURL(u=>u.origin===origin && u.pathname!=="/login",{timeout:90000});
  loginOnly=false;
  assert.ok(loginPosts>=1 && disallowedPosts===0,"Login had unexpected write: "+role);
  sessions.set(role,{page,context});
  passed(role+" signed in (production)");
}
async function denied(role,path) {
  // New tab to avoid racing Next.js cascading redirects on a reused tab.
  const tab=await sessions.get(role).context.newPage();
  try {
    try { await visit(tab,path); }
    catch(e) { if (!String(e).includes("net::ERR_ABORTED")) throw e; }
    await tab.waitForURL(u=>u.origin===origin && landing.has(u.pathname),{timeout:60000});
    assert.notEqual(new URL(tab.url()).pathname,path,role+" gained forbidden "+path);
    const body=await tab.locator("body").innerText();
    assert.ok(body.length>20 && !body.includes(a) && !body.includes(b),
      "Private fixture exposed during denial");
    passed(role+" denied "+path);
  } finally { await tab.close(); }
}
async function platform(role,count,href=null,readonly=false) {
  const page=sessions.get(role).page;
  await visit(page,"/platform/review");
  const links=page.locator('section[aria-labelledby="platform-review-domains"] a');
  await links.first().waitFor({state:"visible",timeout:60000});
  assert.equal(new URL(page.url()).pathname,"/platform/review");
  assert.equal(await links.count(),count,role+" unexpected permissions");
  if(href) assert.equal(await links.first().getAttribute("href"),href);
  const body=await page.locator("body").innerText();
  assert.ok(!body.includes(a) && !body.includes(b),"Tenant evidence visible to Platform");
  if(readonly) assert.equal((body.match(/Sola lettura · nessuna decisione autorizzata/g)||[]).length,count);
  else assert.ok(body.includes("Decisioni abilitate:"));
  passed(role+" scoped Platform lanes");
  await denied(role,"/operations/review");
}
async function company(role,owned,foreign) {
  const page=sessions.get(role).page;
  await visit(page,"/operations/review");
  await page.getByText(owned,{exact:false}).first().waitFor({state:"visible",timeout:60000});
  const body=await page.locator("body").innerText();
  assert.equal(new URL(page.url()).pathname,"/operations/review");
  assert.ok(body.includes("Qualità dati aziendali") && body.includes(owned));
  assert.ok(!body.includes(foreign),"Cross-tenant evidence leak");
  passed(role+" synthetic Company Review isolated");
  await denied(role,"/platform/review");
}
try {
  for(const role of roleNames) await login(role);
  await platform("owner",5);
  await platform("registrationStaff",1,"/platform/registrations");
  await platform("claimsStaff",1,"/platform/company-claims");
  await platform("trustStaff",1,"/platform/network-trust");
  await platform("auditor",5,null,true);
  await denied("registrationStaff","/platform/company-claims");
  await denied("claimsStaff","/platform/registrations");
  await denied("trustStaff","/platform/company-claims");
  await denied("auditor","/review");
  await company("companyAdminA",a,b);
  await company("companyAdminB",b,a);
  for(const path of ["/operations/review","/review","/review/identities","/platform/review"])
    await denied("companyViewerA",path);
  assert.equal(disallowedPosts,0,"Unexpected production write was attempted");
  console.log("RQG3.2 PRODUCTION AUTH PASS",passes,"checks; decision writes=0");
} finally {
  for(const {context} of sessions.values()) await context.close();
  await browser.close();
}
