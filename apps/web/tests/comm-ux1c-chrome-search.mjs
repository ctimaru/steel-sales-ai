/**
 * COMM-UX1C — Chrome acceptance for the one-search UX and tenant-safe routes.
 * Runs ONLY against ephemeral local Next.js + GoTrue. This workflow has no
 * private worker (WORKER_URL); it checks a real authenticated error/empty state,
 * while separate contract tests verify typed worker payload restrictions.
 */
import assert from "node:assert/strict";
import { readFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const base = (process.env.DEMOTEST23_WEB_URL ?? "").replace(/\/$/, "");
assert.equal(base, "http://127.0.0.1:3000", "Only local throwaway server allowed");
assert.ok(process.env.RUNNER_TEMP, "Ephemeral GitHub runner required");
const personas = JSON.parse(readFileSync(path.join(process.env.RUNNER_TEMP, "demotest23-personas.json"), "utf8"));
const browser = await chromium.launch({ channel: "chrome", headless: true });
const screenshots = path.join(process.env.RUNNER_TEMP, "comm-ux1c-search-screenshots");
mkdirSync(screenshots, { recursive: true });

async function login(page, user) {
  await page.goto(base + "/login", { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.locator('input[name="email"]').fill(user.email);
  await page.locator('input[name="password"]').fill(user.password);
  await page.getByRole("button", { name: "Accedi", exact: true }).click();
  await page.waitForURL(u => u.pathname === "/dashboard", { timeout: 90000 });
  await page.getByRole("heading", { name: "Oggi in " + user.name, exact: true }).waitFor({ state: "visible", timeout: 60000 });
}
async function searchHeader(page, term) {
  const form = page.locator('form[action="/commercial/search"]');
  assert.equal(await form.count(), 1, "One global search entry point");
  await form.locator('input[name="q"]').fill(term);
  await form.locator('input[name="q"]').press("Enter");
  await page.waitForURL(u => u.pathname === "/commercial/search" && u.searchParams.get("q") === term, { timeout: 60000 });
}
async function tabs(page, expected) {
  const nav = page.getByRole("navigation", { name: "Categorie ricerca commerciale" });
  await nav.waitFor({ state: "visible", timeout: 60000 });
  assert.deepEqual(await nav.locator("a").allTextContents(), ["Tutto", "RFQ e offerte", "Aziende", "Prodotti", "Documenti"]);
  assert.equal(await nav.getByRole("link", { name: expected, exact: true }).getAttribute("aria-current"), "page");
  const color = await nav.getByRole("link", { name: expected, exact: true }).evaluate(el => ({
    color: getComputedStyle(el).color,
    fill: getComputedStyle(el).webkitTextFillColor,
  }));
  assert.equal(color.color, "rgb(255, 255, 255)", "Selected category needs white text on green");
  assert.equal(color.fill, "rgb(255, 255, 255)", "Selected category WebKit text fill must be white");
}
async function noOverflow(page, label) {
  const w = await page.evaluate(() => [document.documentElement.clientWidth, document.documentElement.scrollWidth]);
  assert.ok(w[1] <= w[0] + 12, label + ": document overflow " + w.join(" / "));
}

try {
  for (const id of ["buyer", "buyerViewer"]) {
    const user = personas.find(p => p.id === id);
    assert.ok(user);
    const context = await browser.newContext({
      viewport: { width: id === "buyer" ? 1440 : 390, height: id === "buyer" ? 900 : 844 },
      isMobile: id === "buyerViewer", deviceScaleFactor: id === "buyerViewer" ? 2 : 1,
      locale: "it-IT",
    });
    const page = await context.newPage();
    try {
      await login(page, user);
      await searchHeader(page, "P265GH");
      await page.getByRole("heading", { name: "Cerca nello storico commerciale" }).waitFor({ state: "visible", timeout: 60000 });
      await tabs(page, "Tutto");
      assert.equal(await page.locator('input[name="query"]').inputValue(), "P265GH");
      assert.equal(await page.locator('input[name="scope"]').inputValue(), "all");
      // Header Enter must start a search once without a second click. The
      // throwaway runner does not configure a worker, so expect a clear error.
      await page.getByRole("alert").getByText("Worker non configurato nell'ambiente web.")
        .waitFor({ state: "visible", timeout: 60000 });
      await page.getByRole("navigation", { name: "Categorie ricerca commerciale" })
        .getByRole("link", { name: "Aziende", exact: true }).click();
      await page.waitForURL(u => u.pathname === "/commercial/search" && u.searchParams.get("scope") === "companies" && u.searchParams.get("q") === "P265GH", { timeout: 60000 });
      await tabs(page, "Aziende");
      assert.equal(await page.locator('input[name="scope"]').inputValue(), "companies");
      assert.equal(await page.locator('input[name="query"]').inputValue(), "P265GH");
      assert.equal(await page.locator('input[name="types"]').count(), 0, "Types cannot broaden a scoped search");
      const bridge = page.getByRole("link", { name: "RFQ fornitori e bozze" });
      assert.equal(await bridge.count(), 1);
      const href = await bridge.getAttribute("href");
      assert.equal(href, "/commercial?q=P265GH#commercial-worklist");
      await noOverflow(page, id + " category search");
      await page.screenshot({ path: path.join(screenshots, "search-" + id + ".png"),
        fullPage: false, animations: "disabled" });
      await bridge.click();
      await page.waitForURL(u => u.pathname === "/commercial" && u.searchParams.get("q") === "P265GH", { timeout: 60000 });
      assert.equal(await page.locator("#commercial-worklist").count(), 1);
      assert.equal(await page.locator("#commercial-worklist input[name=q]").inputValue(), "P265GH");
      if (id === "buyerViewer") {
        assert.equal(await page.getByRole("link", { name: /Nuova richiesta/ }).count(), 0);
      }
      console.log("COMM-UX1C Chrome PASS: local auth, one search, tabs, contrast, procurement bridge, role", id);
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}
