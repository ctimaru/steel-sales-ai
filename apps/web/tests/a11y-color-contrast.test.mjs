import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const globals = fs.readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const home = fs.readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");

function channel(value) {
  const c = value / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance(hex) {
  const value = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((offset) =>
    Number.parseInt(value.slice(offset, offset + 2), 16),
  );
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrast(a, b) {
  const l1 = luminance(a);
  const l2 = luminance(b);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

test("public text tokens meet WCAG AA 4.5:1 on their light surfaces", () => {
  assert.ok(contrast("#475569", "#f6f8f7") >= 4.5);
  assert.ok(contrast("#475569", "#ffffff") >= 4.5);
  assert.ok(contrast("#475569", "#f8faf9") >= 4.5);
  assert.ok(contrast("#52615b", "#f6f8f7") >= 4.5);
});

test("primary public CTA meets WCAG AA with white text", () => {
  assert.ok(contrast("#ffffff", "#1f6b5a") >= 4.5);
  assert.ok(contrast("#ffffff", "#185247") >= 4.5);
  assert.match(globals, /\.public-primary-cta/);
  assert.match(home, /public-primary-cta/);
});

test("legacy low-contrast public utility colors are remapped to accessible muted text", () => {
  for (const token of ["#66736e", "#718078", "#7a8782"]) {
    assert.match(globals, new RegExp(`text-\\[\\${token}\\]`));
  }
  assert.match(globals, /--muted-foreground: var\(--text-secondary\)/);
});
