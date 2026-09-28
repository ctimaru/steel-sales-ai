import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const indexPage = fs.readFileSync(
  new URL("../app/(public)/knowledge/norme/page.tsx", import.meta.url),
  "utf8",
);
const detailPage = fs.readFileSync(
  new URL("../app/(public)/knowledge/norme/[slug]/page.tsx", import.meta.url),
  "utf8",
);
const data = fs.readFileSync(
  new URL("../lib/public-knowledge.ts", import.meta.url),
  "utf8",
);
const migration = fs.readFileSync(
  new URL("../../supabase/migrations/20260928121000_k3_public_standards_catalog.sql", import.meta.url),
  "utf8",
);

test("K3 publishes the initial six-standard editorial cluster", () => {
  for (const slug of [
    "en-10210",
    "en-10219",
    "en-10216-2",
    "en-10217-1",
    "en-10217-2",
    "en-10224",
  ]) {
    assert.match(migration, new RegExp(slug.replaceAll("-", "\\-")));
  }
  assert.match(migration, /page_status='published'/);
  assert.match(migration, /last_reviewed_at='2026-09-28'/);
  assert.match(migration, /source_references=jsonb_build_array/);
});

test("K3 catalog is organized by user intent instead of a flat technical dump", () => {
  assert.match(indexPage, /Profilati cavi strutturali/);
  assert.match(indexPage, /Tubi per impieghi in pressione/);
  assert.match(indexPage, /Acqua e liquidi acquosi/);
  assert.match(indexPage, /Cerca per codice o argomento/);
  assert.match(indexPage, /Rivista/);
  assert.match(indexPage, /application_category/);
});

test("K3 standard pages expose trust and freshness without leaking internal provenance", () => {
  assert.match(detailPage, /Riferimenti ufficiali consultati/);
  assert.match(detailPage, /last_reviewed_at/);
  assert.match(detailPage, /source_references/);
  assert.match(detailPage, /target="_blank"/);
  assert.match(detailPage, /Nota sull&apos;uso delle norme tecniche/);
  assert.doesNotMatch(detailPage, /knowledge_source_id|source_locator|service_role/);
});

test("K3 standard pages add related standards and structured SEO data", () => {
  assert.match(detailPage, /related_standard_pages/);
  assert.match(detailPage, /Norme correlate/);
  assert.match(detailPage, /FAQPage/);
  assert.match(detailPage, /TechArticle/);
  assert.match(detailPage, /dateModified/);
  assert.match(detailPage, /citation/);
});

test("K3 public data contract carries editorial sources and review freshness", () => {
  assert.match(data, /KnowledgeSourceReference/);
  assert.match(data, /PublicKnowledgeRelatedStandardPage/);
  assert.match(data, /source_references: KnowledgeSourceReference\[\]/);
  assert.match(data, /related_standard_pages: PublicKnowledgeRelatedStandardPage\[\]/);
  assert.match(data, /last_reviewed_at: string/);
});
