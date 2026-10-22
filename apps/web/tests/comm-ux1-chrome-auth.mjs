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
  const nav = page.getByRole("navigation", { name: "Sezioni Commerciale" });
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
  const links = nav.getByRole("link");
  assert.deepEqual(await links.allTextContents(), ["Attività", "Relazioni", "Analisi"], route);
  for (const label of ["Attività", "Relazioni", "Analisi"]) {
    const current = await nav.getByRole("link", { name: label, exact: true }).getAttribute("aria-current");
    assert.equal(current === "page", label === selected, route + " selection: " + label);
  }
  assert.equal(await nav.getByRole("link", { name: "RFQ e offerte" }).count(), 0);
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

try {
  // Exactly five real GoTrue sessions: one viewer and four independent tenants.
  for (const p of personas) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "it-IT" });
    const page = await context.newPage();
    try {
      await signIn(page, p);
      await verifyArea(page, "/commercial", "Attività");
      await page.getByRole("heading", { name: "Richieste, offerte e ordini" })
        .waitFor({ state: "visible", timeout: 60000 });
      assert.equal(await page.locator('[data-testid="commercial-compact-actions"]').count(), 1);
      assert.equal(await page.locator('[data-testid="commercial-compact-attention"]').count(), 1);
      assert.equal(await page.locator('[data-testid="commercial-compact-filters"]').count(), 1);
      assert.equal(await page.locator('#commercial-worklist').count(), 1);
      assert.equal(await page.locator('#commercial-worklist input[name="q"]').count(), 1);
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
      if (p.id === "buyerViewer") {
        assert.equal(await actions.getByRole("link", { name: /Nuova richiesta/ }).count(), 0,
          "Viewer must not gain a create action");
      } else {
        assert.equal(await actions.getByRole("link", { name: /Nuova richiesta/ }).count(), 1,
          "One primary CTA must be offered to writers");
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
      }
      // Every specialist page retains a correctly highlighted area.
      await verifyArea(page, "/commercial/analysis", "Analisi");
      await page.getByRole("heading", { name: "Analisi per decidere" })
        .waitFor({ state: "visible", timeout: 60000 });
      assert.equal(await page.getByRole("link", { name: /Product 360/ }).count(), 1);
      assert.equal(await page.getByRole("link", { name: /Storico prezzi/ }).count(), 1);
      await verifyArea(page, "/commercial/companies", "Relazioni");
      await verifyArea(page, "/rfq-hub", "Attività");
      await verifyArea(page, "/commercial/products", "Analisi");
      if (p.id === "buyer" || p.id === "buyerViewer") {
        await verifyArea(page, "/commercial/search", "Attività");
        await verifyArea(page, "/commercial/assistant", "Attività");
        const other = personas.find(person => person.org !== p.org);
        const nav = await open(page, "/commercial?item=campaign:" + other.rfq);
        assert.equal(await nav.getByRole("link", { name: "Attività" }).getAttribute("aria-current"), "page");
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
      const nav = await verifyArea(page, "/commercial", "Attività");
      await page.getByRole("heading", { name: "Richieste, offerte e ordini" })
        .waitFor({ state: "visible", timeout: 60000 });
      await noHorizontalPageOverflow(page, "Commerciale 390px " + id);
      assert.equal(await page.locator('[data-testid="commercial-compact-filters"]').count(), 1);
      const f = page.locator("#commercial-worklist");
      assert.equal(await f.getByRole("searchbox").count(), 1);
      await nav.getByRole("link", { name: "Analisi" }).click();
      await page.waitForURL(u => u.pathname === "/commercial/analysis", { timeout: 60000 });
      await verifyArea(page, "/commercial/analysis", "Analisi");
      await noHorizontalPageOverflow(page, "Analisi 390px " + id);
      await open(page, "/commercial");
      if (id === "buyerViewer") {
        assert.equal(await page.getByRole("link", { name: /Nuova richiesta/ }).count(), 0);
      }
      await page.screenshot({ path: path.join(screenshotsDir, "commercial-" + id + "-mobile.png"),
        fullPage: false, animations: "disabled" });
      console.log("COMM-UX1 PASS mobile 390px nav, search, roles:", id);
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}
console.log("COMM-UX1 AUTHENTICATED LOCAL ACCEPTANCE PASS");
