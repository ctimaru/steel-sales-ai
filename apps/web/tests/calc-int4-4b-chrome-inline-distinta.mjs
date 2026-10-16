import assert from "node:assert/strict";
import { chromium } from "playwright";

/** CALC-INT4.4B — actual browser E2E, served Next.js build on port 3000. */
const browser = await chromium.launch({ headless: true, channel: "chrome" });
try {
  for (const width of [390, 1440]) {
    const context = await browser.newContext({
      viewport: { width, height: 860 }, reducedMotion: "reduce",
      permissions: ["clipboard-read", "clipboard-write"],
    });
    await context.route("**/*", route =>
      route.request().url().startsWith("http://127.0.0.1:3000")
        ? route.continue() : route.abort());
    const page = await context.newPage();
    const response = await page.goto("http://127.0.0.1:3000/knowledge/tubes", {
      waitUntil: "domcontentloaded", timeout: 60_000,
    });
    assert.equal(response?.status(), 200);
    assert.equal(await page.locator("html").getAttribute("lang"), "it");
    const calculator = page.locator("#calcolatore-pesi");
    await calculator.waitFor({state:"visible"});
    const bill = page.locator("#distinta-inline");
    assert.equal(await bill.count(), 1, "compact preview mounted under calculator");
    assert.equal(await bill.getByText("La tua distinta").count(), 1);
    assert.match(await bill.innerText(), /Aggiungi una misura dal calcolatore/);
    assert.equal(await bill.locator("article").count(), 0);

    await calculator.getByLabel("Numero barre").fill("3");
    await calculator.getByRole("button", { name: /Aggiungi alla distinta/ }).click();
    await bill.locator("article").first().waitFor({state:"visible"});
    assert.equal(await bill.locator("article").count(), 1);
    assert.match(await bill.innerText(), /EN 10219/);
    assert.match(await bill.innerText(), /36(?:[,.]0+)? m/);
    assert.equal(await page.url(), "http://127.0.0.1:3000/knowledge/tubes");

    await bill.getByRole("button",{name:"Modifica"}).click();
    await bill.getByLabel("Quantità", { exact: true }).fill("5");
    await bill.getByLabel("Grado acciaio").fill("S355J2H");
    await bill.getByRole("button",{name:"Salva riga"}).click();
    assert.match(await bill.innerText(), /S355J2H/);
    assert.match(await bill.innerText(), /60(?:[,.]0+)? m/);

    await calculator.getByRole("button", { name: /EN 10210/ }).click();
    await calculator.getByRole("button",{name:/Aggiungi alla distinta/}).click();
    await page.waitForFunction(() =>
      document.querySelectorAll("#distinta-inline article").length === 2);
    assert.match(await bill.innerText(), /EN 10210/);
    assert.match(await bill.innerText(), /EN 10219/);
    assert.match(await bill.innerText(), /96(?:[,.]0+)? m/);

    await bill.getByRole("button",{name:"Duplica riga 1"}).click();
    assert.equal(await bill.locator("article").count(),3);
    await bill.getByRole("button",{name:"Rimuovi riga 3"}).click();
    assert.equal(await bill.locator("article").count(),2);
    await bill.getByRole("button",{name:"Copia distinta"}).click();
    await page.getByText(/Distinta tecnica copiata/).waitFor({state:"visible"});
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    assert.match(copied,/EN 10219/);
    assert.match(copied,/EN 10210/);
    assert.doesNotMatch(copied,/850,00/);

    const saved = await page.evaluate(() => JSON.parse(
      sessionStorage.getItem("sss:inline-distinta:v1")));
    assert.equal(saved.lines.length,2);
    assert.ok(saved.lines.every(line => line.targetEurT === ""));
    await page.reload({waitUntil:"domcontentloaded"});
    await page.locator("#distinta-inline article").first().waitFor({state:"visible"});
    assert.equal(await page.locator("#distinta-inline article").count(),2);
    assert.match(await page.locator("#distinta-inline").innerText(), /recuperata da questa scheda/);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 12),false);
    await context.close();
    console.log("CALC-INT4.4B CHROME PASS",width,"edit duplicate remove copy restore, zero prices and no navigation");
  }
} finally {
  await browser.close();
}
