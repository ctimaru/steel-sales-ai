import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const standardPage = fs.readFileSync(
  new URL("../app/(public)/knowledge/norme/[slug]/page.tsx", import.meta.url),
  "utf8",
);
const migration = fs.readFileSync(
  new URL(
    "../../../supabase/migrations/20261115230000_seo_standard1_standard_technical_data.sql",
    import.meta.url,
  ),
  "utf8",
);

const standards = {
  "en-10210": { code: "EN 10210", sections: 3 },
  "en-10219": { code: "EN 10219", sections: 3 },
  "en-10216-2": { code: "EN 10216-2", sections: 3 },
  "en-10217-1": { code: "EN 10217-1", sections: 2 },
  "en-10217-2": { code: "EN 10217-2", sections: 3 },
  "en-10224": { code: "EN 10224", sections: 2 },
};

function payloads(slug) {
  const start = migration.indexOf(`select pg_temp.seo_standard1_apply(\n  '${slug}'`);
  assert.notEqual(start, -1, `missing call for ${slug}`);
  const block = migration.slice(start, migration.indexOf("\n);\n", start));
  return [...block.matchAll(/^  '(\[.*\])'::jsonb,?$/gm)].map((match) =>
    JSON.parse(match[1].replaceAll("''", "'")),
  );
}

test("SEO-STANDARD1 enriches all six published standard pages with sourced tables", () => {
  for (const [slug, { code, sections: count }] of Object.entries(standards)) {
    const [sections, faq, sources] = payloads(slug);
    assert.equal(sections.length, count, slug);
    assert.equal(sections[0].heading, `Gradi della ${code}: caratteristiche meccaniche`);
    assert.equal(sections[1].heading, `Composizione chimica dei gradi ${code}`);
    for (const section of sections) {
      assert.ok(section.table.rows.length >= 3, `${slug}: ${section.heading}`);
      for (const row of section.table.rows) {
        assert.equal(row.length, section.table.columns.length, `${slug}: ${row[0]}`);
      }
    }
    assert.equal(faq.length, 2);
    assert.equal(sources.length, 1);
    assert.match(sources[0].url, /^https:\/\/www\.mannesmann\.com\/en\/knowledge\/standards-materials\//);
  }
});

test("SEO-STANDARD1 compares standards that share grade designations", () => {
  assert.equal(payloads("en-10210")[0][2].heading, "EN 10210 ed EN 10219 a confronto");
  assert.equal(payloads("en-10219")[0][2].heading, "EN 10210 ed EN 10219 a confronto");
  assert.match(payloads("en-10216-2")[0][2].heading, /EN 10216-2 e EN 10217-2/);
  assert.match(migration, /Una sigla in comune non rende i prodotti intercambiabili/);
});

test("SEO-STANDARD1 keeps the editorial trust contract and stays content-only", () => {
  assert.match(migration, /fanno fede la norma di prodotto e il certificato del materiale/);
  assert.doesNotMatch(migration, /alter table|create policy|grant |security definer/i);
  assert.match(migration, /not exists \(/);
});

test("SEO-STANDARD1 renders section tables on the standard page", () => {
  assert.match(standardPage, /import \{ KnowledgeSectionTable \} from "@\/components\/knowledge-section-table"/);
  assert.match(standardPage, /<KnowledgeSectionTable table=\{section\.table\} \/>/);
});
