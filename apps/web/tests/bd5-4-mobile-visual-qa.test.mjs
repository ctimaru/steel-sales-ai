import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (relative) => fs.readFileSync(new URL(relative, import.meta.url), "utf8");
const css = read("../app/globals.css");
const builder = read("../components/buyer-distinta-builder.tsx");
const creator = read("../components/buyer-tube-guided-creator.tsx");
const contract = read("../lib/buyer-distinta.ts");
const bd54 = css.slice(css.indexOf("/* BD5.4"));

test("BD5.4 mobile viewport rules keep input readable and touch controls >=44px", () => {
  assert.match(bd54, /@media \(max-width: 640px\)/);
  assert.match(bd54, /font-size: 16px/);
  assert.match(bd54, /\.bd54-page input:not\(\[type="checkbox"\]\)/);
  assert.match(bd54, /\.bd54-page select/);
  assert.match(bd54, /\.bd54-page textarea/);
  for (const selector of [
    ".bd6-suggestion", ".bd6-add-button", ".bd7-preview-item",
    ".bd7-doc-summary", ".bd8-icon-button", ".bd52-details-toggle", ".bd53-hud-action",
  ]) assert.ok(bd54.includes(selector), "Missing mobile target: " + selector);
  assert.match(bd54, /min-height: 44px/);
  assert.match(builder, /className="bd54-page space-y-4 sm:space-y-5"/);
});

test("BD5.4 no overlay/sideways scroll on 320-380px; HUD adapts and rows scroll into view", () => {
  assert.match(bd54, /@media \(max-width: 430px\)/);
  assert.match(bd54, /@media \(max-width: 380px\)/);
  assert.match(bd54, /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(bd54, /\.bd53-hud-action \{\s*grid-column: 1;\s*grid-row: 3;/);
  assert.match(bd54, /scroll-margin-top: 11\.5rem/);
  assert.match(bd54, /\.bd7-preview \{\s*position: static;/);
  assert.doesNotMatch(bd54, /position:\s*fixed/);
  assert.match(builder, /aria-label="Riepilogo in tempo reale della distinta"/);
});

test("BD5.4 suggestions preserve touch and arrow-key use with active-descendant announcements", () => {
  assert.match(creator, /aria-haspopup="listbox"/);
  assert.match(creator, /aria-autocomplete="list"/);
  assert.match(creator, /aria-activedescendant=\{/);
  assert.match(creator, /id=\{listId \+ "-option-" \+ index\}/);
  assert.match(creator, /onPointerDown=\{\(event\) => event.preventDefault\(\)\}/);
  assert.match(creator, /event\.key === "ArrowDown"/);
  assert.match(creator, /event\.key === "ArrowUp"/);
  assert.match(creator, /event\.key === "Enter"/);
  assert.match(bd54, /max-height: min\(36dvh, 11rem\)/);
  assert.match(bd54, /@media \(hover: none\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
});

test("BD5.4 leaves mixed-norm row editing and request exports unchanged", () => {
  assert.match(builder, /function changeLineStandard\(id: string, standard: string\)/);
  assert.match(builder, /aria-label=\{`Norma della riga/);
  assert.match(builder, /onChange=\{\(event\) => changeLineStandard\(line\.id, event\.target\.value\)\}/);
  assert.match(builder, /buildBuyerDistintaPlainText\(title, valid, documents\)/);
  assert.match(builder, /saveBuyerDistinta\(\{ title, lines, documents \}\)/);
  assert.match(builder, /createBuyerRfqCampaign\(savedId\)/);
  assert.match(contract, /calculateBuyerDistintaTotals/);
});
