/**
 * ONBOARDING-UX1 — real Chrome + 5 existing local GoTrue personas plus an
 * ephemeral account with no company. Uses only FLOW1's disposable Supabase.
 * No production access, provider delivery, private screenshots or RFQ dispatch.
 */
import assert from "node:assert/strict";
import { mkdirSync, readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";

const BASE = process.env.DEMOTEST23_WEB_URL;
assert.equal(BASE, "http://127.0.0.1:3000");
assert.equal(process.env.NEXT_PUBLIC_SUPABASE_URL, "http://127.0.0.1:54321");
assert.equal(process.env.FLOW1_LOCAL_PROVIDER, "true");
const secret = process.env.DEMOTEST23_LOCAL_SERVICE_ROLE_KEY;
assert.ok(secret?.length > 20 && process.env.RUNNER_TEMP);
const output = path.join(process.env.RUNNER_TEMP, "onboarding-ux1-visual");
mkdirSync(output, { recursive: true });
const personas = JSON.parse(readFileSync(path.join(process.env.RUNNER_TEMP, "demotest23-personas.json"), "utf8"));
const buyer = personas.find(p => p.id === "buyer");
const viewer = personas.find(p => p.id === "buyerViewer");
assert.ok(buyer && viewer);
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, secret, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const browser = await chromium.launch({ channel: "chrome", headless: true });
let freshId = null, checks = 0;

async function widthGuard(page, label) {
  const dims = await page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  if (dims.scroll > dims.client + 12) {
    const offenders = await page.evaluate(() =>
      Array.from(document.querySelectorAll("body *"))
        .map(el => ({ element: el, rect: el.getBoundingClientRect() }))
        .filter(row => row.rect.width > 0 && row.rect.right > document.documentElement.clientWidth + 3)
        .sort((a, b) => b.rect.right - a.rect.right)
        .slice(0, 12)
        .map(({ element, rect }) => ({
          tag: element.tagName.toLowerCase(),
          class: String(element.className || "").slice(0, 130),
          right: Math.round(rect.right),
          width: Math.round(rect.width),
          text: String(element.textContent || "").trim().slice(0, 55),
        }))
    );
    console.error("ONBOARDING-UX1 MOBILE OVERFLOW DIAGNOSTIC", label, JSON.stringify(offenders));
  }
  assert.ok(dims.scroll <= dims.client + 12, label + " overflows: " + JSON.stringify(dims));
  checks++;
}
async function login(page, person, destination) {
  await page.goto(BASE + "/login?next=" + encodeURIComponent(destination), { waitUntil: "domcontentloaded" });
  await page.locator('input[name="email"]').fill(person.email);
  await page.locator('input[name="password"]').fill(person.password);
  await page.getByRole("button", { name: "Accedi", exact: true }).click();
}
async function publicChecks(width, language) {
  const isEnglish = language === "en";
  const locale = isEnglish ? "en-GB" : "it-IT";
  const root = isEnglish ? "/en" : "/";
  const loginPath = isEnglish ? "/en/login" : "/login";
  const registerPath = isEnglish ? "/en/register" : "/register";
  const destination = isEnglish ? "/en/distinta" : "/rfq-hub/distinta";
  const context = await browser.newContext({
    viewport: { width, height: width === 1440 ? 900 : width === 390 ? 844 : 720 },
    isMobile: width < 768, hasTouch: width < 768,
    locale, reducedMotion: "reduce", serviceWorkers: "block",
  });
  const page = await context.newPage();
  try {
    const home = await page.goto(BASE + root, { waitUntil: "domcontentloaded", timeout: 90000 });
    assert.equal(home?.status(), 200);
    const nav = page.locator("header").first().getByRole("navigation", {
      name: isEnglish ? "Company account" : "Area aziende",
    });
    assert.equal(await nav.count(), 1);
    for (const [href, name] of [[loginPath, isEnglish ? "Sign in" : "Accedi"],
                                [registerPath, isEnglish ? "Register" : "Registrati"]]) {
      const button = nav.getByRole("link", { name, exact: true });
      assert.equal(await button.getAttribute("href"), href);
      const bounds = await button.boundingBox();
      assert.ok(bounds && bounds.height >= 40 && bounds.x >= 0 &&
        bounds.x + bounds.width <= width + 1, width + " clipped account link " + name);
      const ink = await button.evaluate(el => ({
        computed: getComputedStyle(el).color,
        webkit: getComputedStyle(el).webkitTextFillColor,
      }));
      if (href === registerPath) {
        assert.equal(ink.computed, "rgb(17, 81, 58)", "Register CTA text must be dark green");
        assert.equal(ink.webkit, "rgb(17, 81, 58)", "WebKit must not inherit white text");
      }
      checks++;
    }
    await widthGuard(page, width + root + " homepage");
    await page.screenshot({ path: path.join(output, `home-${language}-${width}.png`),
      fullPage: false, animations: "disabled" });
    // Only public header screenshots are emitted as base64 for visual audit.
    if (language === "it" && (width === 320 || width === 1440)) {
      const jpeg = await page.screenshot({ type: "jpeg", quality: 57,
        clip: { x: 0, y: 0, width, height: 135 }, animations: "disabled" });
      console.log("ONBOARDING_UX1_PUBLIC_HEADER_JPEG_" + width + "=" + jpeg.toString("base64"));
    }

    await page.goto(BASE + loginPath + "?next=" + encodeURIComponent(destination), {
      waitUntil: "domcontentloaded", timeout: 90000,
    });
    const formNext = await page.locator('form input[name="next"]').inputValue();
    assert.equal(formNext, destination);
    const registerLink = page.getByRole("link", {
      name: isEnglish ? "Register in English" : "Crea account",
    });
    const expectedReturn = registerPath + "?return_to=" + encodeURIComponent(destination);
    assert.equal(await registerLink.getAttribute("href"), expectedReturn);
    await widthGuard(page, width + loginPath);
    await page.screenshot({ path: path.join(output, `login-${language}-${width}.png`),
      fullPage: false, animations: "disabled" });
    // Exercise a real first-visit essential-cookie choice instead of forcing
    // clicks through the fixed consent panel on a 320px viewport.
    const consentPanel = page.getByTestId("mobile-cookie-consent");
    if (await consentPanel.isVisible()) {
      await consentPanel.getByRole("button", {
        name: /essential cookies only|cookie necessari/i,
      }).first().click();
      await consentPanel.waitFor({ state: "hidden", timeout: 10000 });
    }
    await registerLink.click();
    await page.waitForURL(url => url.pathname === registerPath, { timeout: 30000 });
    assert.equal(new URL(page.url()).searchParams.get("return_to"), destination);
    const signupNext = await page.locator('form input[name="next"]').inputValue();
    assert.equal(signupNext, expectedReturn);
    assert.ok(await page.locator('input[name="company_query"]').count() > 0,
      "Existing company precheck must remain");
    await widthGuard(page, width + registerPath);
    await page.screenshot({ path: path.join(output, `register-${language}-${width}.png`),
      fullPage: false, animations: "disabled" });
    console.log("ONBOARDING-UX1 ANONYMOUS CHROME PASS", width, language,
      "direct CTA, login/register handoff, existing company precheck");
  } finally {
    await context.close();
  }
}

try {
  for (const width of [320, 390, 1440]) {
    for (const language of ["it", "en"]) {
      await publicChecks(width, language);
    }
  }
  // Real approved GoTrue authentication from an RFQ landing destination.
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "it-IT" });
    const page = await ctx.newPage();
    try {
      await login(page, buyer, "/rfq-hub/distinta");
      await page.waitForURL(u => u.pathname === "/rfq-hub/distinta", { timeout: 90000 });
      assert.ok(await page.locator("body").innerText({ timeout: 60000 }));
      await widthGuard(page, "approved owner RFQ return");
      checks++;
      console.log("ONBOARDING-UX1 AUTH PASS approved company owner resumes private RFQ");
    } finally { await ctx.close(); }
  }
  // A user with no active company must remain at registration, never RFQ.
  const password = randomBytes(24).toString("base64url") + "Aa1!";
  const created = await admin.auth.admin.createUser({
    email: "onboarding-ux1-unaffiliated@example.test", password, email_confirm: true,
  });
  assert.ifError(created.error);
  assert.ok(created.data?.user?.id);
  freshId = created.data.user.id;
  {
    const ctx = await browser.newContext({ viewport: { width: 320, height: 720 }, locale: "it-IT" });
    const page = await ctx.newPage();
    try {
      await login(page, { email: "onboarding-ux1-unaffiliated@example.test", password }, "/rfq-hub/distinta");
      await page.waitForURL(u => u.pathname === "/register", { timeout: 90000 });
      assert.equal(new URL(page.url()).searchParams.get("return_to"), "/rfq-hub/distinta");
      // This user is already authenticated: /register renders the company
      // application, NOT the anonymous account-signup form.
      assert.equal(await page.locator('input[name="return_to"]').inputValue(),
        "/rfq-hub/distinta");
      assert.ok(await page.getByRole("heading", { name: /Raccontaci chi siete|Aggiorna la richiesta aziendale/ }).count() > 0,
        "User without membership must complete a company application");
      assert.ok(!(await page.locator("body").innerText()).includes("RFQ privata attiva"));
      await widthGuard(page, "unaffiliated user blocked");
      checks++;
      console.log("ONBOARDING-UX1 AUTH PASS unapproved company cannot reach private RFQ");
    } finally { await ctx.close(); }
  }
  console.log("ONBOARDING-UX1 CHROME SUCCESS", checks,
    "public and real local GoTrue checks across 320/390/1440 IT/EN");
} finally {
  if (freshId) await admin.auth.admin.deleteUser(freshId);
  await browser.close();
}
