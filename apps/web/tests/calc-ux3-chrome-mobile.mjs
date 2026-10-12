/**
 * CALC-UX3 — actual Chrome layout, contrast, focus and tap-target acceptance.
 * Read-only, unauthenticated, disposable localhost production server.
 * Covers both locales across 320/390/768/1440px without external requests.
 */
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";

const BASE = "http://127.0.0.1:3000";
const OUT = "/tmp/calc-ux3";
const sizes = [
  { width: 320, height: 720 }, { width: 390, height: 844 },
  { width: 768, height: 1024 }, { width: 1440, height: 900 },
];
const paths = ["/knowledge/tubes", "/en/knowledge/tubes"];
const browser = await chromium.launch({ headless: true, channel: "chrome" });
const violations = [];
await fs.mkdir(OUT, { recursive: true });

function rgb(value) {
  const numbers = value.match(/[\d.]+/g)?.map(Number) || [];
  assert.ok(numbers.length >= 3, "Unknown CSS color: " + value);
  return numbers.slice(0, 3);
}
function luminance(values) {
  const channels = values.map((value) => {
    const c = value / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}
function contrast(foreground, background) {
  const values = [luminance(rgb(foreground)), luminance(rgb(background))].sort((a, b) => a - b);
  return (values[1] + 0.05) / (values[0] + 0.05);
}

try {
  for (const path of paths) {
    for (const { width, height } of sizes) {
      const context = await browser.newContext({
        viewport: { width, height },
        locale: path.startsWith("/en") ? "en-GB" : "it-IT",
        deviceScaleFactor: 1, isMobile: width < 768, hasTouch: width < 768,
        reducedMotion: "reduce", serviceWorkers: "block", acceptDownloads: false,
      });
      await context.route("**/*", async (route) => {
        const request = route.request();
        if (!["GET", "HEAD"].includes(request.method()) ||
            new URL(request.url()).origin !== BASE) {
          violations.push(request.method() + " " + request.url());
          return route.abort();
        }
        await route.continue();
      });
      const page = await context.newPage();
      const tag = (path.startsWith("/en") ? "en" : "it") + "-" + width;
      try {
        const res = await page.goto(BASE + path, { waitUntil: "domcontentloaded", timeout: 55000 });
        assert.equal(res?.status(), 200, tag + ": page must return HTTP 200");
        const calc = page.locator("#calcolatore-pesi");
        await calc.waitFor({ state: "visible", timeout: 30000 });
        await page.waitForFunction(() => {
          const action = document.querySelector("#calcolatore-pesi .tube-calculator-rfq-link");
          return action && !action.disabled;
        }, { timeout: 30000 });
        const geometry = await calc.evaluate((element) => {
          const r = element.getBoundingClientRect();
          return { x: r.left, right: r.right, width: r.width, client: element.clientWidth,
            scroll: element.scrollWidth, viewport: document.documentElement.clientWidth,
            totalScroll: document.documentElement.scrollWidth };
        });
        assert.ok(geometry.x >= -12 && geometry.right <= geometry.viewport + 12,
          tag + ": calculator clipped " + JSON.stringify(geometry));
        assert.ok(geometry.scroll <= geometry.client + 12,
          tag + ": calculator has hidden horizontal overflow " + JSON.stringify(geometry));
        assert.ok(geometry.totalScroll <= geometry.viewport + 12,
          tag + ": document overflows " + JSON.stringify(geometry));

        // Minimum actionable dimensions, including the scrolled thickness strip.
        const touchTargets = [
          ...await calc.locator("#calculator-standard + div button, #calculator-standard ~ div button").all(),
          ...await calc.locator("#calculator-shape + div button, #calculator-shape ~ div button").all(),
          ...await calc.locator('button[aria-label*="mm"]').all(),
          ...await calc.locator("button.school-primary-action").all(),
          ...await calc.locator("button.school-secondary-action").all(),
          ...await calc.locator("header button, header summary").all(),
          ...await calc.locator(".tube-calculator-result > div button").all(),
          calc.locator(".tube-calculator-rfq-link"),
        ];
        for (const item of touchTargets) {
          if (!(await item.isVisible())) continue;
          const r = await item.boundingBox();
          assert.ok(r && r.width >= 44 - 0.5 && r.height >= 44 - 0.5,
            tag + ": action below 44px " + JSON.stringify(r));
        }

        for (const selector of [
          "#calculator-standard + div button[aria-pressed=true]",
          ".tube-calculator-rfq-link",
        ]) {
          const item = calc.locator(selector);
          await item.first().waitFor({ state: "visible" });
          const style = await item.first().evaluate((element) => {
            const css = getComputedStyle(element);
            return { fg: css.color, bg: css.backgroundColor, fill: css.webkitTextFillColor };
          });
          assert.ok(contrast(style.fg, style.bg) >= 4.5,
            tag + ": weak button contrast " + selector + " " + JSON.stringify(style));
          assert.equal(style.fill, style.fg,
            tag + ": Safari text fill conflicts with foreground " + selector);
        }
        const first = calc.locator("#calculator-standard + div button").first();
        await first.focus();
        const focus = await first.evaluate((element) => {
          const css = getComputedStyle(element);
          return { style: css.outlineStyle, width: css.outlineWidth };
        });
        assert.equal(focus.style, "solid", tag + ": no keyboard focus ring");
        assert.ok(parseFloat(focus.width) >= 2, tag + ": focus ring below 2px");
        const diagrams = calc.locator("#calculator-shape + div button");
        if (await diagrams.count() === 3) {
          await diagrams.nth(1).click();
          assert.equal(await diagrams.nth(1).getAttribute("aria-pressed"), "true");
          await diagrams.first().click();
          assert.equal(await diagrams.first().getAttribute("aria-pressed"), "true");
        }
        assert.ok(await calc.locator(".tube-calculator-rfq-link").isEnabled(),
          tag + ": theoretical RFQ handoff disappeared");

        if (width === 390 || width === 1440) {
          const axe = await new AxeBuilder({ page }).include("#calcolatore-pesi")
            .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
          const severe = axe.violations.filter((v) => ["serious", "critical"].includes(v.impact));
          assert.deepEqual(severe.map((v) => v.id), [],
            tag + ": severe axe violations " + JSON.stringify(severe.map((v) =>
              ({ id: v.id, impact: v.impact, nodes: v.nodes.length }))));
          console.log("CALC-UX3 AXE", tag, JSON.stringify(axe.violations.map((v) =>
            ({ id: v.id, impact: v.impact, nodes: v.nodes.length }))));
        }
        await calc.screenshot({
          path: OUT + "/" + tag + ".png", animations: "disabled", timeout: 25000,
        });
        console.log("CALC-UX3 CHROME PASS", tag, JSON.stringify(geometry));
      } finally {
        await context.close();
      }
    }
  }
  assert.deepEqual(violations, [], "Unexpected external/write attempts");
  console.log("CALC-UX3 CHROME TOTAL", paths.length * sizes.length, "PASS");
} finally {
  await browser.close();
}
