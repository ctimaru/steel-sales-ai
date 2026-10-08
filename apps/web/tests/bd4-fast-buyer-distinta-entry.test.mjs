import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (relative) => fs.readFileSync(new URL(relative, import.meta.url), "utf8");
const builder = read("../components/buyer-distinta-builder.tsx");
const catalog = read("../lib/buyer-distinta-catalog.ts");
const calculator = read("../lib/buyer-distinta.ts");
const page = read("../app/(public)/distinta/page.tsx");

test("BD4 fast search only uses the published Knowledge catalogue, with bounded results", () => {
  assert.match(builder, /searchBuyerDistintaCatalog\(catalogOptions, quickQuery, 8\)/);
  assert.match(builder, /Aggiunta rapida degli articoli/);
  assert.match(catalog, /function normalizeBuyerDimensionQuery/);
  assert.match(catalog, /export function searchBuyerDistintaCatalog/);
  assert.match(catalog, /return terms\.every\(\(term\) => haystack\.includes\(term\)\)/);
  assert.match(catalog, /\.slice\(0, maxResults\)/);
  assert.match(catalog, /replace\(\/\[×\*\]\//);
  assert.match(page, /listBuyerDistintaPublicDimensions/);
  assert.doesNotMatch(builder + catalog, /Padana|base_eur_m|discount_pct/i);
});

test("BD4 quick add preserves edits, preloads only description and kg/m and focuses quantity", () => {
  assert.match(builder, /function isUntouchedLine\(/);
  assert.match(builder, /lines\.length === 1 && isUntouchedLine\(lines\[0\]\)/);
  assert.match(builder, /description: option\.description/);
  assert.match(builder, /weightKgM: option\.weightKgM/);
  assert.match(builder, /\.\.\.blankLine\(id\)/);
  assert.match(builder, /focusQuantityId\.current = id/);
  assert.match(builder, /input\.focus\(\{ preventScroll: true \}\)/);
  assert.match(builder, /prefers-reduced-motion/);
  assert.match(builder, /setCompactMode\(true\)/);
});

test("BD4 duplicate retains specifications, clears quantity and enforces 500-line limit", () => {
  assert.match(builder, /function duplicateLine\(id: string\)/);
  assert.match(builder, /const copy = \{ \.\.\.source, id: duplicateId, quantity: "" \}/);
  assert.match(builder, /\[duplicateId\]: \{ \.\.\.selection \}/);
  assert.match(builder, /lines\.length >= 500/);
  assert.match(builder, /disabled=\{!line\.description\.trim\(\) \|\| lines\.length >= 500\}/);
  assert.match(builder, /Duplica articolo/);
});

test("BD4 compact editing preserves primary fields and optional details", () => {
  assert.match(builder, /aria-pressed=\{!compactMode\}/);
  assert.match(builder, /const detailOpen = expandedRows\[line\.id\] \?\? !compactMode/);
  assert.match(builder, /Dettagli e opzioni/);
  assert.match(builder, /onChange=\{\(event\) => updateLine\(line\.id, \{ weightKgM: event\.target\.value \}\)\}/);
  assert.match(builder, /Target €\/t \(facoltativo\)/);
  assert.match(builder, /createBuyerRfqCampaign/);
  assert.match(builder, /saveBuyerDistinta/);
  assert.match(builder, /copyDistinta/);
  assert.match(calculator, /const targetValid =/);
});
