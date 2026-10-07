import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

function read(path) {
  return fs.readFileSync(new URL(path, import.meta.url), "utf8");
}

const school = read("../app/(workspace)/school/page.tsx");
const shell = read("../components/app-shell.tsx");
const quick = read("../components/school-quick-access.tsx");
const layout = read("../app/(workspace)/school/layout.tsx");

test("PF5 makes the weight calculator the primary School tool", () => {
  assert.match(school, /Il toolbox tecnico per acciaio e tubi/);
  assert.match(school, /Strumento principale/);
  assert.match(school, /Calcolo pesi tubo/);
  assert.match(school, /kg\/m/);
  assert.match(school, /peso barra/i);
  assert.match(school, /Tonnellate/);
  assert.match(school, /appRoutes\.knowledge\.schoolTubes/);
});

test("PF5 puts standards and grades search directly on School home", () => {
  assert.match(school, /Ricerca tecnica/);
  assert.match(school, /action=\{appRoutes\.knowledge\.schoolStandards\}/);
  assert.match(school, /action=\{appRoutes\.knowledge\.schoolGrades\}/);
  assert.match(school, /type="search"/);
  assert.match(school, /EN 10219/);
  assert.match(school, /S355J2H/);
});

test("PF5 keeps technical catalogs and private company documents distinct", () => {
  assert.match(school, /Vai direttamente al riferimento tecnico/);
  assert.match(school, /Catalogo completo/);
  assert.match(school, /Documenti aziendali/);
  assert.match(school, /knowledge privata/);
  assert.match(school, /appRoutes\.knowledge\.explorer/);
});

test("PF5 persists recent and favorite School tools locally without a database dependency", () => {
  assert.match(quick, /localStorage/);
  assert.match(quick, /school:recent:v1/);
  assert.match(quick, /school:favorites:v1/);
  assert.match(quick, /aria-pressed=\{active\}/);
  assert.match(quick, /Salvati su questo dispositivo/);
  assert.match(layout, /SchoolVisitTracker/);
});

test("PF5 simplifies authenticated School navigation around daily technical jobs", () => {
  const start = shell.indexOf("const knowledgeNav");
  const end = shell.indexOf("function roleLabel", start);
  const block = shell.slice(start, end);

  for (const label of ["Home", "Calcolo pesi", "Norme", "Gradi", "Documenti"]) {
    assert.match(block, new RegExp(`label: "${label}"`));
  }
  assert.doesNotMatch(block, /Knowledge Explorer/);
  assert.doesNotMatch(block, /Catalogo tecnico/);
  assert.doesNotMatch(block, /Pesi & dimensioni/);
});
