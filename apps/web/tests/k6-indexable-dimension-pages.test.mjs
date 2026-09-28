import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const detail = fs.readFileSync(
  new URL("../app/(public)/knowledge/tubes/[slug]/page.tsx", import.meta.url),
  "utf8",
);
const calculator = fs.readFileSync(
  new URL("../components/public-tube-weight-calculator.tsx", import.meta.url),
  "utf8",
);
const tubesIndex = fs.readFileSync(
  new URL("../app/(public)/knowledge/tubes/page.tsx", import.meta.url),
  "utf8",
);
const data = fs.readFileSync(
  new URL("../lib/public-knowledge.ts", import.meta.url),
  "utf8",
);
const sitemap = fs.readFileSync(
  new URL("../app/sitemap.ts", import.meta.url),
  "utf8",
);
const migration = fs.readFileSync(
  new URL("../../../supabase/migrations/20260928140000_k6_indexable_dimension_pages.sql", import.meta.url),
  "utf8",
);

test("K6 creates deterministic SEO slugs for all three dimension families", () => {
  assert.match(migration, /tondo-/);
  assert.match(migration, /quadro-/);
  assert.match(migration, /rettangolare-/);
  assert.match(migration, /tondo-406-4x6-3/);
  assert.match(migration, /v_total<>109/);
  assert.match(migration, /v_unique_slugs<>v_total/);
});

test("K6 dimension pages answer exact weight queries with useful derived values", () => {
  assert.match(detail, /Peso al metro/);
  assert.match(detail, /Barra 6 m/);
  assert.match(detail, /Barra 12 m/);
  assert.match(detail, /Metri per tonnellata/);
  assert.match(detail, /bars6PerTonne/);
  assert.match(detail, /bars12PerTonne/);
  assert.match(detail, /Scostamento pubblicato \/ teorico/);
  assert.match(detail, /Apri questa misura nel calcolatore/);
});

test("K6 dimension pages are crawlable, sourced and internally linked", () => {
  assert.match(detail, /generateMetadata/);
  assert.match(detail, /canonical: absoluteUrl/);
  assert.match(detail, /TechArticle/);
  assert.match(detail, /FAQPage/);
  assert.match(detail, /BreadcrumbList/);
  assert.match(detail, /citation: dimension\.source_url/);
  assert.match(detail, /Dimensioni correlate/);
  assert.match(detail, /\/knowledge\/norme/);
  assert.match(detail, /\/knowledge\/gradi/);
});

test("K6 adds every public dimension URL to the sitemap", () => {
  assert.match(sitemap, /listPublicTubeDimensionPages/);
  assert.match(sitemap, /dimensionEntries/);
  assert.match(sitemap, /\/knowledge\/tubes\/\$\{dimension\.dimension_slug\}/);
});

test("K6 calculator becomes the discovery index for dimension detail pages", () => {
  assert.match(tubesIndex, /listPublicTubeDimensionPages/);
  assert.match(calculator, /reference\.dimension_slug/);
  assert.match(calculator, /\/knowledge\/tubes\/\$\{reference\.dimension_slug\}/);
  assert.match(tubesIndex, /initialValues/);
});

test("K6 public data stays behind anonymous-safe RPC contracts", () => {
  assert.match(data, /PublicTubeDimensionSummary/);
  assert.match(data, /PublicTubeDimension/);
  assert.match(data, /k6_public_tube_dimension_pages/);
  assert.match(data, /k6_public_tube_dimension_page/);
  assert.match(migration, /security definer/);
  assert.match(migration, /grant execute.*anon/s);
  assert.doesNotMatch(detail + calculator + tubesIndex, /steel_geometries|steel_weight_references|knowledge_sources|service_role/);
});
