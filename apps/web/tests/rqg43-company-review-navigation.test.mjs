import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {test} from "node:test";
const source=path=>readFileSync(new URL(path,import.meta.url),"utf8");
const review=source("../app/(italian)/(workspace)/review/page.tsx");
const commercial=source("../lib/commercial-data.ts");
const routes=source("../lib/routes.ts");
const dashboard=source("../app/(italian)/(workspace)/dashboard/page.tsx");
const platform=source("../app/(italian)/(platform)/platform/review/page.tsx");
const profile=source("../components/workspace-navigation.tsx");
const workflow=source("../../../.github/workflows/perf1-chrome-auth.yml");
const chrome=source("./rqg43-company-review-navigation-chrome.mjs");
const fixture=source("../../../supabase/tests/rqg43_local_clean_queue_fixture.sql");

test("RQG4.3 Company Review links are canonical and role-scoped without Platform Review leakage",()=>{
  for(const name of ["reviewCoverage","reviewIdentities","reviewOfferReparse"]){
    assert.ok(review.includes("appRoutes.operations."+name),name);
  }
  assert.match(review,/href=\{appRoutes\.home\}/);
  assert.match(review,/requireWorkspaceAdmin\(\)/);
  assert.match(profile,/canAdmin \? \(/);
  assert.match(profile,/href=\{appRoutes\.operations\.review\} label="Qualità dati aziendali"/);
  assert.doesNotMatch(review,/href="\/review\/(coverage|identities|offer-reparse)"/);
  assert.match(platform,/requirePlatformConsoleContext\(\)/);
  assert.match(platform,/visiblePlatformReviewLanes\(context.permissions\)/);
  assert.doesNotMatch(dashboard,/href=\{appRoutes\.platform\.review\}/);
  assert.match(routes,/review: "\/operations\/review"/);
  assert.match(routes,/review: "\/platform\/review"/);
});

test("RQG4.3 no-history, actually empty and unavailable are distinct and never falsely clean",()=>{
  assert.match(commercial,/if \(error\) return \{ mode: "unavailable", items: \[\] \}/);
  assert.match(commercial,/if \(datasetError\) return \{ mode: "unavailable", items: \[\] \}/);
  assert.match(commercial,/if \(!count\) return \{ mode: "awaiting_assignment", items: \[\] \}/);
  assert.match(review,/mode === "awaiting_assignment"/);
  assert.match(review,/mode === "unavailable"/);
  assert.match(review,/role="alert"/);
  assert.match(review,/Impossibile verificare la coda/);
  assert.match(review,/items\.length === 0 && \(mode === "live" \|\| mode === "demo"\)/);
  assert.match(review,/Non ci sono ancora documenti commerciali associati/);
  assert.match(review,/Non ci sono correzioni da gestire/);
  assert.match(review,/appRoutes\.operations\.uploads/);
  assert.doesNotMatch(commercial,/if \(error \|\| !data\?\.length\)/);
});

test("RQG4.3 synthetic-only Chrome actually checks profile links, A/B, no data, clean and denied legacy deep routes",()=>{
  assert.match(chrome,/assert.equal\(process.env.PERF1_WEB_URL,WEB/);
  assert.match(chrome,/54321/);
  assert.match(chrome,/endsWith\("@example.test"\)/);
  for(const role of ["buyer","trader","producer","processor","buyerViewer","platformStaff","owner"]){
    assert.ok(chrome.includes('"'+role+'"'),"missing actor "+role);
  }
  for(const route of ["/operations/review","/review","/review/coverage",
    "/operations/review/coverage","/operations/review/identities"]){
    assert.ok(chrome.includes('"'+route+'"'),"missing deep link "+route);
  }
  assert.match(chrome,/menu\.getByRole\("link",\{name:"Qualità dati aziendali"\}\)/);
  assert.match(chrome,/RQG31 PRIVATE A/);
  assert.match(chrome,/RQG31 PRIVATE B/);
  assert.match(chrome,/Non ci sono ancora documenti commerciali associati/);
  assert.match(chrome,/Non ci sono correzioni da gestire/);
  assert.match(chrome,/Platform Review/);
  assert.doesNotMatch(chrome,/https:\/\/www\.smartsteelsales\.com|\.insert\(|\.update\(|\.delete\(|auth\.admin/);
  assert.match(fixture,/rqg43-empty-processor-local\.eml/);
  assert.match(fixture,/RQG4\.3: clean processor must have no Reviews/);
  assert.match(workflow,/rqg43_local_clean_queue_fixture\.sql/);
  assert.match(workflow,/node tests\/rqg43-company-review-navigation-chrome\.mjs/);
  assert.ok(workflow.indexOf("node tests/rqg43-company-review-navigation-chrome.mjs")<
    workflow.indexOf("node tests/rqg31-chrome-multi-role.mjs"));
  assert.match(workflow,/supabase stop --no-backup/);
});
