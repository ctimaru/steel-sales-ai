/**
 * COMM-AI-NATIVE1.B/C: local-only Chrome acceptance for the AI-first shell and authenticated intent/reply.
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
        await page.goto(origin + "/commercial", { waitUntil: "domcontentloaded", timeout: 90000 });
        assert.equal(new URL(page.url()).searchParams.get("experience"), null, "AI-first must now be default");
        const shell = page.getByTestId("commercial-ai-native-shell");
        await shell.waitFor({ state: "visible", timeout: 60000 });
        assert.ok(await shell.getByRole("heading", { name: "Smart Steel Intelligence" }).isVisible());
        // CLEAN1: no second Commerciale navigation beside or above the chat.
        const oldDesktop = page.getByTestId("commercial-director-sidebar");
        const oldMobile = page.getByTestId("commercial-director-mobile");
        if (width >= 1280) {
          assert.equal(await oldDesktop.isVisible(), false, "Old desktop director sidebar must be hidden on AI home");
        } else {
          assert.equal(await oldMobile.isVisible(), false, "Duplicate mobile Commerciale navigation must be hidden");
        }
        assert.equal(await page.getByTestId("comm-cine13-first-workspace").count(), 0);
        assert.equal(await shell.getByTestId("commercial-ai-native-legacy").count(), 2,
          "Classic management remains available in both responsive tools menus");
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
        const composerOnEmpty = await shell.getByTestId("commercial-ai-native-form").boundingBox();
        const thirdPrompt = await shell.getByRole("button", { name: "Qual è la differenza tra EN 10219 ed EN 10210?" }).boundingBox();
        assert.ok(composerOnEmpty && thirdPrompt && thirdPrompt.y + thirdPrompt.height <= composerOnEmpty.y - 3,
          "All 3 examples must fit above the composer even at 320px");
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
          const classic = dialog.getByTestId("commercial-ai-native-legacy");
          await classic.waitFor({ state: "visible" });
          assert.equal(await classic.getAttribute("href"), "/commercial?experience=classic");
          assert.equal(await dialog.getByRole("link", { name: "Centro RFQ" }).count(), 1);
          await page.keyboard.press("Escape");
          await dialog.waitFor({ state: "hidden" });
          assert.ok(await button.evaluate(node => node === document.activeElement), "Focus restore");
        } else {
          const tools = shell.getByTestId("commercial-ai-native-desktop-context");
          assert.ok(await tools.isVisible());
          await tools.locator("summary").click();
          const classic = tools.getByTestId("commercial-ai-native-legacy");
          await classic.waitFor({ state: "visible" });
          assert.equal(await classic.getAttribute("href"), "/commercial?experience=classic");
          assert.equal(await tools.getByRole("link", { name: "Centro RFQ" }).count(), 1);
          await tools.locator("summary").click();
        }
        await input.fill("Chi produce tubo S355 Ø608?");
        await shell.getByTestId("commercial-ai-native-submit").click();
        await shell.getByRole("link", { name: /Esplora Network/ }).waitFor({ state: "visible" });
        // D: read-only Network lookup replaces the phase C not-connected placeholder.
        const evidence = shell.getByTestId("commercial-ai-native-industry-results");
        await evidence.first().waitFor({ state: "visible", timeout: 30000 });
        assert.equal(await shell.getByTestId("commercial-ai-native-not-connected").count(), 0);
        assert.equal(await shell.getByTestId("commercial-ai-native-open-distinta").count(), 0);
        // Entitlement-locked viewers receive no detailed company cards, but do
        // receive an honest locked state with the normal Network entrypoint.
        if (await shell.getByTestId("commercial-ai-native-industry-access-locked").count()) {
          assert.equal(await shell.getByTestId("commercial-ai-native-industry-company").count(), 0);
        } else {
          assert.ok(await shell.getByTestId("commercial-ai-native-industry-company").count() <= 6);
        }
        assert.match(await shell.getByTestId("commercial-ai-native-turn").first().innerText(), /norma.*spessore/i);
        assert.equal(await shell.getByTestId("commercial-ai-native-open-distinta").count(), 0,
          "Producer question must never create a Distinta");
        await input.fill("Preparami 24 barre Ø608×10 EN 10219 S355J2H");
        await input.press("Enter");
        await shell.getByTestId("commercial-ai-native-turn").nth(1).waitFor({ state: "visible" });
        const start = shell.getByTestId("commercial-ai-native-open-distinta");
        if (person.id === "buyer") {
          await start.waitFor({ state: "visible", timeout: 30000 });
        } else {
          await shell.getByTestId("commercial-ai-native-turn").nth(1).getByText(/sola lettura|non è abilitato/).waitFor({ state: "visible", timeout: 30000 });
        }
        assert.equal(await start.count(), person.id === "buyer" ? 1 : 0);
        assert.equal(await shell.getByTestId("commercial-ai-native-context-distinta").count(), 0,
          "Do not duplicate Distinta CTA in the context panel");
        if (width >= 1024) {
          // C: after multiple turns, the desktop composer stays in the viewport;
          // content scrolls inside the thread instead of stretching the page.
          const [composer, shellBox] = await Promise.all([
            shell.getByTestId("commercial-ai-native-form").boundingBox(),
            shell.boundingBox(),
          ]);
          assert.ok(composer && shellBox, "Missing desktop composer");
          assert.ok(composer.y >= 0 && composer.y + composer.height < 900,
            "Desktop composer must remain visible after multi-turn conversation");
          assert.ok(shellBox.y + shellBox.height <= 900,
            "Desktop chat must not stretch below 900px viewport");
        }
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
        await input.fill("Qual è la differenza tra EN 10219 ed EN 10210?");
        await shell.getByTestId("commercial-ai-native-submit").click();
        await shell.getByTestId("commercial-ai-native-unverified").waitFor({ state: "visible", timeout: 30000 });
        assert.match(await shell.getByTestId("commercial-ai-native-turn").last().innerText(), /EN 10219/i);
        assert.equal(await shell.getByTestId("commercial-ai-native-open-distinta").count(), person.id === "buyer" ? 1 : 0);
        assert.ok((await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)) <= 12,
          "C follow-up must not create horizontal overflow");
        await page.screenshot({ path: path.join(screenshots, person.id + "-" + width + ".png"),
          animations: "disabled" });
        if (width === 1440) {
          await input.fill("Che cosa significa ASTM A500?");
          await shell.getByTestId("commercial-ai-native-submit").click();
          await shell.getByTestId("commercial-ai-native-turn").last().getByRole("alert").waitFor({ state: "visible", timeout: 30000 });
          assert.match(await shell.getByTestId("commercial-ai-native-turn").last().innerText(), /non è disponibile|riprovare|non sono riuscito/i);
          // Explicit user text remains visible even after the unavailable-provider fallback.
          assert.ok(await shell.getByText("Che cosa significa ASTM A500?").isVisible());
        }
        if (person.id === "buyer") {
          await start.click();
          await page.waitForURL(url => url.pathname === "/commercial" &&
            url.searchParams.get("compose") === "1" &&
            url.searchParams.get("method") === "ai", { timeout: 90000 });
          assert.equal(await page.getByTestId("commercial-ai-native-shell").count(), 0);
        } else {
          const reset = shell.getByTestId("commercial-ai-native-new-chat");
          await reset.waitFor({ state: "visible" });
          await reset.click();
          assert.equal(await shell.getByTestId("commercial-ai-native-turn").count(), 0,
            "New chat must clear the transient thread without database mutations");
          assert.ok(await input.isVisible());
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
