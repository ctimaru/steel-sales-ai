/**
 * COMM-UX1 — real Chrome authenticated navigation and density acceptance.
 * Restrict this test to local throwaway Supabase + Next. No provider calls,
 * external host, production identity or unreviewed user data are permitted.
 */
import assert from "node:assert/strict";
import { readFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const base = (process.env.DEMOTEST23_WEB_URL ?? "").replace(/\/$/, "");
assert.equal(base, "http://127.0.0.1:3000", "Only throwaway local Next allowed");
const temp = process.env.RUNNER_TEMP;
assert.ok(temp, "CI ephemeral runner directory required");
const personas = JSON.parse(readFileSync(path.join(temp, "demotest23-personas.json"), "utf8"));
assert.equal(personas.length, 5);
const screenshotsDir = path.join(temp, "comm-ux1-safe-screenshots");
mkdirSync(screenshotsDir, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });

async function open(page, route) {
  const result = await page.goto(base + route, { waitUntil: "domcontentloaded", timeout: 90000 });
  assert.equal(result?.status(), 200, route + " must be reachable");
  const mobile = (page.viewportSize()?.width ?? 1440) < 1280;
  if (mobile) {
    const dropdown = page.getByTestId("commercial-director-mobile");
    await dropdown.waitFor({ state: "visible", timeout: 60000 });
    await dropdown.locator("summary").first().click();
  }
  const nav = page.getByRole("navigation", {
    name: mobile ? "Menu Commerciale mobile" : "Menu Commerciale", exact: true
  });
  await nav.waitFor({ state: "visible", timeout: 60000 });
  return nav;
}
async function signIn(page, persona) {
  await page.goto(base + "/login", { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.locator('input[name="email"]').fill(persona.email);
  await page.locator('input[name="password"]').fill(persona.password);
  await page.getByRole("button", { name: "Accedi", exact: true }).click();
  await page.waitForURL(u => u.pathname === "/dashboard", { timeout: 90000 });
  await page.getByRole("heading", { name: "Oggi in " + persona.name, exact: true })
    .waitFor({ state: "visible", timeout: 60000 });
}
async function verifyArea(page, route, selected) {
  const nav = await open(page, route);
  const current = nav.getByRole("link", { name: selected, exact: true });
  await current.waitFor({ state: "visible" });
  assert.equal(await current.getAttribute("aria-current"), "page", route + ": " + selected);
  assert.equal(await page.getByRole("navigation", { name: "Sezioni Commerciale" }).count(), 0,
    "The old three-tab bar must not duplicate the director menu");
  const mobile = (page.viewportSize()?.width ?? 1440) < 1280;
  if (mobile) {
    await page.getByTestId("commercial-director-mobile").locator("summary").first().click();
  }
  return nav;
}
async function noHorizontalPageOverflow(page, label) {
  const sizes = await page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  assert.ok(sizes.scroll <= sizes.client + 12,
    label + " horizontal overflow " + sizes.scroll + " > " + sizes.client);
}

// COMM-CINE16: computed-browser visual acceptance on local, synthetic account data only.
async function verifyCinematic(page, label) {
  const hero = page.getByTestId("comm-cine1-hero");
  const companion = page.getByTestId("commercial-ai-first");
  const worklist = page.getByTestId("comm-cine2-deal-cockpit");
  assert.equal(await hero.count(), 1, label + ": one industrial hero");
  assert.equal(await companion.count(), 1, label + ": one AI companion");
  assert.equal(await worklist.count(), 1, label + ": one worklist");
  // A streamed server page can expose hero/worklist containers before its
  // heading joins the accessibility tree. Wait for the actual accessible title.
  const heroHeading=hero.getByRole("heading",{level:1});
  try { await heroHeading.waitFor({state:"visible",timeout:30000}); }
  catch(err) {
    const state=await hero.evaluate(el=>({
      headings:[...el.querySelectorAll("h1,h2")].map(h=>({
        tag:h.tagName,hidden:h.getAttribute("aria-hidden"),
        display:getComputedStyle(h).display,visibility:getComputedStyle(h).visibility,
        text:h.textContent?.slice(0,120)})),
      hiddenAncestors:[...document.querySelectorAll("[aria-hidden='true'],[inert]")]
        .filter(h=>h.contains(el)).map(h=>h.tagName+"#"+h.id).slice(0,6)
    }));
    throw new Error("Commerciale hero heading accessibility not ready: "+JSON.stringify(state),{cause:err});
  }
  assert.equal(await heroHeading.count(),1);
  assert.equal(await companion.getByRole("heading", { name: "Ciao, cosa stai cercando oggi?" }).count(), 1);
  assert.equal(await hero.locator("dt").count(), 3, label + ": three accessible real-data counters");
  const background = await hero.evaluate(el => getComputedStyle(el, "::before").backgroundImage);
  assert.match(background, /home-cine2a2b-factory-(desktop|mobile)\.webp/, label + ": factory poster is rendered");
  const bounds = await Promise.all([hero.boundingBox(), companion.boundingBox(), worklist.boundingBox()]);
  assert.ok(bounds.every(Boolean), label + ": all core surfaces must render");
  assert.ok(bounds[0].y < bounds[1].y && bounds[1].y < bounds[2].y, label + ": cinematic content must precede deals");
  await noHorizontalPageOverflow(page, label);
}

try {
  // Exactly five real GoTrue sessions: one viewer and four independent tenants.
  for (const p of personas) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "it-IT" });
    const page = await context.newPage();
    try {
      await signIn(page, p);
      await verifyArea(page, "/commercial", "Cruscotto");
      await verifyCinematic(page, "Commerciale desktop " + p.id);
      await page.getByRole("heading", { name: "Le mie trattative" })
        .waitFor({ state: "visible", timeout: 60000 });
      assert.equal(await page.locator('[data-testid="commercial-compact-actions"]').count(), 1);
      assert.equal(await page.locator('[data-testid="commercial-compact-attention"]').count(), 1);
      assert.equal(await page.locator('[data-testid="commercial-compact-filters"]').count(), 1);
      assert.equal(await page.locator('#commercial-worklist').count(), 1);
      assert.equal(await page.locator('#commercial-worklist input[name="q"]').count(), 1);
      // A11Y: real computed color AND WebKit text fill must be white on solid brand.
      const selectedFilter = page.getByRole("navigation", { name: "Filtra attività commerciali" })
        .getByRole("link", { name: "Tutte", exact: true });
      const selectedColors = await selectedFilter.evaluate(el => ({
        color: getComputedStyle(el).color, fill: getComputedStyle(el).webkitTextFillColor,
      }));
      assert.equal(selectedColors.color, "rgb(255, 255, 255)", "Active filter must be white on green");
      assert.equal(selectedColors.fill, "rgb(255, 255, 255)", "Active filter WebKit fill must be white");
      const rowArea = page.locator('[data-testid="commercial-list-pane"]');
      await rowArea.waitFor({ state: "visible", timeout: 60000 });
      assert.equal(await rowArea.locator(".max-h-\\[520px\\]").count(), 0,
        "Nested 520px worklist scroller must be removed");
      const actions = page.locator('[data-testid="commercial-compact-actions"]');
      const actionsRect = await actions.boundingBox();
      const listRect = await page.locator("#commercial-worklist").boundingBox();
      assert.ok(actionsRect && listRect && listRect.y > actionsRect.y,
        "Compact action strip precedes worklist");
      assert.ok(actionsRect.height < 220, "Desktop action strip must remain compact");
      const companion = page.getByTestId("commercial-ai-first");
      assert.equal(await companion.count(), 1, "One cinematic AI companion, never duplicated");
      const aiPrompt = companion.getByTestId("comm-cine11-prompt");
      if (p.id === "buyerViewer") {
        assert.equal(await aiPrompt.count(), 0, "Viewer must not gain RFQ compose access");
      } else {
        assert.equal(await aiPrompt.count(), 1, "Writer gets exactly one AI intake form");
        const create = companion.getByRole("button", { name: /Prepara la distinta/ });
        assert.equal(await create.count(), 1, "One primary create action must be offered to writers");
        const colors = await create.evaluate(el => ({
          color: getComputedStyle(el).color, fill: getComputedStyle(el).webkitTextFillColor,
        }));
        assert.equal(colors.color, "rgb(255, 255, 255)", "Solid create CTA must have white text");
        assert.equal(colors.fill, "rgb(255, 255, 255)", "Solid create CTA WebKit fill must be white");
      }
      assert.equal(await page.getByRole("link", { name: "+ Nuova distinta" }).count(), 0,
        "Duplicate create action must not return");
      for (const other of personas) {
        if (other.org !== p.org) {
          assert.ok(!(await rowArea.innerText()).includes(other.rfqTitle),
            "Cross-company RFQ revealed in commercial list");
        }
      }
      console.log("COMM-UX1 PASS desktop navigation, compact layout and tenant:", p.id);
      if (p.id === "buyer") {
        await page.screenshot({ path: path.join(screenshotsDir, "commercial-owner-desktop.png"),
          fullPage: false, animations: "disabled" });
        await page.locator("#commercial-worklist").scrollIntoViewIfNeeded();
        await page.screenshot({ path: path.join(screenshotsDir, "commercial-owner-deals-desktop.png"),
          fullPage: false, animations: "disabled" });
      }
      // Every specialist page retains a correctly highlighted area.
      await verifyArea(page, "/commercial/analysis", "Analisi commerciale");
      await page.getByRole("heading", { name: "Analisi per decidere" })
        .waitFor({ state: "visible", timeout: 60000 });
      assert.equal(await page.getByRole("link", { name: /Product 360/ }).count(), 1);
      assert.equal(await page.getByRole("link", { name: /Storico prezzi/ }).count(), 1);
      await verifyArea(page, "/commercial/companies", "Aziende");
      await verifyArea(page, "/rfq-hub", "Centro RFQ");
      await verifyArea(page, "/commercial/products", "Prodotti");
      if (p.id === "buyer" || p.id === "buyerViewer") {
        await verifyArea(page, "/commercial/search", "Ricerca nello storico");
        await verifyArea(page, "/commercial/assistant", "Assistente AI privato");
        const other = personas.find(person => person.org !== p.org);
        const nav = await open(page, "/commercial?item=campaign:" + other.rfq);
        assert.equal(await nav.getByRole("link", { name: "Cruscotto" }).getAttribute("aria-current"), "page");
        assert.ok(!(await page.locator("body").innerText()).includes(other.rfqTitle),
          "Cross-tenant campaign deep link exposed content");
      }
      console.log("COMM-UX1 PASS specialist deep links:", p.id);
    } finally {
      await context.close();
    }
  }

  // True mobile viewport with login and main worklist; no screenshot of credentials.
  for (const id of ["buyer", "buyerViewer"]) {
    const p = personas.find(person => person.id === id);
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 }, isMobile: true, deviceScaleFactor: 2, locale: "it-IT"
    });
    const page = await context.newPage();
    try {
      await signIn(page, p);
      await verifyArea(page, "/commercial", "Cruscotto");
      await page.getByRole("heading", { name: "Le mie trattative" })
        .waitFor({ state: "visible", timeout: 60000 });
      await noHorizontalPageOverflow(page, "Commerciale 390px " + id);
      await verifyCinematic(page, "Commerciale mobile 390px " + id);
      if (id === "buyer") {
        await open(page, "/commercial");
        await noHorizontalPageOverflow(page, "Director menu open at 390px");
        await page.screenshot({ path: path.join(screenshotsDir, "commercial-director-mobile-menu-open.png"),
          fullPage: false, animations: "disabled" });
        await page.getByTestId("commercial-director-mobile").locator("summary").first().click();
      }
      assert.equal(await page.locator('[data-testid="commercial-compact-filters"]').count(), 1);
      const f = page.locator("#commercial-worklist");
      assert.equal(await f.getByRole("searchbox").count(), 1);
      const mobileMenu = await open(page, "/commercial");
      await mobileMenu.locator("summary").filter({ hasText: "Analisi e opportunità" }).click();
      await mobileMenu.getByRole("link", { name: "Analisi commerciale", exact: true }).click();
      await page.waitForURL(u => u.pathname === "/commercial/analysis", { timeout: 60000 });
      await verifyArea(page, "/commercial/analysis", "Analisi commerciale");
      await noHorizontalPageOverflow(page, "Analisi 390px " + id);
      await page.goto(base + "/commercial", { waitUntil: "domcontentloaded" });
      if (id === "buyerViewer") {
        assert.equal(await page.getByTestId("comm-cine11-prompt").count(), 0);
      } else {
        assert.equal(await page.getByTestId("comm-cine11-prompt").count(), 1);
      }
      await page.screenshot({ path: path.join(screenshotsDir, "commercial-" + id + "-mobile.png"),
        fullPage: false, animations: "disabled" });
      console.log("COMM-UX1 PASS mobile 390px nav, search, roles:", id);
    } finally {
      await context.close();
    }
  }
  // Narrowest supported mobile: ensure the industrial hero and AI form do not overflow.
  const buyer = personas.find(person => person.id === "buyer");
  const narrow = await browser.newContext({
    viewport: { width: 320, height: 720 }, isMobile: true,
    deviceScaleFactor: 2, locale: "it-IT", reducedMotion: "reduce",
  });
  try {
    const page = await narrow.newPage();
    await signIn(page, buyer);
    await page.goto(base + "/commercial", { waitUntil: "domcontentloaded" });
    await verifyCinematic(page, "Commerciale mobile 320px buyer");
    await page.screenshot({ path: path.join(screenshotsDir, "commercial-owner-mobile-320.png"),
      fullPage: false, animations: "disabled" });
  } finally {
    await narrow.close();
  }
} finally {
  await browser.close();
}
console.log("COMM-UX1 AUTHENTICATED LOCAL ACCEPTANCE PASS");
