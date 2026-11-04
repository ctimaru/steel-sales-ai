import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { getSchoolContent1Guide, SCHOOL_CONTENT1_REVIEW_DATE } from "../lib/school-content1-guides.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const read = (path) => readFileSync(root + path, "utf8");
const samples = {
  standard: ["en-10219", "en-10210", "en-10217-1"],
  grade: ["s355j2h", "s355nh", "p265gh"],
};

test("SCHOOL-CONTENT1 — exactly six documented editorial overlays", () => {
  assert.equal(SCHOOL_CONTENT1_REVIEW_DATE, "2026-11-02");
  for (const [kind, slugs] of Object.entries(samples)) {
    for (const slug of slugs) {
      const guide = getSchoolContent1Guide(kind, slug);
      assert.ok(guide, kind + "/" + slug);
      assert.ok(guide.heading.length >= 20);
      assert.ok(guide.takeaway.length >= 90);
      assert.equal(guide.checks.length, 3);
      assert.ok(guide.checks.every((item) => item.length >= 40));
      assert.ok(guide.editionNote.length >= 50);
      assert.ok(guide.sources.length >= 1);
      assert.ok(guide.compare.href.startsWith("/knowledge/"));
      for (const source of guide.sources) {
        const url = new URL(source.url);
        assert.equal(url.protocol, "https:");
        assert.ok(source.label.length >= 10);
        assert.ok(/(?:^|\.)((store\.uni\.com)|(www\.din\.de)|(www\.morandispa\.it)|(www\.tatasteeluk\.com))$/.test(url.hostname));
      }
    }
  }
});

test("SCHOOL-CONTENT1 — never show unpublished, prototype or guessed entries", () => {
  assert.equal(getSchoolContent1Guide("standard", "en-99999"), null);
  assert.equal(getSchoolContent1Guide("grade", "toString"), null);
  assert.equal(getSchoolContent1Guide("standard", "__proto__"), null);
  assert.equal(getSchoolContent1Guide("grade", "unknown"), null);
  assert.equal(getSchoolContent1Guide("grade", ""), null);
  assert.equal(getSchoolContent1Guide("unknown", "s355nh"), null);
});

test("SCHOOL-CONTENT1 — integrated only into existing K2 public detail pages", () => {
  for (const path of [
    "app/(italian)/(public)/knowledge/norme/[slug]/page.tsx",
    "app/(italian)/(public)/knowledge/gradi/[slug]/page.tsx",
  ]) {
    const page = read(path);
    assert.match(page, /getSchoolContent1Guide\(/);
    assert.match(page, /<SchoolContent1Panel guide={practicalGuide}/);
    assert.match(page, /id: "school-practical-guide"/);
    assert.match(page, /if \(!(?:standard|grade)\) notFound\(\)/);
  }
  const panel = read("components/school-content1-panel.tsx");
  assert.match(panel, /aria-label="Approfondimento tecnico operativo"/);
  assert.match(panel, /noopener noreferrer/);
  assert.match(panel, /non riproduzione del testo normativo/);
  assert.doesNotMatch(panel, /\/api\/|supabase|RFQ|commercial\/knowledge/);
});

test("SCHOOL-CONTENT1 — separate published UNI editions and draft revisions", () => {
  for (const slug of ["en-10219", "en-10210"]) {
    const guide = getSchoolContent1Guide("standard", slug);
    assert.match(guide.editionNote, /in vigore in Italia/);
    assert.match(guide.editionNote, /prEN/);
  }
  assert.match(getSchoolContent1Guide("grade", "p265gh").editionNote, /errata corrige/);
});
