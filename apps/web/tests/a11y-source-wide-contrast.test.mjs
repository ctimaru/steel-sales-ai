import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const globals = fs.readFileSync(path.join(webRoot, "app/globals.css"), "utf8");

const mutedReplacement = "#5d6a65";
const mutedLegacy = [
  "#66736e", "#718078", "#7a8782", "#7b8782", "#87938e", "#8b9792",
  "#91a0b2", "#9aa49f", "#7f8da3", "#7f8b86", "#74817c",
  "#65716c", "#65758a", "#65758b", "#68788e", "#6b798c", "#6f7b76",
  "#718197", "#7a8781", "#7a899d", "#7b8882", "#98a29e",
  "#5f718a", "#64748b", "#64758d", "#66778c", "#68756f", "#6f7f93",
  "#71819a", "#78857f", "#78879a", "#7b8a9d", "#7b8ba1", "#7d8984",
  "#7e8da1", "#7f8da0", "#8090a4", "#82908a", "#8290a4", "#8291a5",
  "#8594a7", "#87908c", "#8795a7", "#8a9691", "#8a98aa", "#8a99ac",
  "#8b99aa", "#8fa1a9", "#92a0b1", "#95a2b3", "#96a3b4", "#9ba7a2",
  "#a0aaa5", "#a3ada8", "#a6b0ac",
];

const accentReplacement = new Map([
  ["#2f6fed", "#1e4fb8"],
  ["#3c8192", "#276778"],
  ["#7f725f", "#6f4f24"],
  ["#8a6a52", "#6f4f24"],
  ["#8a6d2f", "#6f4f24"],
]);

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
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

function effectiveTextColor(color) {
  const normalized = color.toLowerCase();
  if (mutedLegacy.includes(normalized)) return mutedReplacement;
  return accentReplacement.get(normalized) ?? normalized;
}

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return walk(fullPath);
    return /\.(?:tsx|ts)$/.test(entry.name) ? [fullPath] : [];
  });
}

test("all audited legacy low-contrast utilities are globally hardened", () => {
  for (const token of mutedLegacy) {
    assert.match(
      globals,
      new RegExp(`text-\\\\\[#${token.slice(1)}\\\\\]`),
      `Missing global contrast remap for ${token}`,
    );
  }

  for (const [token, replacement] of accentReplacement) {
    assert.match(globals, new RegExp(`text-\\\\\[#${token.slice(1)}\\\\\]`));
    assert.ok(
      contrast(replacement, "#ffffff") >= 4.5,
      `${replacement} must pass on white`,
    );
    assert.ok(
      contrast(replacement, "#f2f4f3") >= 4.5,
      `${replacement} must pass on the application background`,
    );
  }
});

test("static foreground/background button and badge pairs meet WCAG AA", () => {
  const failures = [];
  const roots = [path.join(webRoot, "app"), path.join(webRoot, "components")];

  for (const file of roots.flatMap(walk)) {
    const source = fs.readFileSync(file, "utf8");
    const strings = source.match(/["'`][^"'\n`]{1,900}["'`]/g) ?? [];

    for (const raw of strings) {
      const value = raw.slice(1, -1);
      const backgroundMatch = value.match(/(?:^|\s)bg-\[#([0-9a-fA-F]{6})\](?!\/)/);
      const whiteBackground = /(?:^|\s)bg-white(?:\s|$)/.test(value);
      if (!backgroundMatch && !whiteBackground) continue;

      const background = backgroundMatch ? `#${backgroundMatch[1].toLowerCase()}` : "#ffffff";
      const textHex = value.match(/(?:^|\s)text-\[#([0-9a-fA-F]{6})\](?:\s|$)/);
      const whiteText = /(?:^|\s)text-white(?:\s|$)/.test(value);
      if (!textHex && !whiteText) continue;

      const originalText = textHex ? `#${textHex[1].toLowerCase()}` : "#ffffff";
      const foreground = effectiveTextColor(originalText);
      const ratio = contrast(foreground, background);

      if (ratio < 4.5) {
        failures.push({
          file: path.relative(webRoot, file),
          foreground,
          background,
          ratio: ratio.toFixed(2),
          className: value.slice(0, 220),
        });
      }
    }
  }

  assert.deepEqual(failures, [], JSON.stringify(failures, null, 2));
});
