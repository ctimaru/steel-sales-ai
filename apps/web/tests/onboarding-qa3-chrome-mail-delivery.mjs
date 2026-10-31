/**
 * ONBOARDING-QA3.A — real local GoTrue → Mailpit → independent Chrome browser.
 * Local-only CI, no production email, no screenshots of private messages,
 * no real domains or tenant mutations. Do not log tokens, email bodies or URLs.
 */
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { chromium } from "playwright";

const BASE = "http://127.0.0.1:3000";
const AUTH = "http://127.0.0.1:54321";
const MAILPIT = "http://127.0.0.1:54324";
assert.equal(process.env.DEMOTEST23_WEB_URL, BASE);
assert.equal(process.env.NEXT_PUBLIC_SUPABASE_URL, AUTH);
assert.equal(process.env.FLOW1_LOCAL_PROVIDER, "true");
assert.ok(process.env.RUNNER_TEMP);
const browser = await chromium.launch({ channel: "chrome", headless: true });
const nonce = randomBytes(8).toString("hex");
let assertions = 0;

function pass(label) {
  assertions++;
  console.log("ONBOARDING-QA3 LOCAL PASS", label);
}
function uniqueAddress(locale) { return `qa3-${locale}-${nonce}@example.test`; }
const password = randomBytes(22).toString("base64url") + "Aa1!";

async function mailpitMessages() {
  const response = await fetch(MAILPIT + "/api/v1/messages", { signal: AbortSignal.timeout(8000) });
  assert.equal(response.status, 200, "local Mailpit must be available");
  const collection = await response.json();
  assert.ok(Array.isArray(collection.messages), "expected Mailpit v1 messages");
  return collection.messages;
}
function recipientMatches(message, target) {
  return (message.To ?? []).some(r =>
    String(r.Address ?? r.address ?? "").toLowerCase() === target.toLowerCase()
  );
}
async function receiveMail(target, subjectPart, previousIds = new Set()) {
  for (let attempt = 0; attempt < 40; attempt++) {
    const messages = await mailpitMessages();
    const message = messages.find(item =>
      recipientMatches(item, target) && !previousIds.has(item.ID) &&
      String(item.Subject ?? "").toLowerCase().includes(subjectPart.toLowerCase())
    );
    if (message) {
      const response = await fetch(MAILPIT + "/api/v1/message/" + encodeURIComponent(message.ID), {
        signal: AbortSignal.timeout(8000),
      });
      assert.equal(response.status, 200);
      const detail = await response.json();
      assert.ok(detail.HTML && typeof detail.HTML === "string", "expected branded HTML");
      return { id: message.ID, subject: message.Subject, html: detail.HTML };
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error("Mailpit did not capture expected " + subjectPart + " message");
}
function confirmationUrl(html, expectedType) {
  const candidates = [...html.matchAll(/href=["']([^"']+)["']/gi)]
    .map(match => match[1].replaceAll("&amp;", "&"));
  const links = candidates.filter(value => {
    try { return new URL(value).pathname === "/auth/confirm"; } catch { return false; }
  });
  const link = links.find(value => new URL(value).searchParams.get("type") === expectedType);
  assert.ok(link, "Expected " + expectedType + " token-hash action in branded email");
  const parsed = new URL(link);
  assert.equal(parsed.origin, BASE, "email CTA must target local app, never a remote host");
  assert.match(parsed.searchParams.get("token_hash") ?? "", /\S{12,}/);
  assert.equal(parsed.searchParams.get("type"), expectedType);
  return link;
}
async function chooseEssentialCookies(page) {
  const cookie = page.getByTestId("mobile-cookie-consent");
  if (await cookie.isVisible()) {
    await cookie.getByRole("button", {
      name: /essential cookies only|cookie necessari/i,
    }).first().click();
    await cookie.waitFor({ state: "hidden" });
  }
}
async function newContext(width = 390) {
  return browser.newContext({
    viewport: { width, height: width === 390 ? 844 : 900 },
    locale: "it-IT", serviceWorkers: "block",
    reducedMotion: "reduce",
  });
}

try {
  // Verify local delivery is available before making any account changes.
  await mailpitMessages();
  pass("Mailpit local capture ready");

  for (const locale of ["it", "en"]) {
    const en = locale === "en";
    const email = uniqueAddress(locale);
    const register = en ? "/en/register" : "/register";
    const verify = en ? "/en/verify-email" : "/verify-email";
    const destination = en ? "/en/distinta" : "/rfq-hub/distinta";
    const next = register + "?return_to=" + encodeURIComponent(destination);
    const fresh = await newContext(390);
    let confirmed;
    try {
      const page = await fresh.newPage();
      await page.goto(BASE + next, { waitUntil: "domcontentloaded", timeout: 90000 });
      await chooseEssentialCookies(page);
      await page.locator('input[name="email"]').fill(email);
      await page.locator('input[name="password"]').fill(password);
      await page.getByRole("button", {
        name: en ? "Create account" : "Crea account", exact: true,
      }).click();
      await page.waitForURL(u => u.pathname === verify, { timeout: 60000 });
      assert.equal(new URL(page.url()).searchParams.get("next"), next);
      pass(locale + " signup remains gated on unverified email");

      const mail = await receiveMail(email, "Conferma");
      assert.match(mail.html, /Smart Steel Sales/);
      const link = confirmationUrl(mail.html, "email");
      // GoTrue supplies the registered redirect as part of the template; it
      // MUST contain the original safe commercial return, not private draft data.
      const redir = new URL(link).searchParams.get("redirect_to");
      assert.ok(redir, "GoTrue email RedirectTo is missing");
      const callback = new URL(redir);
      assert.equal(callback.origin, BASE);
      assert.equal(callback.pathname, "/auth/finish");
      assert.equal(callback.searchParams.get("next"), next);
      assert.ok(!link.includes("customer=") && !link.includes("price="));
      pass(locale + " branded confirmation email preserves safe commercial next");

      // Cross-context confirmation: independent cookies/device, no pending
      // email cookie and no signup session in this browser.
      confirmed = await newContext(390);
      const otherBrowser = await confirmed.newPage();
      await otherBrowser.goto(link, { waitUntil: "domcontentloaded", timeout: 90000 });
      await otherBrowser.waitForURL(u => u.pathname === register, { timeout: 45000 });
      assert.equal(new URL(otherBrowser.url()).searchParams.get("return_to"), destination);
      const application = otherBrowser.locator("#company-form");
      await application.waitFor({ state: "visible", timeout: 45000 });
      assert.equal(await otherBrowser.locator('input[name="return_to"]').inputValue(), destination);
      assert.equal(await otherBrowser.locator('input[name="company_query"]').count(), 1);
      pass(locale + " cross-browser confirmation reaches company application only");

      // One-time semantics. Opening the same link on a third unauthenticated
      // browser cannot grant access even if the preceding user is confirmed.
      const replay = await newContext();
      try {
        const replayPage = await replay.newPage();
        await replayPage.goto(link, { waitUntil: "domcontentloaded" });
        await replayPage.waitForURL(u => u.pathname === verify, { timeout: 20000 });
        assert.ok(new URL(replayPage.url()).searchParams.get("error"));
        pass(locale + " consumed confirmation token rejected");
      } finally { await replay.close(); }

      // Existing user cannot bypass company approval by typing a private URL.
      await otherBrowser.goto(BASE + "/rfq-hub/distinta", { waitUntil: "domcontentloaded" });
      await otherBrowser.waitForURL(u => u.pathname !== "/rfq-hub/distinta", { timeout: 20000 });
      assert.ok(["/register", "/registration/status", "/login", "/en/register"].includes(new URL(otherBrowser.url()).pathname),
        "Unapproved user must not reach private RFQ");
      pass(locale + " unapproved user denied private RFQ");
    } finally {
      await fresh.close();
      await confirmed?.close();
    }
  }

  // Recovery: send to local Mailpit, redeem on separate browser, change
  // password and prove old password no longer works.
  const email = uniqueAddress("it");
  const before = new Set((await mailpitMessages()).map(row => row.ID));
  const ctx = await newContext();
  try {
    const p = await ctx.newPage();
    await p.goto(BASE + "/forgot-password", { waitUntil: "domcontentloaded" });
    await p.locator('input[name="email"]').fill(email);
    await p.getByRole("button", { name: "Invia link di recupero" }).click();
    await p.waitForURL(u => u.pathname === "/forgot-password" &&
      u.searchParams.has("message"), { timeout: 30000 });
    const recovery = await receiveMail(email, "Reimposta", before);
    const link = confirmationUrl(recovery.html, "recovery");
    const resetCtx = await newContext();
    try {
      const resetPage = await resetCtx.newPage();
      await resetPage.goto(link, { waitUntil: "domcontentloaded" });
      await resetPage.waitForURL(u => u.pathname === "/reset-password", { timeout: 25000 });
      const newer = randomBytes(24).toString("base64url") + "Xy1!";
      await resetPage.locator('input[name="password"]').fill(newer);
      await resetPage.locator('input[name="confirmation"]').fill(newer);
      await resetPage.getByRole("button", { name: "Aggiorna password" }).click();
      await resetPage.waitForURL(u => u.pathname === "/login", { timeout: 30000 });
      pass("recovery email redeemed cross-browser and password reset");

      await resetPage.locator('input[name="email"]').fill(email);
      await resetPage.locator('input[name="password"]').fill(password);
      await resetPage.getByRole("button", { name: "Accedi", exact: true }).click();
      await resetPage.waitForURL(u => u.pathname === "/login" && u.searchParams.has("error"), { timeout: 30000 });
      pass("previous password rejected after recovery");

      await resetPage.locator('input[name="email"]').fill(email);
      await resetPage.locator('input[name="password"]').fill(newer);
      await resetPage.getByRole("button", { name: "Accedi", exact: true }).click();
      await resetPage.waitForURL(u => u.pathname === "/register" || u.pathname === "/registration/status", { timeout: 30000 });
      pass("new password accepted, with company governance still enforced");
    } finally { await resetCtx.close(); }
  } finally { await ctx.close(); }
} finally {
  await browser.close();
}
assert.equal(assertions, 16);
console.log("ONBOARDING-QA3 LOCAL MAIL DELIVERY E2E PASS", assertions, "checks (no production email or tenants)");
