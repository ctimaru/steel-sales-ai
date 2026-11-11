/**
 * COMM-AI-NATIVE1.B: local-only Chrome acceptance for the opt-in AI-first shell.
 * Synthetic buyer/viewer only; no LLM provider, emails or real user data.
 */
import assert from "node:assert/strict";
import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const origin = process.env.DEMOTEST23_WEB_URL;
assert.equal(origin, "http://127.0.0.1:3000", "External frontend forbidden");
assert.equal(process.env.NEXT_PUBLIC_SUPABASE_URL, "http://127.0.0.1:54321", "External DB forbidden");
assert.equal(process.env.FLOW1_LOCAL_PROVIDER, "true");
assert.ok(process.env.RUNNER_TEMP);
const people = JSON.parse(readFileSync(path.join(process.env.RUNNER_TEMP, "demotest23-personas.json"), "utf8"));
const buyer = people.find(p => p.id === "buyer");
const viewer = people.find(p => p.id === "buyerViewer");
assert.ok(buyer?.email && viewer?.email);
const screenshots = path.join(process.env.RUNNER_TEMP, "comm-ai-native1b-visual");
mkdirSync(screenshots, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: "chrome" });

try {
  for (const person of [buyer, viewer]) {
    for (const width of [1440, 390, 320]) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, locale: "it-IT" });
      try {
        const page = await context.newPage();
        await page.goto(origin + "/login", { waitUntil: "domcontentloaded", timeout: 90000 });
        await page.locator('input[name="email"]').fill(person.email);
        await page.locator('input[name="password"]').fill(person.password);
        await page.getByRole("button", { name: "Accedi", exact: true }).click();
        await page.waitForURL(url => url.pathname === "/dashboard", { timeout: 90000 });
        await page.goto(origin + "/commercial?experience=ai", { waitUntil: "domcontentloaded", timeout: 90000 });
        const shell = page.getByTestId("commercial-ai-native-shell");
        await shell.waitFor({ state: "visible", timeout: 60000 });
        assert.ok(await shell.getByRole("heading", { name: "Smart Steel Intelligence" }).isVisible());
        assert.equal(await page.getByTestId("comm-cine13-first-workspace").count(), 0);
        assert.ok(await shell.getByTestId("commercial-ai-native-legacy").isVisible());
        const input = shell.getByLabel("Domanda o richiesta commerciale");
        await input.waitFor({ state: "visible" });
        // Capture the REAL viewport before geometry assertions, including the
        // global header, Commerciale's secondary mobile nav and the fixed dock.
        await page.screenshot({ path: path.join(screenshots, person.id + "-" + width + "-empty.png"),
          animations: "disabled" });
        if (width < 1024) {
          const dock = page.getByRole("navigation", { name: "Navigazione mobile principale" });
          const [dockBox, composerBox, headerBox] = await Promise.all([
            dock.boundingBox(),
            shell.getByTestId("commercial-ai-native-form").boundingBox(),
            shell.getByRole("heading", { name: "Smart Steel Intelligence" }).boundingBox(),
          ]);
          assert.ok(dockBox && composerBox && headerBox, "Missing mobile layout elements");
          assert.ok(headerBox.y >= 64 && headerBox.y < 320, "AI header must be below global sticky navigation");
          assert.ok(composerBox.y >= 0 && composerBox.y + composerBox.height <= dockBox.y - 4,
            "Composer must remain fully visible ABOVE mobile dock: " +
            JSON.stringify({ composerBottom: Math.round(composerBox.y + composerBox.height), dockTop: Math.round(dockBox.y) }));
        }
        const widths = await page.evaluate(() => ({
          visible: document.documentElement.clientWidth,
          document: document.documentElement.scrollWidth,
        }));
        assert.ok(widths.document <= widths.visible + 12, "Overflow " + person.id + "/" + width);
        if (width < 1024) {
          const button = shell.getByTestId("commercial-ai-native-mobile-context");
          await button.click();
          const dialog = page.getByTestId("commercial-ai-native-mobile-drawer");
          await dialog.waitFor({ state: "visible" });
          await page.keyboard.press("Escape");
          await dialog.waitFor({ state: "hidden" });
          assert.ok(await button.evaluate(node => node === document.activeElement), "Focus restore");
        } else {
          assert.ok(await shell.getByTestId("commercial-ai-native-desktop-context").isVisible());
        }
        await input.fill("Chi produce tubo S355 Ø608?");
        await shell.getByTestId("commercial-ai-native-submit").click();
        await shell.getByRole("link", { name: /Apri ricerca Network/ }).waitFor({ state: "visible" });
        assert.equal(await shell.getByTestId("commercial-ai-native-open-distinta").count(), 0,
          "Producer question must never create a Distinta");
        await input.fill("Preparami 24 barre Ø608×10 EN 10219 S355J2H");
        await input.press("Enter");
        await shell.getByTestId("commercial-ai-native-turn").nth(1).waitFor({ state: "visible" });
        const start = shell.getByTestId("commercial-ai-native-open-distinta");
        assert.equal(await start.count(), person.id === "buyer" ? 1 : 0);
        assert.equal(await shell.getByTestId("commercial-ai-native-context-distinta").count(), 0,
          "Do not duplicate Distinta CTA in the context panel");
        if (width < 1024) {
          const dock = await page.getByRole("navigation", { name: "Navigazione mobile principale" }).boundingBox();
          const composer = await shell.getByTestId("commercial-ai-native-form").boundingBox();
          const send = await shell.getByTestId("commercial-ai-native-submit").boundingBox();
          assert.ok(dock && composer && send, "Missing mobile composer or dock");
          assert.ok(composer.y >= 0 && composer.y + composer.height <= dock.y - 4,
            "Mobile composer is covered by the fixed dock after conversation");
          assert.ok(send.y >= 0 && send.y + send.height <= dock.y - 4,
            "Mobile send button is covered by the fixed dock after conversation");
        }
        await page.screenshot({ path: path.join(screenshots, person.id + "-" + width + ".png"),
          animations: "disabled" });
        if (person.id === "buyer") {
          await start.click();
          await page.waitForURL(url => url.pathname === "/commercial" &&
            url.searchParams.get("compose") === "1" &&
            url.searchParams.get("method") === "ai", { timeout: 90000 });
          assert.equal(await page.getByTestId("commercial-ai-native-shell").count(), 0);
        }
        console.log("COMM-AI-NATIVE1.B CHROME PASS", person.id, width);
      } finally {
        await context.close();
      }
    }
  }
} finally {
  await browser.close();
}
