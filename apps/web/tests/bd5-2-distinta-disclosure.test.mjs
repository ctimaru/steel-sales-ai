import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (p) => fs.readFileSync(new URL(p, import.meta.url), "utf8");
const builder = read("../components/buyer-distinta-builder.tsx");
const css = read("../app/globals.css");
const calc = read("../lib/buyer-distinta.ts");

test("BD5.2 starts in compact view, with essential data always visible", () => {
  assert.match(builder, /const \[compactMode, setCompactMode\] = useState\(true\)/);
  assert.match(builder, /className="bd52-core-fields"/);
  assert.match(builder, /className="bd52-field bd52-field-description"/);
  assert.match(builder, /className="bd52-field bd52-field-weight"/);
  assert.match(builder, /className="bd52-field bd52-field-quantity"/);
  assert.match(builder, /className="bd52-field bd52-field-unit"/);
  assert.match(builder, /buyer-quantity-/);
  assert.match(builder, /line\.quantityMode === "bars"/);
  assert.match(builder, /formatNumber\(calc\.tonnes, 3\)/);
  assert.match(builder, /setCompactMode\(true\)/);
});

test("BD5.2 has separately expandable details for each row without losing values", () => {
  assert.match(builder, /const \[expandedRows, setExpandedRows\] = useState<Record<string, boolean>>\(\{\}\)/);
  assert.match(builder, /const detailOpen = expandedRows\[line\.id\] \?\? !compactMode/);
  assert.match(builder, /function toggleRowDetails\(id: string\)/);
  assert.match(builder, /aria-expanded=\{detailOpen\}/);
  assert.match(builder, /aria-controls=\{"buyer-details-" \+ line\.id\}/);
  assert.match(builder, /id=\{"buyer-details-" \+ line\.id\}/);
  assert.match(builder, /hidden=\{!detailOpen\}/);
  assert.match(builder, /onClick=\{\(\) => toggleRowDetails\(line\.id\)\}/);
  assert.match(builder, /setExpandedRows\(\(current\) => \(\{ \.\.\.current, \[id\]: !\(current\[id\] \?\? !compactMode\) \}\)\)/);
  assert.match(builder, /"Comprimi tutte le righe"/);
  assert.match(builder, /"Mostra tutti i dettagli"/);
  assert.match(builder, /delete next\[id\]/);
});

test("BD5.2 keeps catalog, technical options, optional target and notes in disclosure", () => {
  const start = builder.indexOf('className="bd52-detail-panel"');
  const end = builder.indexOf('!calc.complete && rowStage', start);
  assert.ok(start !== -1 && end > start);
  const panel = builder.slice(start, end);
  for (const token of ["chooseFamily", "chooseSize", "chooseCatalogOption", "buyer-standards", "buyer-grades", "buyer-finishes", "line.targetEurT", "calc.targetEurM", "line.note", "Scegli spessore"]) {
    assert.ok(panel.includes(token), "Missing field in details: " + token);
  }
  assert.match(builder, /const invalidTarget = line\.targetEurT\.trim\(\) !== "" && calc\.targetEurT === null/);
  assert.match(builder, /"Correggi target"/);
  assert.match(builder, /function duplicateLine\(id: string\)/);
  assert.match(builder, /saveBuyerDistinta/);
  assert.match(builder, /createBuyerRfqCampaign/);
  assert.match(builder, /copyDistinta/);
  assert.match(calc, /const targetValid =/);
});

test("BD5.2 adapts core grid and keeps collapsed panels actually hidden", () => {
  assert.match(css, /\.bd52-core-fields \{/);
  assert.match(css, /\.bd52-detail-panel\[hidden\] \{\s*display: none !important;/);
  assert.match(css, /@media \(max-width: 680px\)/);
  assert.match(css, /\.bd52-field-description \{\s*grid-column: 1 \/ -1;/);
  assert.match(css, /\.bd52-details-toggle/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /var\(--brand-primary\)/);
});
