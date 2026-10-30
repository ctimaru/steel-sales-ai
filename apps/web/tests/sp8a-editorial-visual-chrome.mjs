import assert from "node:assert/strict";
import { readFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const base = process.env.SP8A_WEB_URL;
assert.equal(base, "http://127.0.0.1:3000", "No external site allowed");
const temp = process.env.RUNNER_TEMP;
assert.ok(temp);
const actors = JSON.parse(readFileSync(path.join(temp, "sp8a-users.json"), "utf8"));
const dir = path.join(temp, "sp8a-visual-evidence");
mkdirSync(dir, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: "chrome" });

async function signin(page, person) {
  await page.goto(base + "/login", { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.locator('input[name="email"]').fill(person.email);
  await page.locator('input[name="password"]').fill(person.password);
  await page.getByRole("button", { name: "Accedi", exact: true }).click();
  await page.waitForURL(url => url.pathname !== "/login", { timeout: 90000 });
}

try {
  const anon = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const anonPage = await anon.newPage();
  await anonPage.goto(base + "/platform/steel-pulse/editorial", { waitUntil: "domcontentloaded", timeout: 90000 });
  await anonPage.waitForURL(url => url.pathname === "/login", { timeout: 30000 });
  console.log("SP8.A PASS anonymous denied");
  await anon.close();

  const ordinary = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const ordinaryPage = await ordinary.newPage();
  await signin(ordinaryPage, actors.find(x=>x.id === "ordinary"));
  await ordinaryPage.goto(base + "/platform/steel-pulse/editorial", { waitUntil: "domcontentloaded", timeout: 90000 });
  await ordinaryPage.waitForURL(url => url.pathname !== "/platform/steel-pulse/editorial", { timeout: 45000 });
  assert.ok(!(await ordinaryPage.locator("body").innerText()).includes("Anteprima editoriale"));
  console.log("SP8.A PASS ordinary user denied");
  await ordinary.close();

  for (const width of [1440, 390, 320]) {
    const context = await browser.newContext({
      viewport: { width, height: width === 1440 ? 900 : 800 },
      locale: "it-IT", serviceWorkers: "block",
    });
    const page = await context.newPage();
    await signin(page, actors.find(x=>x.id === "owner"));
    await page.goto(base + "/platform/steel-pulse/editorial", { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.getByRole("heading", { name: "Steel Pulse · Editorial Studio" })
      .waitFor({ state: "visible", timeout: 90000 });
    await page.getByRole("heading", { name: "Coda editoriale" }).waitFor({ state: "visible" });
    await page.getByText("SP8.A Synthetic Source").first().waitFor({ state: "visible", timeout: 30000 });
    assert.equal(await page.getByRole("link", { name: /Apri anteprima/ }).count(), 1);
    await page.screenshot({ path: path.join(dir, "sp8a-"+width+"-queue.png"), fullPage: true, animations: "disabled" });
    await page.getByRole("link", { name: /Apri anteprima/ }).first().click();
    await page.getByRole("heading", { name: "Fonte e diritti" }).waitFor({ state: "visible", timeout: 30000 });
    assert.ok((await page.locator("body").innerText()).includes("Diritti non verificati"));
    assert.equal(await page.locator('form[action*="publish"]').count(), 0);
    assert.equal(await page.getByRole("link", { name: /Apri fonte originale/ }).count(), 1);
    assert.ok(await page.getByRole("heading", { name: "Anteprima editoriale" }).isVisible());
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    assert.ok(overflow <= 1, "Horizontal overflow " + overflow + "px at viewport " + width);
    await page.screenshot({ path: path.join(dir, "sp8a-"+width+"-detail.png"), fullPage: true, animations: "disabled" });
    console.log("SP8.A PASS real synthetic owner auth and visual", width);
    await context.close();
  }
} finally {
  await browser.close();
}
