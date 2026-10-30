/**
 * ONBOARDING-UX2 — browser visual acceptance of signup-first guest registration.
 * Read-only, localhost-only. No signup POST, no real users or emails.
 */
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const BASE = process.env.NEXT_PUBLIC_SITE_URL;
assert.equal(BASE, "http://127.0.0.1:3000", "Chrome UX2 must use local Next.js only");
const folder = "/tmp/onboarding-ux2";
mkdirSync(folder, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
let checked = 0;

async function noOverflow(page, label) {
  const sizes = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  assert.ok(sizes.content <= sizes.viewport + 8, label + " horizontal overflow: " + JSON.stringify(sizes));
}

try {
  for (const width of [320, 390, 1440]) {
    for (const locale of ["it", "en"]) {
      const english = locale === "en";
      const pathname = english ? "/en/register" : "/register";
      const destination = english ? "/en/distinta" : "/rfq-hub/distinta";
      const height = width === 320 ? 720 : width === 390 ? 844 : 900;
      const ctx = await browser.newContext({
        viewport: { width, height }, locale: english ? "en-GB" : "it-IT",
        hasTouch: width < 768, isMobile: width < 768, reducedMotion: "reduce",
      });
      const page = await ctx.newPage();
      try {
        const resp = await page.goto(BASE + pathname + "?return_to=" +
          encodeURIComponent(destination), { waitUntil: "domcontentloaded", timeout: 90000 });
        assert.equal(resp?.status(), 200);
        const card = page.getByTestId("onboarding-ux2-account");
        const lookup = page.locator("#company-check").or(page.getByText("Company lookup · Optional for now").first());
        await card.waitFor({ state: "visible", timeout: 25000 });
        const email = card.locator('input[name="email"]');
        const password = card.locator('input[name="password"]');
        const signup = card.getByRole("button", { name: english ? "Create account" : "Crea account", exact: true });
        assert.equal(await email.count(), 1, "Email input missing");
        assert.equal(await password.count(), 1, "Password input missing");
        assert.equal(await signup.count(), 1, "One explicit signup CTA required");
        assert.equal(await card.locator('form input[name="next"]').inputValue(),
          pathname + "?return_to=" + encodeURIComponent(destination));
        assert.equal(await page.locator('input[name="company_query"]').count(), 1,
          "Governed company lookup must remain available");
        assert.ok(await lookup.count() > 0);
        const [cardBox, emailBox, signupBox, companyBox] = await Promise.all(
          [card, email, signup, english
            ? page.getByText("Company lookup · Optional for now").first()
            : page.locator("#company-check")].map(node => node.boundingBox())
        );
        assert.ok(cardBox && emailBox && signupBox && companyBox);
        console.log("ONBOARDING-UX2 FIRST VIEWPORT", locale, width, {
          accountY: Math.round(cardBox.y),
          emailY: Math.round(emailBox.y),
          ctaBottom: Math.round(signupBox.y + signupBox.height),
          companyY: Math.round(companyBox.y),
          height,
        });
        await page.screenshot({
          path: path.join(folder, `register-${locale}-${width}.png`),
          fullPage: false, animations: "disabled",
        });
        assert.ok(cardBox.y < companyBox.y || width === 1440,
          "Account must come before optional lookup on mobile");
        assert.ok(emailBox.y < height * 0.68,
          "Email field must be in first viewport: " + locale + "/" + width + " y=" + emailBox.y);
        assert.ok(signupBox.y + signupBox.height <= height + 12,
          "Signup CTA must fit first viewport: " + locale + "/" + width +
          " bottom=" + (signupBox.y + signupBox.height));
        await noOverflow(page, locale + "/" + width);
        const cookie = page.getByTestId("mobile-cookie-consent");
        if (await cookie.isVisible()) {
          await cookie.getByRole("button", { name: /essential cookies only|cookie necessari/i }).first().click();
          await cookie.waitFor({ state: "hidden" });
        }
        await email.fill("synthetic@example.test");
        assert.equal(await email.inputValue(), "synthetic@example.test");
        await page.screenshot({
          path: path.join(folder, `register-${locale}-${width}.png`),
          fullPage: false, animations: "disabled",
        });
        checked++;
        console.log("ONBOARDING-UX2 CHROME PASS", locale, width,
          "emailY=" + Math.round(emailBox.y), "ctaBottom=" + Math.round(signupBox.y + signupBox.height));
        // A claim URL must retain the claim reference AND the commercial destination.
        if (width === 390) {
          const claim = "a".repeat(64);
          await page.goto(BASE + pathname + "?claim_ref=" + claim + "&return_to=" +
            encodeURIComponent(destination), { waitUntil: "domcontentloaded" });
          assert.equal(await page.locator("form input[name=next]").inputValue(),
            pathname + "?claim_ref=" + claim + "&return_to=" + encodeURIComponent(destination));
          assert.ok(await page.getByText(english ? "Company profile selected" : "Profilo selezionato").count() > 0);
          checked++;
          console.log("ONBOARDING-UX2 CLAIM PASS", locale, width);
        }
      } finally {
        await ctx.close();
      }
    }
  }
} finally { await browser.close(); }
assert.equal(checked, 8);
console.log("ONBOARDING-UX2 CHROME ACCEPTANCE PASS", checked, "checks; no writes or account creation");
