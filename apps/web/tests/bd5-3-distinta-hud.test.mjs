import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (p) => fs.readFileSync(new URL(p, import.meta.url), "utf8");
const builder = read("../components/buyer-distinta-builder.tsx");
const css = read("../app/globals.css");
const contract = read("../lib/buyer-distinta.ts");

test("BD5.3 sticky HUD exposes live completion, metres and tonnes from the canonical totals", () => {
  assert.match(builder, /aria-label="Riepilogo in tempo reale della distinta"/);
  assert.match(builder, /className="bd53-hud"/);
  assert.match(builder, /aria-valuemax=\{lines\.length\}/);
  assert.match(builder, /aria-valuenow=\{totals\.completeLines\}/);
  assert.match(builder, /totals\.completeLines \/ lines\.length/);
  assert.match(builder, /formatNumber\(totals\.totalMeters, 2\)/);
  assert.match(builder, /formatNumber\(totals\.totalTonnes, 3\)/);
  assert.match(builder, /!allComplete \? <span className="bd53-hud-partial">Totali parziali/);
  assert.match(builder, /calculateBuyerDistintaTotals\(calculated\)/);
  assert.match(contract, /calculateBuyerDistintaTotals/);
});

test("BD5.3 contextual CTA never copies incomplete entries; reuse canonical copy action", () => {
  assert.match(builder, /onClick=\{allComplete \? copyDistinta : goToIncompleteRow\}/);
  assert.match(builder, /function goToIncompleteRow\(\)/);
  assert.match(builder, /calculated\.findIndex\(\(line\) => !line\.complete\)/);
  assert.match(builder, /if \(index < 0\) return/);
  assert.match(builder, /id=\{"buyer-row-" \+ line\.id\}/);
  assert.match(builder, /element\.focus\(\{ preventScroll: true \}\)/);
  assert.match(builder, /element\.scrollIntoView\(\{/);
  assert.match(builder, /setExpandedRows\(\(current\) => \(\{ \.\.\.current, \[row\.id\]: true \}\)\)/);
  assert.match(builder, /copyState === "copied"/);
  assert.match(builder, /"Copia distinta"/);
  assert.equal((builder.match(/className="bd53-hud"/g) ?? []).length, 1);
  assert.doesNotMatch(builder, /<p[^>]*>Pronta per l&apos;email/);
});

test("BD5.3 toolbar remains usable on mobile without a fixed overlay", () => {
  assert.match(css, /\.bd53-hud \{\s*position: sticky;/);
  assert.match(css, /top: calc\(0\.4rem \+ env\(safe-area-inset-top, 0px\)\)/);
  assert.match(css, /@media \(max-width: 720px\)/);
  assert.match(css, /\.bd53-hud-action/);
  assert.match(css, /min-height: 2\.8rem/);
  assert.match(css, /scroll-margin-top: 7rem/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.doesNotMatch(css.slice(css.indexOf("/* BD5.3")), /position: fixed;/);
  assert.doesNotMatch(css.slice(css.indexOf("/* BD5.3")), /animation:.*infinite/);
});

test("BD5.3 does not alter private save, RFQ, email or previous fast-entry flows", () => {
  assert.match(builder, /function duplicateLine\(id: string\)/);
  assert.match(builder, /function toggleRowDetails\(id: string\)/);
  assert.match(builder, /function addCatalogLine\(option: BuyerDistintaCatalogOption\)/);
  assert.match(builder, /saveBuyerDistinta\(\{ title, lines, documents \}\)/);
  assert.match(builder, /createBuyerRfqCampaign\(savedId\)/);
  assert.match(builder, /sendBuyerDistinta\(\{/);
  assert.match(builder, /buildBuyerDistintaPlainText\(title, valid, documents\)/);
});
