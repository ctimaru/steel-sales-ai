import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = p => fs.readFileSync(new URL(p, import.meta.url), "utf8");
const home = read("../app/(public)/knowledge/page.tsx");
const navigation = read("../components/school-unified-navigation.tsx");

test("SCHOOL-UX2 first viewport is compact and free of decorative profile replicas", () => {
  assert.match(home, /<FocusPage compact /);
  assert.match(home, /<SchoolUnifiedNavigation locale="it" scope="public" compact/);
  assert.match(home, /home-cine1a-steel\.webp/);
  assert.doesNotMatch(home, /rounded-\[55px\]|h-36 w-28 rounded-\[14px\]/);
  assert.match(home, /school-cine-heading/);
  assert.match(home, /Cerca una norma o un materiale/);
  assert.match(home, /!bg-\[#247455\].*!text-white/);
});

test("SCHOOL-UX2 exposes useful technical actions above article content", () => {
  assert.ok(home.indexOf('id="ricerca-tecnica"') < home.indexOf('<SchoolJourney locale="it"'));
  assert.match(home, /<form action="\/knowledge\/norme" method="get"/);
  assert.match(home, /<form action="\/knowledge\/gradi" method="get"/);
  assert.match(home, /aria-label="Cerca norma tecnica"/);
  assert.match(home, /aria-label="Cerca grado di acciaio"/);
  assert.match(home, /source=school&surface=home_card#calcolatore-pesi/);
  assert.match(home, /Calcola e crea la distinta/);
});

test("SCHOOL-UX2 keeps original public/private routes and single-line navigation", () => {
  assert.match(navigation, /if \(compact\) return/);
  assert.match(navigation, /scope==="public" \?/);
  assert.match(navigation, /overflow-x-auto/);
  assert.match(navigation, /schoolWorkspaceHref\("\/school",locale\)/);
  assert.match(home, /canonical: absoluteUrl\("\/knowledge"\)/);
  assert.match(home, /SchoolConversionPath locale="it"/);
});

test("SCHOOL-UX2 removes duplicate header menus only on the public landing", () => {
  const layout = read("../app/(public)/knowledge/layout.tsx");
  const styles = read("../app/globals.css");
  assert.equal((layout.match(/data-school-global-topic="true"/g) || []).length, 6);
  assert.match(layout, /data-school-mobile-topics="true"/);
  assert.match(styles, /\.school-shell:has\(#school-cine-heading\) \[data-school-global-topic\]/);
  assert.match(styles, /\.school-shell:has\(#school-cine-heading\) \[data-school-mobile-topics\]/);
  assert.match(layout, /<PublicSessionAction/);
  assert.match(layout, /href="\/azienda"/);
  assert.match(layout, /className="skip-link"/);
});
