import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (file) => fs.readFileSync(new URL(file, import.meta.url), "utf8");
const builder = read("../components/buyer-distinta-builder.tsx");
const css = read("../app/globals.css");
const calculator = read("../lib/buyer-distinta.ts");

test("BD5.1 rows have a clear hierarchy, state-aware badge, and compact actions", () => {
  assert.match(builder, /const rowStage = calc\.complete \? "complete" : isUntouchedLine\(line\) \? "empty" : "pending"/);
  assert.match(builder, /data-stage=\{rowStage\}/);
  assert.match(builder, /className="bd5-row-card"/);
  assert.match(builder, /className="bd5-row-header"/);
  assert.match(builder, /className="bd5-row-number"/);
  assert.match(builder, /className="bd5-status-badge"/);
  assert.match(builder, /className="bd5-row-actions/);
  assert.match(builder, /className="bd5-row-body"/);
  assert.match(builder, /"Da iniziare"/);
  assert.match(builder, /"Da completare"/);
  assert.match(builder, /"Completa"/);
  assert.match(builder, /aria-label=\{\`Riga/);
  assert.match(builder, /aria-label=\{\`Rimuovi riga/);
  assert.match(builder, /Articoli in distinta/);
  assert.match(builder, /totals\.completeLines/);
});

test("BD5.1 visual treatments are semantic, responsive and reduced-motion safe", () => {
  assert.match(css, /\.bd5-row-card \{/);
  assert.match(css, /\.bd5-row-card\[data-stage="complete"\]/);
  assert.match(css, /\.bd5-row-card\[data-stage="pending"\]/);
  assert.match(css, /--bd5-stage-color: var\(--semantic-success\)/);
  assert.match(css, /--bd5-stage-color: var\(--semantic-warning\)/);
  assert.match(css, /box-shadow: 0 10px 28px/);
  assert.match(css, /\.bd5-row-card:focus-within/);
  assert.match(css, /@media \(max-width: 639px\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /\.bd5-row-card:hover/);
  assert.doesNotMatch(css.slice(css.indexOf("/* BD5.1")), /animation:\s*.*infinite/);
});

test("BD5.1 leaves BD4 speed and commercial contracts intact", () => {
  assert.match(builder, /searchBuyerDistintaCatalog/);
  assert.match(builder, /function duplicateLine\(id: string\)/);
  assert.match(builder, /\{compactMode \? \(/);
  assert.match(builder, /Target €\/t \(facoltativo\)/);
  assert.match(builder, /saveBuyerDistinta/);
  assert.match(builder, /createBuyerRfqCampaign/);
  assert.match(builder, /copyDistinta/);
  assert.match(calculator, /const targetValid =/);
});
