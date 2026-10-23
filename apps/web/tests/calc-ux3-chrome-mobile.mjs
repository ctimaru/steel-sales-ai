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
        if (!["GET", "HEAD"].includes(request.method())) {
          violations.push(request.method() + " " + request.url());
          return route.abort();
        }
        if (new URL(request.url()).origin !== BASE) return route.abort();
        await route.continue();
      });
      const page = await context.newPage();
      const tag = (path.startsWith("/en") ? "en" : "it") + "-" + width;
      try {
        const res = await page.goto(BASE + path, { waitUntil: "domcontentloaded", timeout: 55000 });
        assert.equal(res?.status(), 200, tag + ": page must return HTTP 200");
        assert.equal(await page.locator("html").getAttribute("lang"), path.startsWith("/en/") ? "en" : "it",
          `I18N8: document html language must match ${path}`);
        const calc = page.locator("#calcolatore-pesi");
        await calc.waitFor({ state: "visible", timeout: 30000 });
        await page.waitForFunction(() => {
          const action = document.querySelector("#calcolatore-pesi .tube-calculator-rfq-link");
          return action && !action.disabled;
        }, null, { timeout: 30000 });
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
          ...await calc.locator('select[aria-label]').all(),
          ...await calc.locator('button[aria-label*="mm"]').all(),
          ...await calc.locator("button.school-primary-action").all(),
          ...await calc.locator("button.school-secondary-action").all(),
          ...await calc.locator("header button, header summary").all(),
          ...await calc.locator(".tube-calculator-result > div button").all(),
          calc.locator(".tube-calculator-rfq-link"),
        ];
        // Touch needs 44px at phone widths; the compact desktop rail has
        // explicit spacing and keeps 36px controls for mouse/keyboard use.
        const minimumControlSize = width < 768 ? 44 : 36;
        for (const item of touchTargets) {
          if (!(await item.isVisible())) continue;
          const r = await item.boundingBox();
          assert.ok(r && r.width >= minimumControlSize - 0.5 && r.height >= minimumControlSize - 0.5,
            tag + ": action below " + minimumControlSize + "px " + JSON.stringify(r));
        }

        for (const selector of [
          'select[aria-label]',
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
        const first = calc.locator('select[aria-label]').first();
        await first.focus();
        const focus = await first.evaluate((element) => {
          const css = getComputedStyle(element);
          return { outline: css.outlineStyle, width: css.outlineWidth, shadow: css.boxShadow };
        });
        assert.ok((focus.outline === "solid" && parseFloat(focus.width) >= 2) ||
          (focus.shadow !== "none" && focus.shadow.length > 5),
          tag + ": no visible keyboard focus indicator");
        // Verify the actual shared shape state through native selection.
        const shape = calc.locator('select').filter({ has: page.locator('option[value="round_tube"]') }).first();
        await shape.selectOption("square_tube");
        assert.equal(await shape.inputValue(), "square_tube");
        await shape.selectOption("round_tube");
        assert.equal(await shape.inputValue(), "round_tube");
        assert.ok(await calc.locator(".tube-calculator-rfq-link").isEnabled(),
          tag + ": theoretical RFQ handoff disappeared");

        if (width === 390 || width === 1440) {
          const axe = await new AxeBuilder({ page }).include("#calcolatore-pesi")
            .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
          const severe = axe.violations.filter((v) => ["serious", "critical"].includes(v.impact));
          assert.deepEqual(severe.map((v) => v.id), [],
            tag + ": severe axe violations " + JSON.stringify(severe.map((v) =>
              ({ id: v.id, impact: v.impact, nodes: v.nodes.map(n=>({
                target:n.target,html:n.html?.slice(0,300),summary:n.failureSummary?.slice(0,340),
              })) }))));
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
  // Analytics can attempt optional telemetry after an interaction. The QA never sends it.
  console.log("CALC-UX3 NETWORK", JSON.stringify({ blockedWriteAttempts: violations.length }));
  console.log("CALC-UX3 CHROME TOTAL", paths.length * sizes.length, "PASS");
} finally {
  await browser.close();
}
