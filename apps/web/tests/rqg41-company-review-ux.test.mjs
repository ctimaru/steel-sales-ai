import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {test} from "node:test";

const read=(path)=>readFileSync(new URL(path,import.meta.url),"utf8");
const review=read("../app/(italian)/(workspace)/review/page.tsx");
const dashboard=read("../app/(italian)/(workspace)/dashboard/page.tsx");
const alias=read("../app/(italian)/(workspace)/operations/review/page.tsx");
const layout=read("../app/(italian)/(workspace)/operations/review/layout.tsx");
const e2e=read("../../../.github/workflows/perf1-chrome-auth.yml");

test("RQG4.1 Company Review stays tenant-scoped and preserves actionable decision forms",()=>{
  assert.match(review,/requireWorkspaceAdmin\(\)/);
  assert.match(layout,/requireWorkspaceAdmin\(\)/);
  assert.match(alias,/review\/page/);
  assert.match(review,/getReviewItems\(\)/);
  assert.match(review,/ReviewConfirmForm id=\{flag\.id\}/);
  assert.match(review,/ReviewCorrectForm id=\{flag\.id\}/);
  assert.match(review,/reviewed=\{flag\.reviewStatus !== "pending"\}/);
  assert.doesNotMatch(review,/platform_access_context|service_role|\.insert\(|\.update\(|\.delete\(/);
});
test("RQG4.1 clarifies pending-first, human labels, neutral extraction confidence, complete empty queue",()=>{
  assert.match(review,/const orderedItems = \[\.\.\.items\]\.sort/);
  assert.match(review,/Number\(b\.reviewStatus === "pending"\)/);
  assert.match(review,/orderedItems\.map/);
  for(const label of ['pending: "Da verificare"','confirmed: "Confermato"','corrected: "Corretto"',
    "Confidenza estrazione:","Richiede una decisione","Non ci sono verifiche aperte"]){
    assert.ok(review.includes(label),label);
  }
  assert.doesNotMatch(review,/\{flag\.reviewStatus\}<\/Badge>/);
  assert.doesNotMatch(review,/\{flag\.status\}<\/Badge>/);
});
test("RQG4.1 keeps tools discoverable but secondary and separated from Workspace attention",()=>{
  assert.match(review,/<details className=/);
  assert.match(review,/<summary className=/);
  assert.match(review,/<nav aria-label="Strumenti avanzati della Review"/);
  assert.match(review,/Copertura normalizzazione/);
  assert.match(review,/Identità aziendali/);
  assert.match(review,/Candidate reparse/);
  assert.match(dashboard,/Only user-owned buyer actions belong in the Workspace attention strip/);
  assert.match(dashboard,/tenant-scoped commercial_review_queue contains parser/);
  assert.doesNotMatch(review,/\/platform\/review/);
});
test("RQG4.1 adds tenant Review UX path to real disposable Chrome regression triggers",()=>{
  assert.ok(e2e.includes('"apps/web/app/(italian)/(workspace)/review/page.tsx"'));
  assert.ok(e2e.includes('"apps/web/tests/rqg41-*.mjs"'));
  assert.match(e2e,/supabase stop --no-backup/);
});
