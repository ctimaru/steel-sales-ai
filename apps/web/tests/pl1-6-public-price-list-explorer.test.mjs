import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const catalogue = fs.readFileSync(
  new URL("../app/(public)/listini/page.tsx", import.meta.url),
  "utf8",
);
const detail = fs.readFileSync(
  new URL("../app/(public)/listini/[versionId]/page.tsx", import.meta.url),
  "utf8",
);
const explorer = fs.readFileSync(
  new URL("../components/public-price-list-explorer.tsx", import.meta.url),
  "utf8",
);
const home = fs.readFileSync(
  new URL("../app/page.tsx", import.meta.url),
  "utf8",
);
const schoolLayout = fs.readFileSync(
  new URL("../app/(public)/knowledge/layout.tsx", import.meta.url),
  "utf8",
);
const sitemap = fs.readFileSync(
  new URL("../app/sitemap.ts", import.meta.url),
  "utf8",
);

test("PL1.6 keeps the price-list explorer engine but removes public catalogue promotion", () => {
  assert.match(home, /href="\/distinta"/);
  assert.match(home, />\s*Crea distinta\s*</);
  assert.match(schoolLayout, /href="\/distinta"/);
  assert.match(schoolLayout, /Crea distinta/);
  assert.match(catalogue, /redirect\("\/distinta"\)/);
});

test("PL1.6 explorer keeps Base and fixed Extra separate and applies discount only to Base", () => {
  assert.match(explorer, /row\.base_eur_m/);
  assert.match(explorer, /row\.fixed_extra_eur_m/);
  assert.match(explorer, /base \* \(1 - discountPct \/ 100\) \+ extra/);
  assert.match(explorer, /discounted_base_plus_fixed_extra/);
  assert.match(explorer, /Sconto temporaneo · non viene salvato/);
});

test("PL1.6 only calculates €/t when the governed readiness contract allows it", () => {
  assert.match(explorer, /row\.price_per_t_ready/);
  assert.match(explorer, /row\.resolved_weight_kg_m/);
  assert.match(explorer, /return \(netEurM \/ weight\) \* 1000/);
  assert.match(explorer, /readinessLabel\(row\.price_per_t_status\)/);
  assert.match(detail, /Nessun peso viene inventato/);
});

test("PL1.6 provides responsive filtering and bounded rendering", () => {
  assert.match(explorer, /Cerca misura/);
  assert.match(explorer, /Forma/);
  assert.match(explorer, /Grado/);
  assert.match(explorer, /Finitura/);
  assert.match(explorer, /const PAGE_SIZE = 75/);
  assert.match(explorer, /hidden overflow-hidden.*lg:block/);
  assert.match(explorer, /grid gap-3 lg:hidden/);
});

test("PL1.6 keeps internal previews noindex and only sitemaps governed public versions", () => {
  assert.match(detail, /version\.is_internal_preview/);
  assert.match(detail, /index: false, follow: false/);
  assert.match(sitemap, /listPublicPriceLists/);
  assert.match(sitemap, /filter\(\(priceList\) => !priceList\.is_internal_preview\)/);
  assert.match(sitemap, /\/listini\/\$\{priceList\.version_id\}/);
});
