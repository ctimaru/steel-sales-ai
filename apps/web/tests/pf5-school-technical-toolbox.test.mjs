import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

function read(path) {
  return fs.readFileSync(new URL(path, import.meta.url), "utf8");
}

const school = read("../app/(workspace)/school/page.tsx");
const firstViewport = read("../components/school-workspace-first-viewport.tsx");
const shell = read("../components/app-shell.tsx");
const quick = read("../components/school-quick-access.tsx");
const layout = read("../app/(workspace)/school/layout.tsx");
const schoolCopy = read("../lib/school-workspace-i18n.ts");

test("PF5 makes the weight calculator the primary School tool", () => {
  assert.match(school, /SchoolWorkspaceFirstViewport/);
  assert.match(firstViewport, /L’acciaio, spiegato bene/);
  assert.match(firstViewport, /school-private-calculator-heading/);
  assert.match(firstViewport, /kg\/m/);
  assert.match(firstViewport, /CALCULATOR_ROUTES\[locale\]/);
  assert.match(firstViewport, /\/school\/tubes\?source=school/);
});

test("PF5 puts standards and grades search directly on School home", () => {
  assert.match(firstViewport, /school-private-search/);
  assert.match(firstViewport, /action=\{"\/school\/"\+group\}/);
  assert.match(firstViewport, /\["norme","gradi"\]/);
  assert.match(firstViewport, /type="search"/);
  assert.match(firstViewport, /EN 10219/);
  assert.match(firstViewport, /S355J2H/);
});

test("PF5 keeps technical catalogs and private company documents distinct", () => {
  assert.match(school, /SchoolTechnicalSections/);
  assert.doesNotMatch(school, /knowledge\.explorer|school-private-documents/);
  assert.doesNotMatch(firstViewport, /appRoutes\.knowledge\.explorer|supabase/);
});

test("PF5 persists recent and favorite School tools locally without a database dependency", () => {
  assert.match(quick, /localStorage/);
  assert.match(quick, /school:recent:v1/);
  assert.match(quick, /school:favorites:v1/);
  assert.match(quick, /aria-pressed=\{active\}/);
  assert.match(quick, /copy.savedHint/);
  assert.match(schoolCopy, /Salvati su questo dispositivo/);
  assert.match(quick, /schoolWorkspaceHref\(item.href,locale\)/);
  assert.match(layout, /SchoolVisitTracker/);
});

test("PF5 simplifies authenticated School navigation around daily technical jobs", () => {
  const start = shell.indexOf("const knowledgeNav");
  const end = shell.indexOf("function roleLabel", start);
  const block = shell.slice(start, end);

  for (const label of ["Scuola", "Professore", "Norme", "Materiali", "Guide"]) {
    assert.match(block, new RegExp(`label: "${label}"`));
  }
  assert.doesNotMatch(block, /Knowledge Explorer/);
  assert.doesNotMatch(block, /Catalogo tecnico/);
  assert.doesNotMatch(block, /Pesi & dimensioni/);
});
