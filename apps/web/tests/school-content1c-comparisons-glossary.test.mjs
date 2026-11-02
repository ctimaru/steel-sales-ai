import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  SCHOOL_CONTENT1C_PATH, SCHOOL_CONTENT1C_REVIEW_DATE,
  schoolComparisons, schoolGlossary,
  getSchoolComparison, getSchoolGlossaryEntry
} from "../lib/school-content1c-guides.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const read = (path) => readFileSync(root + path, "utf8");

test("SCHOOL-CONTENT1.C — four authored comparisons with official reference coverage", () => {
  assert.equal(SCHOOL_CONTENT1C_PATH, "/knowledge/articoli/confronti-glossario");
  assert.equal(SCHOOL_CONTENT1C_REVIEW_DATE, "2026-11-02");
  assert.equal(schoolComparisons.length, 4);
  assert.deepEqual(schoolComparisons.map(v => v.id), [
    "en-10210-vs-en-10219", "documenti-en-10204", "saldato-vs-seamless", "tolleranze-peso-teorico",
  ]);
  for (const guide of schoolComparisons) {
    assert.ok(guide.title.length > 20);
    assert.ok(guide.rows.length >= 3);
    assert.ok(guide.takeaway.length > 60);
    assert.ok(guide.sources.length >= 1);
    assert.ok(guide.links.length >= 1);
    for (const row of guide.rows) {
      assert.ok(row.label.length > 2);
      assert.ok(row.left.length > 25);
      assert.ok(row.right.length > 25);
    }
    for (const source of guide.sources) {
      const url = new URL(source.url);
      assert.equal(url.protocol, "https:");
      assert.ok(url.hostname === "store.uni.com" || url.hostname === "bssa.org.uk");
    }
    for (const link of guide.links) assert.match(link.href, /^\/knowledge\//);
    assert.deepEqual(getSchoolComparison(guide.id), guide);
  }
  assert.equal(getSchoolComparison("missing"), null);
  assert.equal(getSchoolComparison("__proto__"), null);
});

test("SCHOOL-CONTENT1.C — 16 glossary terms, real links, no synthetic equivalences", () => {
  assert.equal(schoolGlossary.length, 16);
  assert.equal(new Set(schoolGlossary.map(v => v.term)).size, schoolGlossary.length);
  assert.ok(schoolGlossary.some(v => v.term === "CHS"));
  assert.ok(schoolGlossary.some(v => v.term === "SHS"));
  assert.ok(schoolGlossary.some(v => v.term === "RHS"));
  assert.ok(schoolGlossary.some(v => v.term === "Certificato 3.1"));
  assert.ok(schoolGlossary.some(v => v.term === "Certificato 3.2"));
  for (const item of schoolGlossary) {
    assert.ok(item.definition.length >= 45, item.term);
    assert.match(item.href, /^\/knowledge\//);
    assert.deepEqual(getSchoolGlossaryEntry(item.term), item);
  }
  assert.equal(getSchoolGlossaryEntry("unknown"), null);
});

test("SCHOOL-CONTENT1.C — one route, discoverable from editorial index and published K2 panels", () => {
  const route = read("app/(italian)/(public)/knowledge/articoli/confronti-glossario/page.tsx");
  const index = read("app/(italian)/(public)/knowledge/articoli/page.tsx");
  const panel = read("components/school-content1-panel.tsx");
  const sitemap = read("app/sitemap.ts");
  assert.match(route, /SchoolHero/);
  assert.match(route, /SchoolReadingIndex/);
  assert.match(route, /schoolComparisons\.map/);
  assert.match(route, /schoolGlossary\.map/);
  assert.match(route, /DefinedTermSet/);
  assert.match(route, /TechArticle/);
  assert.match(route, /canonical: absoluteUrl\(SCHOOL_CONTENT1C_PATH\)/);
  assert.match(route, /noopener noreferrer/);
  assert.match(index, /href="\/knowledge\/articoli\/confronti-glossario"/);
  assert.match(panel, /href="\/knowledge\/articoli\/confronti-glossario"/);
  assert.match(sitemap, /url: absoluteUrl\(SCHOOL_CONTENT1C_PATH\)/);
  assert.doesNotMatch(route, /supabase|\/api\/|tenant|commercial\/knowledge/);
});

test("SCHOOL-CONTENT1.C — no commercial price or invented engineering tolerance", () => {
  const guide = schoolComparisons.find(v => v.id === "tolleranze-peso-teorico");
  const textContent = JSON.stringify(guide);
  assert.match(textContent, /non è un certificato di peso reale/i);
  assert.doesNotMatch(textContent, /±\s*\d/);
  const docs = schoolComparisons.find(v => v.id === "documenti-en-10204");
  assert.equal(docs.rows.length, 4);
  assert.match(docs.takeaway, /non è, per definizione/);
  assert.match(JSON.stringify(docs), /non specifico/);
  assert.match(JSON.stringify(docs), /controllo specifico/);
  assert.match(JSON.stringify(schoolComparisons[0]), /10210-2:2019/);
  assert.match(JSON.stringify(schoolComparisons[0]), /10219-2:2019/);
});
