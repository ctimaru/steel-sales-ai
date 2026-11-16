import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const detailPage = fs.readFileSync(
  new URL("../app/(public)/knowledge/gradi/[slug]/page.tsx", import.meta.url),
  "utf8",
);
const data = fs.readFileSync(new URL("../lib/public-knowledge.ts", import.meta.url), "utf8");
const migration = fs.readFileSync(
  new URL(
    "../../../supabase/migrations/20261115220000_seo_grade1_grade_technical_data.sql",
    import.meta.url,
  ),
  "utf8",
);

const grades = {
  p235gh: "P235GH",
  p265gh: "P265GH",
  "16mo3": "16Mo3",
  p235tr1: "P235TR1",
  p235tr2: "P235TR2",
  p265tr1: "P265TR1",
  p265tr2: "P265TR2",
  s355j2h: "S355J2H",
  s355nh: "S355NH",
  s355nlh: "S355NLH",
};

function payloads(slug) {
  const start = migration.indexOf(`select pg_temp.seo_grade1_apply(\n  '${slug}'`);
  assert.notEqual(start, -1, `missing call for ${slug}`);
  const block = migration.slice(start, migration.indexOf("\n);\n", start));
  return [...block.matchAll(/^  '(\[.*\])'::jsonb,?$/gm)].map((match) =>
    JSON.parse(match[1].replaceAll("''", "'")),
  );
}

test("SEO-GRADE1 enriches all ten published grade pages with sourced tables", () => {
  for (const [slug, designation] of Object.entries(grades)) {
    const [sections, faq, sources] = payloads(slug);
    assert.equal(sections.length, 3);
    assert.equal(sections[0].heading, `Caratteristiche meccaniche di ${designation}`);
    assert.equal(sections[1].heading, `Composizione chimica di ${designation}`);
    for (const section of sections) {
      assert.ok(section.body.length > 80);
      assert.ok(section.table.columns.length >= 2);
      assert.ok(section.table.rows.length >= 3);
      for (const row of section.table.rows) {
        assert.equal(row.length, section.table.columns.length);
      }
    }
    assert.equal(faq.length, 2);
    assert.equal(sources.length, 1);
    assert.match(sources[0].url, /^https:\/\/www\.mannesmann\.com\//);
    assert.match(sources[0].status, /non normativa completa/);
  }
});

test("SEO-GRADE1 keeps the editorial trust contract", () => {
  assert.match(migration, /fanno fede la norma di prodotto e il certificato del materiale/);
  assert.match(migration, /non rende due gradi equivalenti o sostituibili/);
  assert.doesNotMatch(migration, /alter table|create policy|grant |security definer/i);
  assert.match(migration, /p_sections \|\| p\.editorial_sections/);
  assert.match(migration, /not exists \(/);
});

test("SEO-GRADE1 renders section tables accessibly on the grade page", () => {
  const table = fs.readFileSync(
    new URL("../components/knowledge-section-table.tsx", import.meta.url),
    "utf8",
  );
  assert.match(data, /export type KnowledgeEditorialTable/);
  assert.match(data, /table\?: KnowledgeEditorialTable/);
  assert.match(detailPage, /<KnowledgeSectionTable table=\{section\.table\} \/>/);
  assert.match(table, /table\?\.columns\?\.length/);
  assert.match(table, /<caption className="sr-only">/);
  assert.match(table, /scope="col"/);
  assert.match(table, /scope="row"/);
  assert.match(table, /overflow-x-auto/);
});
