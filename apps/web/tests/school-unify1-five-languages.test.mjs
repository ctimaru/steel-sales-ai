import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = path=>fs.readFileSync(new URL(path,import.meta.url),"utf8");
const routes=read("../lib/school-locales.ts");
const shared=read("../components/school-unified-experience.tsx");
const selector=read("../components/calculator-page-language-selector.tsx");
const italian=read("../app/(public)/knowledge/page.tsx");
const english=read("../app/(english)/en/knowledge/page.tsx");
const engShell=read("../components/english-public-subpage.tsx");
const workspace=read("../app/(workspace)/school/page.tsx");
const localized=read("../app/(international-calculator)/[locale]/knowledge/page.tsx");
const sitemap=read("../app/sitemap.ts");

test("SCHOOL-UNIFY1 shared School navigation includes exactly five published homepage routes",()=>{
  for(const [locale,route] of Object.entries({it:"/knowledge",en:"/en/knowledge",de:"/de/knowledge",fr:"/fr/knowledge",es:"/es/knowledge"})){
    assert.ok(routes.includes(locale+':"'+route+'"'),locale+" school home route");
    assert.match(shared,new RegExp('^  '+locale+': \\{','m'),locale+" translated four cards");
  }
  assert.match(selector,/surface:"home"\|"calculator"\|"school"/);
  assert.match(selector,/SCHOOL_HUB_ROUTES/);
  assert.match(selector,/aria-current=\{code===locale\?"page":undefined\}/);
  assert.match(localized,/generateStaticParams/);
  assert.match(localized,/isNewCalculatorLocale\(locale\)/);
});

test("SCHOOL-UNIFY1 public and workspace share diagrams and navigation, keep private boundaries",()=>{
  assert.match(italian,/<SchoolJourney locale="it"/);
  assert.match(italian,/<SchoolPageLanguageSelector locale="it"/);
  assert.match(workspace,/<SchoolJourney locale="it" workspace/);
  assert.match(workspace,/<SchoolTechnicalSections locale="it"/);
  assert.match(workspace,/appRoutes\.knowledge\.explorer/);
  assert.match(shared,/workspace \? \[/);
  assert.match(shared,/href:"\/school\/norme"/);
  assert.match(shared,/href:"\/school\/gradi"/);
  assert.match(shared,/href:"\/knowledge\/articoli"/);
  assert.doesNotMatch(localized,/href="\/school|\/school\/explorer|\/network\/|service_role|createClient/);
  assert.match(localized,/private|privés|privados|privat/i);
});

test("SCHOOL-UNIFY1 EN and DE/FR/ES have original shared technical visuals and genuine resources",()=>{
  assert.match(english,/<SchoolJourney locale="en"/);
  assert.match(english,/<SchoolTechnicalSections locale="en"/);
  assert.match(english,/knowledgeLanguageMenu/);
  assert.match(engShell,/<SchoolPageLanguageSelector locale="en"/);
  for(const key of ["de","fr","es"]){
    assert.ok(shared.includes('href:"/'+key+'/knowledge/tubes"'),key+" calculator");
    assert.ok(shared.includes('href:"/'+key+'/distinta"'),key+" bill");
    assert.ok(localized.includes(key+':{'),key+" localized editorial metadata");
  }
  assert.match(shared,/MARKET_GUIDE_ROUTES/);
  assert.match(shared,/MARKET_TOPIC_ROUTES/);
  assert.match(localized,/inLanguage:locale/);
  assert.match(localized,/aria-label="Smart Steel School"/);
  assert.doesNotMatch(localized,/schoolArticles|IT content translated|hreflang.*articoli/);
});

test("SCHOOL-UNIFY1 canonical+hreflang five published hubs, no false article translations",()=>{
  assert.match(italian,/de: absoluteUrl\("\/de\/knowledge"\)/);
  assert.match(english,/fr: absoluteUrl\("\/fr\/knowledge"\)/);
  assert.match(localized,/canonical:absoluteUrl\(path\),languages:localizedAlternates\(\)/);
  assert.match(localized,/robots:\{index:true,follow:true\}/);
  for(const lang of ["de","fr","es"])assert.ok(sitemap.includes(''+lang+': absoluteUrl("/'+lang+'/knowledge")'));
  assert.match(sitemap,/url: absoluteUrl\(locale==="it"\?"\/knowledge":/);
  assert.match(italian,/schoolArticles\.slice\(0, 3\)\.map/);
});
