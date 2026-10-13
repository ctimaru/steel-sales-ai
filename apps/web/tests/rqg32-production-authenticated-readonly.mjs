/**
 * RQG3.2 — deliberately opt-in, STRICTLY READ-ONLY authenticated production QA.
 * Seven dedicated SYNTHETIC accounts, browser login only. No production
 * fixture writes, direct RPCs, decisions, screenshots, videos or traces.
 */
import assert from "node:assert/strict";
import { chromium } from "playwright";

const ORIGIN = "https://www.smartsteelsales.com";
const SUPABASE_ORIGIN = "https://ecrafjdummcdfycznitx.supabase.co";
const loginPath = "/login";
assert.equal(process.env.RQG32_MODE, "EXPLICIT_MANUAL_READ_ONLY", "Explicit manual mode required");
assert.equal(process.env.CI, "true", "Use ephemeral protected CI runner only");
assert.equal(process.env.RQG32_CONFIRM, "I_APPROVE_READ_ONLY_RQG32", "User acknowledgement required");
assert.equal(process.env.GITHUB_EVENT_NAME, "workflow_dispatch", "Manual action required");
assert.equal(process.env.GITHUB_REF, "refs/heads/main", "Protected main required");

const defs = [
  { id: "registration", email: "RQG32_REGISTRATION_EMAIL", password: "RQG32_REGISTRATION_PASSWORD", lane: "/platform/registrations" },
  { id: "claims", email: "RQG32_CLAIMS_EMAIL", password: "RQG32_CLAIMS_PASSWORD", lane: "/platform/company-claims" },
  { id: "trust", email: "RQG32_TRUST_EMAIL", password: "RQG32_TRUST_PASSWORD", lane: "/platform/network-trust" },
  { id: "auditor", email: "RQG32_AUDITOR_EMAIL", password: "RQG32_AUDITOR_PASSWORD" },
  { id: "companyA", email: "RQG32_COMPANY_A_EMAIL", password: "RQG32_COMPANY_A_PASSWORD" },
  { id: "companyB", email: "RQG32_COMPANY_B_EMAIL", password: "RQG32_COMPANY_B_PASSWORD" },
  { id: "viewer", email: "RQG32_VIEWER_EMAIL", password: "RQG32_VIEWER_PASSWORD" },
];
const requiredEmails = {
  registration: "rqg32-registration@smartsteelsales.test",
  claims: "rqg32-claims@smartsteelsales.test",
  trust: "rqg32-trust@smartsteelsales.test",
  auditor: "rqg32-auditor@smartsteelsales.test",
  companyA: "rqg32-company-a@smartsteelsales.test",
  companyB: "rqg32-company-b@smartsteelsales.test",
  viewer: "rqg32-viewer@smartsteelsales.test",
};
const actors = [];
for (const definition of defs) {
  const email = process.env[definition.email]?.trim().toLowerCase() ?? "";
  const password = process.env[definition.password] ?? "";
  assert.equal(email,requiredEmails[definition.id],"Only exact synthetic persona emails allowed: "+definition.id);
  assert.ok(password.length >= 20, "Strong dedicated CI credential required: " + definition.id);
  // Never run against normal customers, real workers or the sole superadmin.
  const localPart = email.split("@")[0] ?? "";
  assert.ok(
    /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) &&
    (/^rqg32[-.+]/.test(localPart) || /[+]rqg32[-.+]/.test(localPart)),
    "Production account must be clearly synthetic (rqg32 prefix/tag): " + definition.id,
  );
  actors.push({ id: definition.id, email, password, lane: definition.lane });
}
assert.equal(new Set(actors.map(a => a.email)).size, actors.length, "Separate accounts required per role");
const markers = ["RQG32_COMPANY_A_MARKER", "RQG32_COMPANY_B_MARKER"].map(k => process.env[k]?.trim() ?? "");
for (const marker of markers) {
  assert.match(marker, /^RQG32-[A-Z0-9_-]{6,64}$/, "Must use dedicated test-only review marker");
}
assert.notEqual(markers[0], markers[1], "Companies need distinct evidence markers");
assert.deepEqual(markers,["RQG32-ORG_A-20261013","RQG32-ORG_B-20261013"],
  "Only reserved pre-approved synthetic evidence markers allowed");
const browser = await chromium.launch({ headless: true, channel: "chrome" });
let checks = 0;
let transmittedLoginPosts = 0;
let blockedNonAuthWrites = 0;
let blockedFirstPartyWrites = 0;
const deniedLandings = new Set(["/login", "/register", "/dashboard", "/onboarding", "/staff/access", "/platform", "/registration/status", "/legal/accept"]);

async function check(label, action) {
  try {
    await action();
    checks++;
    console.log("RQG32 PROD READ-ONLY PASS", label);
  } catch (e) {
    // Do not stringify Playwright call logs: they can contain session URLs.
    console.error("RQG32 PROD READ-ONLY FAIL", label, e?.name ?? "Error");
    throw new Error("RQG3.2 acceptance failed: " + label);
  }
}
async function createActorSession(actor) {
  const context = await browser.newContext({
    viewport: { width: actor.id === "auditor" || actor.id === "companyB" ? 390 : 1440, height: 850 },
    locale: "it-IT", serviceWorkers: "block", acceptDownloads: false, permissions: [],
  });
  let allowLoginPost = true;
  await context.route("**/*", async route => {
    const request = route.request();
    if (request.method() === "GET" || request.method() === "HEAD") return route.continue();
    const url = new URL(request.url());
    const allowedLoginAction = allowLoginPost &&
      request.method() === "POST" &&
      url.origin === ORIGIN && url.pathname === loginPath;
    const allowedSupabasePasswordLogin = allowLoginPost &&
      request.method() === "POST" && url.origin === SUPABASE_ORIGIN &&
      url.pathname === "/auth/v1/token" && url.searchParams.get("grant_type") === "password";
    if (allowedLoginAction || allowedSupabasePasswordLogin) {
      transmittedLoginPosts++;
      return route.continue();
    }
    blockedNonAuthWrites++;
    if (url.origin === ORIGIN || url.origin === SUPABASE_ORIGIN) blockedFirstPartyWrites++;
    // Do not send any application mutation, analytics POST, email or external write.
    return route.abort();
  });
  const page = await context.newPage();
  try {
    const start = await page.goto(ORIGIN + loginPath, { waitUntil: "domcontentloaded", timeout: 90000 });
    assert.ok(start && start.status() < 500, "Login unavailable");
    await page.locator('input[name="email"]').fill(actor.email);
    await page.locator('input[name="password"]').fill(actor.password);
    await page.getByRole("button", { name: "Accedi", exact: true }).click();
    await page.waitForURL(u => u.origin === ORIGIN && u.pathname !== "/login", { timeout: 90000 });
    allowLoginPost = false;
    assert.equal(new URL(page.url()).origin, ORIGIN);
    return { context, page };
  } catch (e) {
    allowLoginPost = false;
    await context.close();
    throw e;
  }
}
async function navigate(page, href) {
  assert.ok(href.startsWith("/") && !href.startsWith("//"), "Only relative app routes");
  try {
    const response = await page.goto(ORIGIN + href, { waitUntil: "domcontentloaded", timeout: 90000 });
    assert.ok(!response || response.status() < 500, "Page unavailable");
  } catch (e) {
    // Next.js can abort an initial navigation when server redirects the user.
    if (!String(e).includes("net::ERR_ABORTED")) throw e;
  }
}
async function denied(page, href) {
  const probe = await page.context().newPage();
  try {
    await navigate(probe, href);
    await probe.waitForURL(u => u.origin === ORIGIN && deniedLandings.has(u.pathname), { timeout: 45000 });
    assert.ok(deniedLandings.has(new URL(probe.url()).pathname), "Denied URL was readable");
    assert.notEqual(new URL(probe.url()).pathname, href);
    const body = await probe.locator("body").innerText();
    assert.ok(!body.includes(markers[0]) && !body.includes(markers[1]), "Cross-tenant evidence leaked");
    assert.ok(!body.includes("Review dati commerciali"), "Company Review was rendered");
  } finally {
    await probe.close();
  }
}
async function platformReview(page, expectedLanes, readOnly = false) {
  await navigate(page, "/platform/review");
  const cards = page.locator('section[aria-labelledby="platform-review-domains"] a');
  await cards.first().waitFor({ state: "visible", timeout: 60000 });
  assert.equal(new URL(page.url()).pathname, "/platform/review");
  assert.equal(await cards.count(), expectedLanes.length, "Unexpected accessible Platform lanes");
  const hrefs = await cards.evaluateAll(items => items.map(x => x.getAttribute("href")));
  assert.deepEqual([...hrefs].sort(), [...expectedLanes].sort(), "Platform decision domain leakage");
  const body = await page.locator("body").innerText();
  assert.ok(!body.includes(markers[0]) && !body.includes(markers[1]), "Tenant evidence on Platform Review");
  if (readOnly) {
    assert.equal((body.match(/Sola lettura · nessuna decisione autorizzata/g) ?? []).length, expectedLanes.length);
    assert.ok(!body.includes("Decisioni abilitate:"), "Auditor acquired decision permissions");
  } else {
    assert.ok(body.includes("Decisioni abilitate:"), "Delegated role lacks authorized decision list");
  }
}
const allLanes = [
  "/platform/registrations", "/platform/company-claims", "/platform/company-discovery",
  "/platform/network-trust", "/platform/knowledge",
];
const sessions = new Map();
try {
  for (const actor of actors) {
    await check(actor.id + " authentic Chrome sign-in", async () => {
      sessions.set(actor.id, await createActorSession(actor));
    });
  }
  assert.ok(transmittedLoginPosts >= actors.length, "No real credential authentication observed");
  for (const id of ["registration", "claims", "trust"]) {
    const actor = actors.find(a => a.id === id);
    const page = sessions.get(id).page;
    await check(id + " accesses ONLY its delegated Platform Review lane", async () => {
      await platformReview(page, [actor.lane]);
      for (const forbidden of allLanes.filter(p => p !== actor.lane)) await denied(page, forbidden);
      await denied(page, "/operations/review");
    });
  }
  await check("auditor: five read-only Platform lanes, no Company Review", async () => {
    const page = sessions.get("auditor").page;
    await platformReview(page, allLanes, true);
    await denied(page, "/operations/review");
    await denied(page, "/review/identities");
  });
  for (const [id, own, other] of [
    ["companyA", markers[0], markers[1]],
    ["companyB", markers[1], markers[0]],
  ]) {
    await check(id + " sees own synthetic Review evidence, not another tenant", async () => {
      const page = sessions.get(id).page;
      await navigate(page, "/operations/review");
      await page.getByText(own, { exact: false }).first().waitFor({ state: "visible", timeout: 60000 });
      const body = await page.locator("body").innerText();
      assert.ok(body.includes("Qualità dati aziendali") && body.includes("Review dati commerciali"));
      assert.ok(body.includes(own) && !body.includes(other));
      assert.equal(new URL(page.url()).pathname, "/operations/review");
      await denied(page, "/platform/review");
      await denied(page, "/platform/company-claims");
    });
  }
  await check("company viewer denied all Company and Platform Review routes", async () => {
    const page = sessions.get("viewer").page;
    for (const href of ["/operations/review", "/review", "/review/identities", "/platform/review"]) {
      await denied(page, href);
    }
  });
  console.log("RQG3.2 PRODUCTION AUTHENTICATED READ-ONLY COMPLETE",
    JSON.stringify({ passed: checks, personas: actors.length, loginPosts: transmittedLoginPosts,
      blockedWrites: blockedNonAuthWrites, blockedAppWrites: blockedFirstPartyWrites,
      mutationRequestsTransmitted: 0 }));
} finally {
  for (const s of sessions.values()) await s.context.close();
  await browser.close();
}
