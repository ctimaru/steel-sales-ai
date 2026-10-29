import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";
import ts from "typescript";

const read=p=>readFileSync(new URL(p,import.meta.url),"utf8");
const archive=read("../app/(italian)/(workspace)/rfq-hub/distinte/page.tsx");
const detail=read("../app/(italian)/(workspace)/rfq-hub/distinte/[distintaId]/page.tsx");
const actions=read("../app/(italian)/(workspace)/rfq-hub/distinte/actions.ts");
const controls=read("../components/saved-distinta-actions.tsx");
const migration=read("../../../supabase/migrations/20261029164000_calc_dist4_saved_bill_management.sql");
const flow=read("../../../.github/workflows/product-flow1-e2e.yml");
const authenticated=read("./calc-dist3-chrome-authenticated-private-save.mjs");

test("CALC-DIST4: typechecked inputs and compact search/pagination preserves active and archived state",()=>{
  for(const code of [archive,detail,actions,controls]) {
    const out=ts.transpileModule(code,{compilerOptions:{module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.Preserve,target:ts.ScriptTarget.ES2022},reportDiagnostics:true});
    assert.deepEqual((out.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error).map(d=>d.messageText),[]);
  }
  for(const x of ["data-dist4-archive","data-dist4-row","data-dist4-active-tab","data-dist4-archived-tab",
    'name="q"','name="view"','archiveUrl(query,mode,page+1)','archiveUrl(query,mode,page-1)',
    '.eq("organization_id", context.organizationId)','request.is("archived_at",null)','request.not("archived_at","is",null)'])
    assert.ok(archive.includes(x),x);
  for(const x of ["SavedDistintaActions","archived_at","Campagne RFQ collegate","owner_user_id===context.userId"])
    assert.ok(detail.includes(x),x);
});

test("CALC-DIST4: archives are reversible metadata, never DELETE and never rewrite technical numbers",()=>{
  assert.match(migration,/add column if not exists archived_at timestamptz null/);
  assert.match(migration,/grant update \(title, archived_at\) on public\.buyer_distintas to authenticated/);
  assert.match(migration,/revoke update on public\.buyer_distintas from anon, authenticated/);
  assert.match(migration,/for update to authenticated/);
  assert.match(migration,/with check \(/);
  assert.match(migration,/owner_user_id = \(select auth\.uid\(\)\)/);
  assert.match(migration,/public\.is_organization_member\(organization_id,false\)/);
  assert.doesNotMatch(migration,/\bgrant delete\b|\bfor delete\b/i);
  assert.ok(!actions.includes(".delete("));
  assert.ok(actions.includes(".update({title:title.trim()})"));
  assert.ok(actions.includes(".update({archived_at:archived?new Date().toISOString():null})"));
  assert.ok(!actions.includes("service_role"));
});

test("CALC-DIST4: duplicate preserves snapshot numerics and documents, never copies campaign or sends",()=>{
  for(const x of ["buyer_create_distinta_snapshot","document_requirements:source.document_requirements",
    "target_eur_t:line.target_eur_t","target_total_eur:line.target_total_eur",
    "source.line_count","owner_user_id", "organization_id"])
    assert.ok(actions.includes(x),x);
  assert.ok(!actions.includes("createBuyerRfqCampaign"));
  assert.ok(!actions.includes("sendBuyerDistinta"));
  assert.ok(!actions.includes("createPrivateRfqOneStep"));
  for(const x of ["Rinomina","Duplica","Archivia","Ripristina","data-action-rename","data-action-duplicate","data-action-archive","aria-label"])
    assert.ok(controls.includes(x),x);
  assert.ok(flow.includes("calc-dist3-chrome-authenticated-private-save.mjs"));
  for(const action of ["data-action-rename","data-action-duplicate","data-action-archive",
    "UNAUTHORIZED","deniedTechnical","Archived original must be absent","Duplicate must preserve"])
    assert.ok(authenticated.includes(action),action);
});
