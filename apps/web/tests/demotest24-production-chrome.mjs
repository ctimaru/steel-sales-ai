/**
 * DEMOTEST2.4 — real production anonymous Chrome (read-only, no auth).
 * Explicitly blocks every non-GET/HEAD network request so the test cannot
 * register users, submit forms, trigger email, publish, dispatch or order.
 */
import assert from "node:assert/strict";
import { chromium } from "playwright";

const BASE = "https://www.smartsteelsales.com";
const browser = await chromium.launch({ headless: true, channel: "chrome" });
let count = 0;
let blockedWriteAttempt = false;
const attemptedWrites = new Set();
function pass(label) { count++; console.log("DEMOTEST2.4 CHROME PASS", label); }

async function createAnonymousContext(viewport, mobile = false) {
  const context = await browser.newContext({
    viewport, locale: "it-IT", isMobile: mobile,
    deviceScaleFactor: mobile ? 2 : 1, acceptDownloads: false,
    permissions: [], serviceWorkers: "block",
  });
  await context.route("**/*", async route => {
    const req = route.request();
    if (!["GET","HEAD"].includes(req.method())) {
      blockedWriteAttempt = true;
      // Never log path parameters, query strings, headers, cookies, or bodies.
      // Group attempted writes by method and route prefix only.
      const parsed = new URL(req.url());
      const segments = parsed.pathname.split("/").filter(Boolean);
      const safeRoute = "/" + segments.slice(0, 3).join("/");
      attemptedWrites.add(req.method() + " " + (parsed.hostname === "www.smartsteelsales.com" ? "first-party " : "third-party ") + safeRoute);
      await route.abort();
      return;
    }
    await route.continue();
  });
  const page = await context.newPage();
  return { context, page };
}

async function publicPage(page, path, label) {
  const response = await page.goto(BASE + path, {
    waitUntil: "domcontentloaded", timeout: 90000,
  });
  assert.equal(response?.status(), 200, path + " must be public HTTP 200");
  await page.getByRole("heading", { level: 1 }).first()
    .waitFor({ state: "visible", timeout: 45000 });
  const body = await page.locator("body").innerText();
  assert.ok(body.length > 100, path + " is blank");
  assert.ok(!body.includes("Questa sezione non è disponibile in questo momento"),
    path + " shows recovery fallback");
  assert.ok(!body.includes("DEMOTEST23 BUYER PRIVATE"),
    path + " exposes a synthetic private RFQ");
  assert.equal(new URL(page.url()).origin, BASE, "Unexpected origin navigation");
  pass(label);
}

try {
  const desktop = await createAnonymousContext({ width: 1440, height: 900 });
  for (const [path,name] of [
    ["/","public home"],
    ["/knowledge","public Knowledge"],
    ["/distinta","public Distinta"],
    ["/login","login form read-only"],
    ["/register","registration form read-only"],
  ]) await publicPage(desktop.page, path, "desktop " + name);
  for (const path of ["/dashboard","/rfq-hub","/marketplace","/platform"]) {
    await desktop.page.goto(BASE + path, { waitUntil: "domcontentloaded", timeout: 90000 });
    await desktop.page.waitForURL(u => u.pathname === "/login", { timeout: 30000 });
    await desktop.page.getByRole("heading", { name: "Accedi al tuo workspace" })
      .waitFor({ state: "visible", timeout: 30000 });
    pass("anonymous Chrome denied " + path);
  }
  await desktop.context.close();

  const mobile = await createAnonymousContext({ width: 390, height: 844 }, true);
  for (const path of ["/","/knowledge","/distinta","/login","/register"]) {
    await publicPage(mobile.page, path, "mobile public " + path);
    const bounds = await mobile.page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      content: document.documentElement.scrollWidth,
    }));
    assert.ok(bounds.content <= bounds.viewport + 12,
      path + " mobile horizontal overflow: " + bounds.content + "/" + bounds.viewport);
    pass("mobile no page overflow " + path);
  }
  await mobile.context.close();
  if (blockedWriteAttempt) {
    console.error("DEMOTEST2.4 BLOCKED WRITE ATTEMPT TYPES", [...attemptedWrites].join(" | "));
  }
  assert.ok(!blockedWriteAttempt,
    "Read-only production smoke encountered a non-GET/HEAD request (blocked, no writes)");
  console.log("DEMOTEST2.4 CHROME SUCCESS — " + count +
    " real browser anonymous checks; production logins: 0; production writes: 0");
} finally {
  await browser.close();
}
