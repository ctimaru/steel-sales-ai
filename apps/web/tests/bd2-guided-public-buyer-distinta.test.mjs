import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (file) => fs.readFileSync(new URL(file, import.meta.url), "utf8");
const page = read("../app/(public)/distinta/page.tsx");
const builder = read("../components/buyer-distinta-builder.tsx");
const catalog = read("../lib/buyer-distinta-catalog.ts");
const knowledge = read("../lib/public-knowledge.ts");
const actions = read("../app/(public)/distinta/actions.ts");

test("BD2 loads only published Shared Knowledge tube references with bounded requests", () => {
  assert.match(knowledge, /listBuyerDistintaPublicDimensions/);
  assert.match(knowledge, /k6_public_tube_dimension_pages/);
  assert.match(knowledge, /p_limit: 350/);
  assert.match(page, /buildBuyerDistintaCatalogOptions\(publishedDimensions\)/);
  assert.match(page, /catalogOptions=\{catalogOptions\}/);
  assert.doesNotMatch(page + builder + catalog, /Padana|listino privato/i);
});

test("BD2 provides guided family, size and thickness selectors with editable description and weight", () => {
  assert.match(catalog, /round_tube/);
  assert.match(catalog, /square_tube/);
  assert.match(catalog, /rectangular_tube/);
  assert.match(catalog, /weightKgM: weight/);
  assert.match(builder, /chooseFamily/);
  assert.match(builder, /chooseSize/);
  assert.match(builder, /chooseCatalogOption/);
  assert.match(builder, /weightKgM: selected\.weightKgM/);
  assert.match(builder, /updateLine\(line\.id, \{ weightKgM: event\.target\.value \}\)/);
  assert.match(builder, /Compilazione libera/);
  assert.match(builder, /Riferimenti pubblici temporaneamente non disponibili/);
});

test("BD2 leaves explicit grade and quantity selection, public copy and private saving intact", () => {
  assert.match(builder, /buyer-grades/);
  assert.match(builder, /quantityMode/);
  assert.match(builder, /Copia distinta/);
  assert.match(builder, /saveBuyerDistinta/);
  assert.match(actions, /buyer_create_distinta_snapshot/);
});
