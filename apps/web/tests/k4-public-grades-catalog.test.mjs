import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const indexPage = fs.readFileSync(
  new URL("../app/(public)/knowledge/gradi/page.tsx", import.meta.url),
  "utf8",
);
const detailPage = fs.readFileSync(
  new URL("../app/(public)/knowledge/gradi/[slug]/page.tsx", import.meta.url),
  "utf8",
);
const data = fs.readFileSync(
  new URL("../lib/public-knowledge.ts", import.meta.url),
  "utf8",
);
const migration = fs.readFileSync(
  new URL("../../../supabase/migrations/20260928124500_k4_public_grades_catalog.sql", import.meta.url),
  "utf8",
);

test("K4 publishes the initial ten-grade editorial cluster", () => {
  for (const slug of [
    "p235gh",
    "p265gh",
    "16mo3",
    "p235tr1",
    "p235tr2",
    "p265tr1",
    "p265tr2",
    "s355j2h",
    "s355nh",
    "s355nlh",
  ]) {
    assert.match(migration, new RegExp(slug));
  }
  assert.match(migration, /page_status='published'/);
  assert.match(migration, /last_reviewed_at='2026-09-28'/);
  assert.match(migration, /source_references=jsonb_build_array/);
});

test("K4 grade catalog is organized by user intent and supports standard-code discovery", () => {
  assert.match(indexPage, /Pressione e temperatura elevata/);
  assert.match(indexPage, /Pressione a temperatura ambiente/);
  assert.match(indexPage, /Profilati cavi strutturali/);
  assert.match(indexPage, /Cerca grado, materiale o norma/);
  assert.match(indexPage, /EN 10217-1/);
  assert.match(indexPage, /Rivista/);
});

test("K4 grade pages expose trust, freshness and related grades", () => {
  assert.match(detailPage, /Riferimenti consultati/);
  assert.match(detailPage, /last_reviewed_at/);
  assert.match(detailPage, /source_references/);
  assert.match(detailPage, /related_grade_pages/);
  assert.match(detailPage, /Materiali utili da confrontare/);
  assert.match(detailPage, /target="_blank"/);
  assert.doesNotMatch(detailPage, /knowledge_source_id|source_locator|service_role/);
});

test("K4 grade pages preserve evidence semantics and structured SEO", () => {
  assert.match(detailPage, /applicabilityLabel/);
  assert.match(detailPage, /Gamma produttore o fornitore/);
  assert.match(detailPage, /FAQPage/);
  assert.match(detailPage, /TechArticle/);
  assert.match(detailPage, /dateModified/);
  assert.match(detailPage, /citation/);
  assert.match(detailPage, /non autorizzano\s+automaticamente una sostituzione/);
});

test("K4 public data contract carries grade sources, related pages and review freshness", () => {
  assert.match(data, /PublicKnowledgeRelatedGradePage/);
  assert.match(data, /source_references: KnowledgeSourceReference\[\]/);
  assert.match(data, /related_grade_pages: PublicKnowledgeRelatedGradePage\[\]/);
  assert.match(data, /last_reviewed_at: string/);
});
