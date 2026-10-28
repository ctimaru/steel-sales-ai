import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";
const read=p=>readFileSync(new URL(p,import.meta.url),"utf8");
const paths={
  copy:"../lib/school-workspace-i18n.ts",switch:"../components/school-private-language-switch.tsx",
  hub:"../components/school-localized-workspace-home.tsx",firstViewport:"../components/school-workspace-first-viewport.tsx",home:"../app/(workspace)/school/page.tsx",
  quick:"../components/school-quick-access.tsx",ref:"../components/school-private-reference-index.tsx",
  standards:"../app/(workspace)/school/norme/page.tsx",grades:"../app/(workspace)/school/gradi/page.tsx",
  explorer:"../app/(workspace)/school/explorer/page.tsx",search:"../components/knowledge-explorer.tsx",
  workspace:"../app/(workspace)/layout.tsx",sitemap:"../app/sitemap.ts",
  standardDetail:"../app/(workspace)/school/norme/[slug]/page.tsx",
  gradeDetail:"../app/(workspace)/school/gradi/[slug]/page.tsx",
};
const source=Object.fromEntries(Object.entries(paths).map(([k,v])=>[k,read(v)]));
test("SCHOOL-UNIFY2 allowlists language and stays under authenticated workspace routes",()=>{
 for(const lang of ["it","en","de","fr","es"])assert.match(source.copy,new RegExp("^  "+lang+":\\s*\\{","m"),lang);
 assert.match(source.copy,/isSchoolWorkspaceLocale\(value\) \? value : "it"/);
 assert.match(source.copy,/schoolWorkspaceHref\(path: string/);
 assert.match(source.copy,/\/school/);
 assert.match(source.switch,/schoolWorkspaceHref\(pathname,language\)/);
 assert.match(source.workspace,/getWorkspaceContext\(\)/);
 assert.match(source.workspace,/privateNoIndexRobots/);
 assert.doesNotMatch(source.sitemap,/\/de\/school|\/en\/school|\/es\/school|\/fr\/school/);
 assert.doesNotMatch(source.hub+source.ref,/service_role|SUPABASE_SERVICE_ROLE|createClient/);
});
test("SCHOOL-UNIFY2 localized private navigation and shortcuts retain locale without rewriting existing IT home",()=>{
 assert.match(source.home,/SchoolLocalizedWorkspaceHome locale=\{locale\}/);
 assert.match(source.home,/<SchoolJourney locale="it" workspace/);
 assert.match(source.switch,/SchoolPrivateTopbar/);
 for(const href of ["/school/norme","/school/gradi","/school/explorer"])assert.ok(source.hub.includes(href));
 assert.match(source.hub,/CALCULATOR_ROUTES\[locale\]/);
 assert.match(source.hub,/SchoolWorkspaceFirstViewport locale=\{locale\}/);
 assert.match(source.firstViewport,/name="lang" value=\{locale\}/);
 assert.match(source.quick,/schoolWorkspaceHref\(tool.href,locale\)/);
 assert.match(source.quick,/schoolWorkspaceHref\(item.href,locale\)/);
 assert.match(source.quick,/SCHOOL_PRIVATE_COPY\[locale\]/);
});
test("SCHOOL-UNIFY2 only published public reference sources, clearly label nontranslated originals",()=>{
 assert.match(source.ref,/listPublicStandards\(\)/);
 assert.match(source.ref,/listPublicGrades\(\)/);
 assert.match(source.ref,/englishStandards/);
 assert.match(source.ref,/englishGrades/);
 assert.match(source.ref,/locale==="en"&&!native/);
 assert.match(source.ref,/c.originalItalian/);
 assert.match(source.standards,/SchoolPrivateReferenceIndex/);
 assert.match(source.grades,/SchoolPrivateReferenceIndex/);
 assert.match(source.standardDetail,/SchoolPrivateReferenceDetailBanner/);
 assert.match(source.gradeDetail,/SchoolPrivateReferenceDetailBanner/);
});
test("SCHOOL-UNIFY2 existing document search server action and tenant context remain unchanged",()=>{
 assert.match(source.explorer,/KnowledgeExplorer locale=\{locale\}/);
 assert.match(source.explorer,/force-dynamic/);
 assert.match(source.search,/useActionState\(searchKnowledge, initialState\)/);
 assert.match(source.search,/explorerLabels\[locale\]/);
 assert.match(source.search,/sourceTarget\(lead\)/);
 assert.doesNotMatch(source.explorer,/createPublicSupabaseClient/);
});
