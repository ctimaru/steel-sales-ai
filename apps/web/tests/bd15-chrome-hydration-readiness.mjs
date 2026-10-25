/** Deterministic local-only regression for the server-rendered input window. */
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";

const origin = process.env.DEMOTEST23_WEB_URL ?? "http://127.0.0.1:3000";
assert.equal(origin, "http://127.0.0.1:3000", "BD15 prohibits nonlocal Next.js");

export async function waitForBuilderReady(page) {
  await page.locator('[data-private-calculator-page][data-buyer-draft-ready="true"]')
    .waitFor({ state: "visible", timeout: 60000 });
  await page.locator('#calcolatore-pesi[data-calculator-ready="true"]')
    .waitFor({ state: "visible", timeout: 60000 });
}
export async function checkDeferredClientReadiness(page) {
  // Hold every client script until the streamed HTML is visible. This creates
  // the pre-hydration window deterministically without timing-based sleeps.
  let releaseScripts;
  const scriptsReady = new Promise(resolve => { releaseScripts = resolve; });
  const deferScript = async route => {
    if (route.request().resourceType() === "script") await scriptsReady;
    await route.continue();
  };
  await page.route("**/*", deferScript);
  try {
    const response = await page.goto(origin + "/distinta", { waitUntil: "commit", timeout: 90000 });
    assert.ok(response && response.status() < 500);
    const builder = page.locator("[data-private-calculator-page]");
    await builder.waitFor({ state: "visible", timeout: 60000 });
    assert.equal(await builder.getAttribute("data-buyer-draft-ready"), "false");
    assert.equal(await builder.evaluate(node => node.inert), true,
      "SSR draft controls cannot accept edits before their state is restored");
    assert.equal(await page.getByLabel("Titolo distinta").isEnabled(), false);
    const calc = page.locator("#calcolatore-pesi");
    assert.equal(await calc.getAttribute("data-calculator-ready"), "false");
    assert.equal(await calc.evaluate(node => node.closest("[inert]") !== null), true,
      "SSR calculator controls cannot accept edits before local retention is restored");
  } finally {
    releaseScripts();
    // Drain the handlers released above before a failed assertion can close
    // the page/browser; an in-flight handler must finish its own continuation.
    await page.unrouteAll({ behavior: "wait" });
  }
  await waitForBuilderReady(page);
  const title = page.getByLabel("Titolo distinta");
  const quantity = page.locator("#calcolatore-pesi").getByLabel("Numero barre");
  await title.fill("BD15 READY INPUT");
  await quantity.fill("3");
  await page.locator("#calcolatore-pesi").getByRole("combobox", { name: "Norma" }).selectOption("en10210");
  assert.equal(await title.inputValue(), "BD15 READY INPUT", "Title survives a hydrated render");
  assert.equal(await quantity.inputValue(), "3", "Quantity survives a hydrated render");
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const executablePath = process.env.DEMOTEST23_BROWSER_EXECUTABLE;
  const browser = await chromium.launch({
    ...(executablePath ? { executablePath } : { channel: "chrome" }),
    headless: true,
  });
  try {
    for (const width of [390, 1440]) {
      const context = await browser.newContext({
        viewport: { width, height: width === 390 ? 844 : 900 },
        isMobile: width === 390, locale: "it-IT",
      });
      try {
        await checkDeferredClientReadiness(await context.newPage());
        console.log("BD15 HYDRATION PASS", width);
      } finally {
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }
}
