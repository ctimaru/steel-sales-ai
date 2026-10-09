/**
 * DEMOTEST2.3 — end-to-end Google Chrome + real Supabase GoTrue sessions.
 * Uses ONLY local Next + local Supabase, 4 company admins and buyer-viewer.
 * Test output avoids exposing passwords/session cookies to CI artifacts.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const base = (process.env.DEMOTEST23_WEB_URL ?? "").replace(/\/$/, "");
const temp = process.env.RUNNER_TEMP;
assert.equal(base, "http://127.0.0.1:3000", "External/public web host prohibited");
assert.ok(temp, "RUNNER_TEMP required");
const personas = JSON.parse(readFileSync(path.join(temp, "demotest23-personas.json"), "utf8"));
assert.equal(personas.length, 5);
const browser = await chromium.launch({ headless: true, channel: "chrome" });
const checks = [];

async function step(label, fn) {
  try {
    await fn();
    checks.push({ label, status: "PASS" });
    console.log("CHROME AUTH PASS", label);
  } catch (error) {
    console.error("CHROME AUTH FAIL", label, error instanceof Error ? error.message : String(error));
    throw error;
  }
}

async function navigate(page, href, status = 200) {
  const response = await page.goto(base + href, {
    waitUntil: "domcontentloaded",
    timeout: 90000,
  });
  assert.ok(response, "Missing navigation response for " + href);
  assert.equal(response.status(), status, href + " HTTP status");
  const body = await page.locator("body").innerText({ timeout: 25000 });
  assert.ok(body.trim().length > 25, href + " is blank");
  assert.ok(!body.includes("Application error: a server-side exception"), href + " crashed");
  return body;
}

async function login(page, p) {
  await navigate(page, "/login");
  await page.locator('input[name="email"]').fill(p.email);
  await page.locator('input[name="password"]').fill(p.password);
  await page.getByRole("button", { name: "Accedi", exact: true }).click();
  await page.waitForURL(url => url.pathname === "/dashboard", { timeout: 90000 });
  const title = page.getByRole("heading", { name: "Oggi in " + p.name });
  try {
    await title.waitFor({ state: "visible", timeout: 22000 });
  } catch (error) {
    const landing = await page.locator("body").innerText({ timeout: 15000 }).catch(() => "body unavailable");
    console.error("DEMOTEST23 LOGIN RENDER DIAGNOSTIC", p.id,
      "path=" + new URL(page.url()).pathname,
      "body=" + landing.slice(0, 1400).replace(/\\s+/g, " "));
    throw error;
  }
  assert.ok((await page.locator("body").innerText()).includes(p.name));
}

try {
  const anonymous = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "it-IT" });
  const anonymousPage = await anonymous.newPage();
  await step("anonymous cannot access private workspace", async () => {
    await anonymousPage.goto(base + "/dashboard", { waitUntil: "domcontentloaded", timeout: 90000 });
    await anonymousPage.waitForURL(url => url.pathname === "/login", { timeout: 30000 });
    assert.ok(!(await anonymousPage.locator("body").innerText()).includes("Oggi in DEMO"));
  });
  await step("anonymous cannot inspect buyer RFQ", async () => {
    const res = await anonymousPage.goto(base + "/rfq-hub/" + personas[0].rfq, {
      waitUntil: "domcontentloaded", timeout: 90000,
    });
    const body = await anonymousPage.locator("body").innerText();
    assert.ok(!body.includes(personas[0].rfqTitle), "Private RFQ leaked to anonymous browser");
    assert.ok([200, 302, 303, 307, 308, 404].includes(res.status()));
  });
  await anonymous.close();

  for (const p of personas) {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 }, locale: "it-IT",
    });
    const page = await context.newPage();

    await step(p.id + " real GoTrue UI login", () => login(page, p));
    await step(p.id + " own company workspace", async () => {
      const body = await navigate(page, "/dashboard");
      assert.ok(body.includes(p.name));
      assert.ok(!body.includes("Oggi in " + personas.find(other => other.org !== p.org)?.name));
      if (p.id === "buyerViewer") {
        assert.ok(body.includes("Sola lettura"), "Viewer workspace role not disclosed");
      }
    });

    await step(p.id + " RFQ Hub visibility", async () => {
      const body = await navigate(page, "/rfq-hub");
      if (p.id === "buyerViewer") {
        assert.ok(!body.includes(p.rfqTitle), "Viewer accessed owner-only buyer campaign");
      } else {
        assert.ok(body.includes(p.rfqTitle), "Own RFQ is missing");
        for (const other of personas) {
          if (other.org !== p.org) assert.ok(!body.includes(other.rfqTitle), "Cross-tenant private RFQ leaked");
        }
      }
    });

    if (p.id !== "buyerViewer") {
      await step(p.id + " direct own RFQ detail", async () => {
        const body = await navigate(page, "/rfq-hub/" + p.rfq);
        assert.ok(body.includes(p.rfqTitle));
      });
    }
    await step(p.id + " cannot access buyer's other private RFQ", async () => {
      const target = personas.find(other => other.org !== p.org);
      const response = await page.goto(base + "/rfq-hub/" + target.rfq, {
        waitUntil: "domcontentloaded", timeout: 90000,
      });
      // Wait for the streaming Server Component result, not the temporary
      // workspace loading shell (which returns HTTP 200 before notFound()).
      await page.waitForFunction(
        (title) => {
          const text = document.body.innerText;
          return !text.includes("Caricamento workspace") &&
            (text.includes(title) || /404|non trovata|not found|could not be found/i.test(text));
        },
        target.rfqTitle,
        { timeout: 60000 },
      );
      const body = await page.locator("body").innerText();
      // Next.js App Router may stream notFound() after response headers were sent,
      // returning HTTP 200 with the rendered 404. Treat only explicit not-found
      // content as denial; never let a 200 page containing a private title pass.
      assert.ok(!body.includes(target.rfqTitle), "Cross-tenant RFQ title leaked");
      const isNotFound = /404|non trovata|not found|could not be found/i.test(body);
      assert.ok(
        response.status() === 404 || (response.status() === 200 && isNotFound),
        "Cross-tenant direct URL must render a real 404 denial; HTTP " +
          response.status() + ", body=" + body.slice(0, 300),
      );
    });

    await step(p.id + " Marketplace access in own session", async () => {
      await navigate(page, "/marketplace");
      await page.getByRole("heading", { name: "Compra o vendi, in un unico spazio" })
        .waitFor({ state: "visible", timeout: 60000 });
      const body = await page.locator("body").innerText();
      assert.ok(body.includes("Marketplace"));
      assert.ok(!body.includes("DEMOTEST23 BUYER PRIVATE MIXED EN10210 EN10219"), "Private RFQ leaked in Marketplace");
    });

    await step(p.id + " cannot open Platform administration", async () => {
      await page.goto(base + "/platform", { waitUntil: "domcontentloaded", timeout: 90000 });
      const current = new URL(page.url());
      assert.notEqual(current.pathname, "/platform", "Non-platform organization acquired admin console");
      const body = await page.locator("body").innerText();
      assert.ok(!body.includes("Amministrazione Smart Steel Sales"), "Platform admin console leaked");
    });

    await context.close();
  }

  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 }, isMobile: true,
    deviceScaleFactor: 2, locale: "it-IT",
  });
  const mobilePage = await mobile.newPage();
  await step("mobile Chrome actual buyer login and workspace", () => login(mobilePage, personas[0]));
  for (const route of ["/dashboard", "/rfq-hub", "/marketplace"]) {
    await step("mobile responsive " + route, async () => {
      const body = await navigate(mobilePage, route);
      assert.ok(body.length > 50);
      const { width, scrollWidth } = await mobilePage.evaluate(() => ({
        width: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
      }));
      assert.ok(scrollWidth <= width + 12, route + " horizontal overflow " + scrollWidth + " > " + width);
    });
  }
  await mobile.close();

  console.log("DEMOTEST2.3 CHROME PASS", checks.length, "browser checks; 5 REAL GoTrue sessions; 4 companies; no production data");
} finally {
  await browser.close();
}
