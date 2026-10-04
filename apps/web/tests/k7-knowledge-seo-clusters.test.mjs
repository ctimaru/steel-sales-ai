import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const tubeIndex = fs.readFileSync(
  new URL("../app/(public)/knowledge/tubes/page.tsx", import.meta.url),
  "utf8",
);
const exactDimension = fs.readFileSync(
  new URL("../app/(public)/knowledge/tubes/[slug]/page.tsx", import.meta.url),
  "utf8",
);
const familyHub = fs.readFileSync(
  new URL("../components/public-tube-family-hub.tsx", import.meta.url),
  "utf8",
);
const sizeHub = fs.readFileSync(
  new URL("../components/public-tube-size-hub.tsx", import.meta.url),
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
  new URL("../../../supabase/migrations/20260928144500_k7_knowledge_seo_clusters.sql", import.meta.url),
  "utf8",
);

test("K7 adds crawlable family discovery above exact dimensions", () => {
  assert.match(tubeIndex, /Esplora per famiglia e dimensione esterna/);
  assert.match(tubeIndex, /listPublicTubeFamilyHubs/);
  assert.match(tubeIndex, /tubeFamilyHubPath/);
  assert.match(familyHub, /Calcolo peso tubo tondo acciaio/);
  assert.match(familyHub, /Calcolo peso profilo quadro acciaio/);
  assert.match(familyHub, /Calcolo peso profilo rettangolare acciaio/);
});

test("K7 refuses thin outer-size hub pages", () => {
  assert.match(migration, /having count\(\*\)>=2/i);
  assert.match(migration, /variant_count<2/);
  assert.match(familyHub, /almeno due riferimenti canonici/);
  assert.match(sizeHub, /Spessori pubblicati/);
});

test("K7 size hubs compare multiple thicknesses with source-preserving links", () => {
  assert.match(sizeHub, /Peso per ogni spessore disponibile/);
  assert.match(sizeHub, /Barra 6 m/);
  assert.match(sizeHub, /Barra 12 m/);
  assert.match(sizeHub, /variant\.source_url/);
  assert.match(sizeHub, /variant\.dimension_slug/);
  assert.match(sizeHub, /Cluster correlati/);
});

test("K7 preserves structured SEO and breadcrumb hierarchy", () => {
  assert.match(familyHub, /CollectionPage/);
  assert.match(familyHub, /FAQPage/);
  assert.match(sizeHub, /CollectionPage/);
  assert.match(sizeHub, /FAQPage/);
  assert.match(sizeHub, /BreadcrumbList/);
  assert.match(sizeHub, /canonical: absoluteUrl/);
});

test("K7 exact dimension pages link upward into family and size clusters", () => {
  assert.match(exactDimension, /getTubeFamilyByProductFamily/);
  assert.match(exactDimension, /listPublicTubeSizeHubs/);
  assert.match(exactDimension, /Apri il confronto per spessore/);
  assert.match(exactDimension, /tubeFamilyHubPath/);
  assert.match(exactDimension, /tubeSizeHubPath/);
});

test("K7 scales dimension retrieval beyond one 500-row RPC page", () => {
  assert.match(data, /rpcPagedRows/);
  assert.match(data, /maxPages = 100/);
  assert.match(data, /p_offset: page \* pageSize/);
  assert.match(data, /listPublicTubeFamilyHubs/);
  assert.match(data, /listPublicTubeSizeHubs/);
  assert.match(data, /getPublicTubeSizeHub/);
});

test("K7 sitemap includes family hubs, size hubs and exact dimensions", () => {
  assert.match(sitemap, /familyHubEntries/);
  assert.match(sitemap, /sizeHubEntries/);
  assert.match(sitemap, /dimensionEntries/);
  assert.match(sitemap, /\/knowledge\/tubes\/\$\{hub\.family_slug\}/);
  assert.match(sitemap, /\/knowledge\/tubes\/\$\{hub\.family_slug\}\/\$\{hub\.size_slug\}/);
});
