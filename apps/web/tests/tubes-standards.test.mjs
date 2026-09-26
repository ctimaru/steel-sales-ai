import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const page = fs.readFileSync(
  new URL("../app/(workspace)/tubi-norme/page.tsx", import.meta.url),
  "utf8",
);
const shell = fs.readFileSync(
  new URL("../components/app-shell.tsx", import.meta.url),
  "utf8",
);

test("Tubi & Norme is first-class workspace navigation", () => {
  assert.match(shell, /href: appRoutes\.company\.tubesStandards/);
  assert.match(shell, /label: "Tubi & Norme"/);
  assert.match(page, /Riferimenti tecnici/);
  assert.match(page, /Tabella dimensionale/);
});

test("calculator uses exact-scope effective canonical weight only", () => {
  assert.match(page, /p1_shared_steel_effective_weight_catalog/);
  assert.match(page, /effective_status === "canonical_available"/);
  assert.match(page, /Non supportato/);
  assert.match(page, /nessun valore stimato automaticamente/);
  assert.match(page, /\(pricePerTonne \* weight\) \/ 1000/);
  assert.doesNotMatch(page, /weight_method === "published".*pricePerMeter/s);
  assert.doesNotMatch(page, /weight_method === "calculated".*pricePerMeter/s);
});

test("Tubi & Norme exposes provenance and coverage semantics", () => {
  assert.match(page, /knowledge_sources/);
  assert.match(page, /source_key,provider,source_class/);
  assert.match(page, /Normativa completa/);
  assert.match(page, /Copertura parziale/);
  assert.match(page, /is_normative_complete/);
});
