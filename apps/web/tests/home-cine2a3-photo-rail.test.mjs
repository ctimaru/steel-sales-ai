import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import test from "node:test";

const load = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const rail = load("../components/public-photographic-tool-rail.tsx");
const css = load("../components/public-photographic-tool-rail.module.css");
const it = load("../app/(italian)/page.tsx");
const en = load("../app/(english)/en/page.tsx");
const img = new URL("../public/home-cine2a3-five-photo-atlas.webp", import.meta.url);

test("CINE2A.3 local image atlas has exact WebP source signature and 50KB cap", () => {
  assert.ok(statSync(img).size <= 50_000, "Five photographic scenes must stay inside one 50KB payload");
  const bytes = readFileSync(img);
  assert.equal(bytes.toString("ascii", 0, 4), "RIFF");
  assert.equal(bytes.toString("ascii", 8, 12), "WEBP");
});

test("CINE2A.3 has five unique photographic frames, lazy and without fake UI", () => {
  for (const key of ["calculator", "distinta", "rfq", "network", "school"]) {
    assert.match(rail, new RegExp('"' + key + '"'));
  }
  assert.match(rail, /photoNames\[i\]/);
  assert.match(rail, /i \* 100/);
  assert.match(rail, /loading="lazy"/);
  assert.match(rail, /unoptimized/);
  assert.match(rail, /alt=""/);
  assert.doesNotMatch(rail, /useState|useEffect|onClick=|<iframe|<video|<canvas|kg\/m|10,000\+/);
  assert.match(css, /\.photoAtlas/);
  assert.match(css, /height: 500%/);
});

test("CINE2A.3 preserves real public tools and governed private RFQ access in both languages", () => {
  for (const segment of [
    '/knowledge/tubes?source=home&surface=tool_rail#calcolatore-pesi',
    '/en/knowledge/tubes',
    '/distinta', '/en/distinta', '/login', '/en/login',
    '#network', '/en/network', '/knowledge', '/en/knowledge',
  ]) assert.ok(rail.includes('"' + segment + '"'), 'Missing grounded route ' + segment);
  assert.doesNotMatch(rail, /href: ["']\/(?:rfq-hub|platform)(?:["'/]|\b)/);
  assert.match(rail, /ACCESSO AZIENDALE/);
  assert.match(rail, /COMPANY ACCESS/);
  assert.match(rail, /ANTEPRIMA PUBBLICA/);
  assert.match(rail, /PUBLIC PREVIEW/);
});

test("CINE2A.3 hero remains calculator-first and tool rail is included once on IT/EN", () => {
  for (const [page, locale] of [[it, "it"], [en, "en"]]) {
    assert.equal((page.match(/<PublicPhotographicToolRail /g) ?? []).length, 1);
    assert.ok(page.indexOf('<PublicCinematicHero locale="' + locale + '" />') <
      page.indexOf('<PublicPhotographicToolRail locale="' + locale + '" />'));
  }
  assert.match(css, /scroll-snap-type: x mandatory/);
  assert.match(css, /focus-visible/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.doesNotMatch(rail, /images\.pexels\.com|remote|supplier\s*price/i);
});
