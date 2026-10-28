import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
const read = path => fs.readFileSync(new URL(path, import.meta.url), "utf8");
const publicHome = read("../app/(public)/knowledge/page.tsx");
const privateHome = read("../app/(workspace)/school/page.tsx");
const internationalHome = read("../components/school-localized-workspace-home.tsx");
const shared = read("../components/school-workspace-first-viewport.tsx");
const navigation = read("../components/school-unified-navigation.tsx");
const topbar = read("../components/school-private-language-switch.tsx");

test("SCHOOL-PRIVATE-PARITY keeps identical first viewport visual tokens across public and authenticated School", () => {
  for (const token of ["rounded-[24px]", "bg-[#102921]", "home-cine1a-steel.webp", "min-h-[292px]", "text-[2.35rem]", "bg-[#247455]", "rounded-[22px]"]) {
    assert.ok(publicHome.includes(token), "public " + token);
    assert.ok(shared.includes(token), "workspace " + token);
  }
  for (const page of [privateHome, internationalHome]) {
    assert.ok(page.includes("SchoolWorkspaceFirstViewport"));
    assert.match(page, /<SchoolUnifiedNavigation locale=\{?[^\s]+\}? scope="workspace" compact/);
    assert.match(page, /<SchoolAssistantEntry/);
    assert.match(page, /<SchoolQuickAccess/);
    assert.match(page, /<SchoolTechnicalSections/);
  }
});

test("SCHOOL-PRIVATE-PARITY makes search and calculator immediately available, keeps private paths", () => {
  assert.ok(shared.indexOf("school-private-search") < shared.indexOf("school-private-calculator-heading"));
  assert.ok(shared.includes('["norme","gradi"]'));
  assert.ok(shared.includes('action={"/school/"+group}'));
  assert.ok(shared.includes('name="lang" value={locale}'));
  assert.ok(shared.includes('schoolWorkspaceHref(path, locale)'));
  assert.ok(shared.includes('"/school/tubes?source=school&surface=home_card#calcolatore-pesi"'));
  assert.ok(shared.includes("CALCULATOR_ROUTES[locale]"));
  assert.ok(shared.includes('schoolWorkspaceHref("/school/professore",locale)'));
  assert.ok(privateHome.includes("appRoutes.knowledge.explorer"));
  assert.ok(internationalHome.includes('schoolWorkspaceHref("/school/explorer",locale)'));
  assert.match(topbar, /compact\?:boolean/);
  assert.match(navigation, /if \(compact\) return/);
  assert.match(navigation, /scope==="public" \?/);
});

test("SCHOOL-PRIVATE-PARITY does not duplicate a public Company CTA or leak private documents", () => {
  assert.match(navigation, /SCHOOL_HUB_ROUTES\[locale\]/);
  assert.ok(shared.indexOf("school-private-search") < privateHome.length + shared.length);
  assert.doesNotMatch(shared, /getWorkspaceContext|supabase|service_role|organizationId|fetch\(/);
  assert.ok(privateHome.includes("SchoolPrivateTopbar"));
  assert.ok(internationalHome.includes("SchoolPrivateTopbar"));
});

test("SCHOOL-PRIVATE-PARITY renders a logged-in Professor route without private data access", () => {
  const professor = read("../app/(workspace)/school/professore/page.tsx");
  assert.match(professor, /SchoolTechnicalTutor/);
  assert.match(professor, /privateNoIndexRobots/);
  assert.match(professor, /SchoolPrivateTopbar/);
  assert.match(professor, /SchoolUnifiedNavigation/);
  assert.doesNotMatch(professor, /getWorkspaceContext|supabase|service_role|company_records/);
});
