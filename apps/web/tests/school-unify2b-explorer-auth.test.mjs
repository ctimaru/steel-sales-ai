import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
const read=p=>fs.readFileSync(new URL(p,import.meta.url),"utf8");
const local=read("../lib/school-explorer-locales.ts");
const explorer=read("../components/knowledge-explorer.tsx");
const action=read("../app/(workspace)/knowledge-explorer/actions.ts");
const privatePage=read("../app/(workspace)/school/explorer/page.tsx");
const layout=read("../app/(workspace)/layout.tsx");
const authScript=read("./school-unify2b-production-multirole-readonly.mjs");
const authWorkflow=read("../../../.github/workflows/school-unify2b-production-auth.yml");
const ciWorkflow=read("../../../.github/workflows/perf2-1-mobile-acceptance.yml");
test("SCHOOL-UNIFY2B has five complete real locales, example texts and translated interactive fields",()=>{
 for(const lang of ["it","en","de","fr","es"]){
   assert.ok(local.includes('"'+lang+'": {'),"locale missing: "+lang);
 }
 for(const field of ["company","grade","standard","family","country","role","roles",
  "diameter","thickness","width","height","length","sourceClass","sourceType",
  "documentType","filename","from","to","resultLimit","untitled","openSource",
  "openThread","evidence","semantic","fulltext","model"]){
   assert.ok(local.includes('"'+field+'":'),field);
   assert.ok(explorer.includes("ui."+field),field+" not rendered");
 }
 for(const k of ["examples","idleTitles","idleDescriptions","roles"])assert.match(explorer,new RegExp("ui\\."+k));
 assert.match(local,/"errorAuth":/);
 assert.match(local,/"errorUnavailable":/);
 assert.match(explorer,/EXPLORER_LOCALES\[locale\]\.errorAuth/);
 assert.match(explorer,/displaySearchMessage\(state.message,locale\)/);
 assert.match(explorer,/return known\[message\] \?\? message/);
 assert.match(explorer,/locationLabel\(result, locale\)/);
});
test("SCHOOL-UNIFY2B never translates the raw source or changes worker request structure",()=>{
 for(const field of ["query","company","grade","standard","product_family","country","item_role",
  "outer_diameter_mm","thickness_mm","width_mm","height_mm","length_mm",
  "source_class","source_type","document_type","document_query","date_from","date_to","limit"]){
   assert.match(explorer,new RegExp('name="'+field+'"'));
 }
 for(const role of ["requested","offered","ordered","delivered"])assert.ok(explorer.includes('value="'+role+'"'));
 assert.match(explorer,/useActionState\(searchKnowledge, initialState\)/);
 assert.match(explorer,/\{result\.content\}/);
 assert.match(explorer,/\{lead\.source_class \?\?/);
 assert.match(explorer,/sourceTarget\(lead\)/);
 assert.match(action,/supabase\.auth\.getClaims\(\)/);
 assert.match(action,/owner_id: ownerId/);
 assert.match(action,/commercial_filters: commercialFilters/);
 assert.match(action,/document_filters: documentFilters/);
 assert.match(privatePage,/<KnowledgeExplorer locale=\{locale\}/);
 assert.match(layout,/privateNoIndexRobots/);
});
test("SCHOOL-UNIFY2B authenticated CI is opt-in, existing synthetic users only, zero production search writes",()=>{
 assert.match(authWorkflow,/workflow_dispatch:/);
 assert.match(authWorkflow,/environment: production-qa/);
 assert.match(authWorkflow,/SCHOOL_UNIFY2B_APPROVE_SYNTHETIC_READ_ONLY/);
 assert.match(authWorkflow,/github\.ref == 'refs\/heads\/main'/);
 assert.doesNotMatch(authWorkflow,/on:\s*push|schedule:|actions\/upload-artifact|SUPABASE_SERVICE_ROLE/);
 assert.match(authScript,/assert\.equal\(process\.env\.GITHUB_EVENT_NAME,"workflow_dispatch"\)/);
 assert.match(authScript,/assert\.equal\(process\.env\.GITHUB_REF,"refs\/heads\/main"\)/);
 assert.match(authScript,/blockedWrites\+\+/);
 assert.match(authScript,/return route\.abort\("blockedbyclient"\)/);
 assert.doesNotMatch(authScript,/click\(.+Review|\.submit\(|\.screenshot\(|\.storageState\(|\.trace\./);
 assert.match(authScript,/crossTenantSearch:"NOT RUN/);
 assert.match(authScript,/new Set\(\)/);
 assert.match(ciWorkflow,/school-unify2b-chrome-explorer\.mjs/);
});
