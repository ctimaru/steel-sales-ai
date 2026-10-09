/**
 * PERF1 Chrome multi-account acceptance.
 * Runs exclusively on disposable localhost Next.js + local GoTrue/Postgres.
 * No production credentials, no dispatch, no private data in CI artifacts.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const base = process.env.PERF1_WEB_URL ?? "";
assert.equal(base, "http://127.0.0.1:3000", "External URLs forbidden");
assert.ok(process.env.RUNNER_TEMP, "Ephemeral CI runner required");
const personas = JSON.parse(readFileSync(path.join(process.env.RUNNER_TEMP, "perf1-personas.json"), "utf8"));
assert.equal(personas.length, 6);
const tenants = personas.filter(p => p.org);
assert.equal(tenants.length, 5);
assert.equal(new Set(tenants.map(p => p.org)).size, 4);
const owner = personas.find(p => p.id === "owner");
assert.ok(owner);

const browser = await chromium.launch({ headless: true, channel: "chrome" });
const checks = [];
async function check(label, fn) {
  try {
    await fn();
    checks.push(label);
    console.log("PERF1 CHROME PASS", label);
  } catch (error) {
    console.error("PERF1 CHROME FAIL", label, error instanceof Error ? error.message : String(error));
    throw error;
  }
}
async function visit(page, route) {
  const response = await page.goto(base + route, { waitUntil: "domcontentloaded", timeout: 90000 });
  assert.ok(response, "No HTTP response for " + route);
  assert.ok(response.status() < 500, route + " HTTP " + response.status());
  return response;
}
async function pageText(page) {
  const text = await page.locator("body").innerText({ timeout: 30000 });
  assert.ok(text.length > 25, "Rendered document unexpectedly empty");
  assert.ok(!text.includes("Application error: a server-side exception"), "Server render exception");
  return text;
}
async function signIn(page, p, expectDestination = "/dashboard") {
  await visit(page, "/login");
  await page.locator('input[name="email"]').fill(p.email);
  await page.locator('input[name="password"]').fill(p.password);
  await page.getByRole("button", { name: "Accedi", exact: true }).click();
  await page.waitForURL(u => u.pathname === expectDestination, { timeout: 90000 });
}
async function openHome(page) {
  await visit(page, "/");
  return new URL(page.url()).pathname;
}

try {
  const anon = await browser.newContext({ locale: "it-IT", viewport: { width: 390, height: 844 } });
  const anonPage = await anon.newPage();
  await check("anonymous mobile homepage remains public", async () => {
    assert.equal(await openHome(anonPage), "/");
    const text = await pageText(anonPage);
    assert.ok(text.includes("Il business network dell’acciaio"));
    assert.ok(text.includes("Crea distinta"));
    assert.ok(text.includes("Trova o rivendica la tua azienda"));
  });
  await check("anonymous is denied dashboard and Platform console", async () => {
    await visit(anonPage, "/dashboard");
    await anonPage.waitForURL(u => u.pathname === "/login", { timeout: 35000 });
    assert.ok(!(await pageText(anonPage)).includes("Oggi in DEMO"));
    await visit(anonPage, "/platform");
    await anonPage.waitForURL(u => u.pathname === "/login", { timeout: 35000 });
    assert.ok(!(await pageText(anonPage)).includes("Governance della piattaforma"));
  });
  await check("malformed authentication cookie never grants homepage access", async () => {
    await anon.addCookies([{
      name: "sb-127-auth-token",
      value: "not-a-session",
      url: base,
    }]);
    assert.equal(await openHome(anonPage), "/");
    const text = await pageText(anonPage);
    assert.ok(text.includes("Utile anche senza account"));
    await anon.clearCookies();
  });
  await anon.close();

  for (const p of tenants) {
    const context = await browser.newContext({ locale: "it-IT", viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await check(p.id + " authentic GoTrue login", async () => {
      await signIn(page, p);
      await page.getByRole("heading", { name: "Oggi in " + p.name })
        .waitFor({ state: "visible", timeout: 60000 });
      const text = await pageText(page);
      assert.ok(text.includes(p.name));
      if (p.id === "buyerViewer") assert.ok(text.includes("Sola lettura"));
    });
    await check(p.id + " authenticated homepage preserves dashboard redirect", async () => {
      const target = await openHome(page);
      assert.equal(target, "/dashboard", "Authenticated / did not redirect to /dashboard");
      await page.getByRole("heading", { name: "Oggi in " + p.name })
        .waitFor({ state: "visible", timeout: 60000 });
    });
    await check(p.id + " company identity stays tenant-scoped", async () => {
      const text = await pageText(page);
      for (const other of personas) {
        if (other.org && other.org !== p.org) {
          assert.ok(!text.includes("Oggi in " + other.name), "Cross-tenant workspace identity leaked");
        }
      }
    });
    await check(p.id + " cannot open Platform Owner administration", async () => {
      await visit(page, "/platform");
      await page.waitForURL(u => u.pathname !== "/platform", { timeout: 60000 });
      assert.ok(!(await pageText(page)).includes("Governance della piattaforma"));
    });
    await context.close();
  }

  const ownerContext = await browser.newContext({ locale: "it-IT", viewport: { width: 1440, height: 900 } });
  const ownerPage = await ownerContext.newPage();
  await check("synthetic Platform Owner authenticates with real GoTrue", async () => {
    // The local owner has no company membership; the login flow may route
    // to /register, and direct /platform must still authorize correctly.
    await signIn(ownerPage, owner, "/register");
  });
  await check("only Platform Owner reaches the governance console", async () => {
    await visit(ownerPage, "/platform");
    await ownerPage.getByRole("heading", { name: "Governance della piattaforma" })
      .waitFor({ state: "visible", timeout: 60000 });
    assert.equal(new URL(ownerPage.url()).pathname, "/platform");
  });
  await ownerContext.close();

  const mobile = await browser.newContext({
    locale: "it-IT", viewport: { width: 390, height: 844 }, isMobile: true, deviceScaleFactor: 2,
  });
  const mobilePage = await mobile.newPage();
  await check("mobile Chrome login with buyer account", async () => {
    await signIn(mobilePage, tenants[0]);
    await mobilePage.getByRole("heading", { name: "Oggi in " + tenants[0].name })
      .waitFor({ state: "visible", timeout: 60000 });
  });
  await check("mobile Chrome authenticated homepage returns own workspace", async () => {
    assert.equal(await openHome(mobilePage), "/dashboard");
    const text = await pageText(mobilePage);
    assert.ok(text.includes(tenants[0].name));
  });
  await mobile.close();

  console.log("PERF1 CHROME ACCEPTANCE PASS:", checks.length, "checks; 6 real GoTrue users; 4 companies + viewer + synthetic platform owner; localhost only");
} finally {
  await browser.close();
}
