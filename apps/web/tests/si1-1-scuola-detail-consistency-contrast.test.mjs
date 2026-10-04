import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const files = {
  layout: fs.readFileSync(new URL("../app/(public)/knowledge/layout.tsx", import.meta.url), "utf8"),
  standards: fs.readFileSync(new URL("../app/(public)/knowledge/norme/page.tsx", import.meta.url), "utf8"),
  standardDetail: fs.readFileSync(new URL("../app/(public)/knowledge/norme/[slug]/page.tsx", import.meta.url), "utf8"),
  grades: fs.readFileSync(new URL("../app/(public)/knowledge/gradi/page.tsx", import.meta.url), "utf8"),
  gradeDetail: fs.readFileSync(new URL("../app/(public)/knowledge/gradi/[slug]/page.tsx", import.meta.url), "utf8"),
  tubes: fs.readFileSync(new URL("../app/(public)/knowledge/tubes/page.tsx", import.meta.url), "utf8"),
  tubeDetail: fs.readFileSync(new URL("../app/(public)/knowledge/tubes/[slug]/page.tsx", import.meta.url), "utf8"),
  familyHub: fs.readFileSync(new URL("../components/public-tube-family-hub.tsx", import.meta.url), "utf8"),
  sizeHub: fs.readFileSync(new URL("../components/public-tube-size-hub.tsx", import.meta.url), "utf8"),
  calculator: fs.readFileSync(new URL("../components/public-tube-weight-calculator.tsx", import.meta.url), "utf8"),
  css: fs.readFileSync(new URL("../app/globals.css", import.meta.url), "utf8"),
};

test("SI1.1 uses SchoolHero on every principal detail family", () => {
  for (const source of [
    files.standardDetail,
    files.gradeDetail,
    files.tubeDetail,
    files.familyHub,
    files.sizeHub,
  ]) {
    assert.match(source, /SchoolHero/);
  }
});

test("SI1.1 scopes the readability contract to the public Scuola shell", () => {
  assert.match(files.layout, /school-shell/);
  assert.match(files.css, /\.school-shell \[class~="text-\[#7e8da1\]"\]/);
  assert.match(files.css, /\.school-breadcrumb/);
  assert.match(files.css, /\.school-meta-label/);
  assert.match(files.css, /\.school-inline-link/);
  assert.match(files.css, /\.school-table-head/);
  assert.match(files.css, /\.school-selected-control/);
});

test("SI1.1 removes legacy low-contrast breadcrumbs from main Scuola routes", () => {
  for (const source of [
    files.standards,
    files.standardDetail,
    files.grades,
    files.gradeDetail,
    files.tubes,
    files.tubeDetail,
    files.familyHub,
    files.sizeHub,
  ]) {
    assert.doesNotMatch(
      source,
      /aria-label="Breadcrumb" className="text-xs font-semibold text-\[#7e8da1\]"/,
    );
  }
});

test("SI1.1 normalizes table and selected-state contrast", () => {
  assert.match(files.sizeHub, /school-table-head/);
  assert.match(files.sizeHub, /school-table-row/);
  assert.match(files.calculator, /school-table-head/);
  assert.match(files.calculator, /school-table-row/);
  assert.match(files.calculator, /school-selected-control/);
});

test("SI1.1 keeps primary navigation actions semantic instead of local dark-green button classes", () => {
  assert.match(files.standardDetail, /school-primary-action/);
  assert.match(files.gradeDetail, /school-primary-action/);
  assert.match(files.tubeDetail, /school-primary-action/);
  assert.match(files.familyHub, /school-primary-action/);
  assert.match(files.sizeHub, /school-primary-action/);
});

test("SI1.1 preserves public knowledge URLs and does not introduce Network access", () => {
  const combined = Object.values(files).join("\n");
  assert.match(combined, /\/knowledge\/norme/);
  assert.match(combined, /\/knowledge\/gradi/);
  assert.match(combined, /\/knowledge\/tubes/);
  assert.doesNotMatch(combined, /href="\/network/);
});
