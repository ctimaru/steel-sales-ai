import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import ts from "typescript";

const source = fs.readFileSync(new URL("../lib/prod-next1e-pilot-readiness.ts", import.meta.url), "utf8");
const actions = fs.readFileSync(new URL("../app/(platform)/platform/pilot/actions.ts", import.meta.url), "utf8");
const page = fs.readFileSync(new URL("../app/(platform)/platform/pilot/page.tsx", import.meta.url), "utf8");
const dashboard = fs.readFileSync(new URL("../components/prod-next1e-pilot-activation-dashboard.tsx", import.meta.url), "utf8");
const transpiled = ts.transpileModule(source, {compilerOptions:{
  module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022
}}).outputText;
const {evaluatePilot2027Admission,PILOT_2027_METRICS,PILOT_2027_REAL_METRICS_ENABLED} =
  await import("data:text/javascript;base64,"+Buffer.from(transpiled).toString("base64"));

const id="00000000-0000-0000-0000-000000023301";
const evidence={
  organization_id:id,
  signed_pilot_agreement_ref:"agreement-2027-v1",
  approved_privacy_notice_ref:"privacy-2027-v1",
  lawful_basis_review_ref:"lawful-basis-2027-v1",
  data_retention_and_deletion_ref:"retention-2027-v1",
  backup_restore_drill_ref:"restore-2027-v1",
  support_and_incident_plan_ref:"support-2027-v1",
  founder_approval_ref:"founder-2027-v1",
  approved_at:"2026-10-28T10:00:00.000Z",
  expires_at:"2026-11-28T10:00:00.000Z"
};
const env={PILOT_2027_ACTIVATION_ENABLED:"enabled",PILOT_2027_APPROVALS_JSON:JSON.stringify([evidence])};

test("PROD-NEXT1.E defaults fail-closed for unknown or unsupported organizations",()=>{
  assert.equal(evaluatePilot2027Admission(id,true,{}).ready,false);
  assert.equal(evaluatePilot2027Admission(id,true,{PILOT_2027_ACTIVATION_ENABLED:"enabled"}).ready,false);
  assert.equal(evaluatePilot2027Admission("invalid",true,env).ready,false);
  assert.equal(evaluatePilot2027Admission("00000000-0000-0000-0000-000000023302",true,env).ready,false);
  assert.equal(evaluatePilot2027Admission(id,false,env).ready,false);
  assert.equal(evaluatePilot2027Admission(id,true,{...env,PILOT_2027_APPROVALS_JSON:"invalid json"}).ready,false);
  assert.equal(evaluatePilot2027Admission(id,true,{...env,PILOT_2027_APPROVALS_JSON:JSON.stringify([evidence,evidence])}).ready,false);
});

test("PROD-NEXT1.E requires every signed approval and a current evidence window",()=>{
  assert.equal(evaluatePilot2027Admission(id,true,env).ready,true);
  for(const key of ["signed_pilot_agreement_ref","approved_privacy_notice_ref","lawful_basis_review_ref",
    "data_retention_and_deletion_ref","backup_restore_drill_ref","support_and_incident_plan_ref","founder_approval_ref"]){
    const incomplete={...evidence,[key]:""};
    assert.equal(evaluatePilot2027Admission(id,true,{
      ...env,PILOT_2027_APPROVALS_JSON:JSON.stringify([incomplete])
    }).ready,false,"Missing approval must block: "+key);
  }
  assert.equal(evaluatePilot2027Admission(id,true,{
    ...env,PILOT_2027_APPROVALS_JSON:JSON.stringify([{...evidence,expires_at:"2026-10-27T00:00:00Z"}])
  }).ready,false);
  assert.equal(evaluatePilot2027Admission(id,true,{
    ...env,PILOT_2027_APPROVALS_JSON:JSON.stringify([{...evidence,expires_at:"2027-06-28T10:00:00Z"}])
  }).ready,false);
  assert.equal(evaluatePilot2027Admission(id,true,{...env,PILOT_2027_ACTIVATION_ENABLED:"false"}).ready,false);
});

test("PROD-NEXT1.E guards activate/resume on server side and superadmin only",()=>{
  const part=actions.slice(actions.indexOf("export async function transitionMarketplacePilotParticipant"));
  const gate=part.indexOf('if (action === "activate" || action === "resume")');
  const rpc=part.indexOf('supabase.rpc("p5_6a_transition_participant"');
  assert.ok(gate>=0 && rpc>gate);
  assert.match(part,/await requirePlatformSuperadmin\(\)/);
  assert.match(part,/getMarketplacePilotControl\(\)/);
  assert.match(part,/evaluatePilot2027Admission\(/);
  assert.match(part,/if \(!admission.ready\)/);
  assert.match(page,/admissionReady=\{pilotAdmissionByParticipant.get\(participant.participant_id\) === true\}/);
  assert.match(page,/disabled=\{!readiness.ready \|\| !admissionReady\}/);
  assert.match(page,/ProdNext1ePilotActivationDashboard/);
});

test("PROD-NEXT1.E five business-state metrics remain unmeasured until legally authorized",()=>{
  assert.deepEqual(PILOT_2027_METRICS.map(x=>x.key),[
    "valid_bill_created","private_rfq_draft_saved","supplier_selection_reviewed",
    "qualified_quote_submitted","po_confirmed"
  ]);
  assert.equal(PILOT_2027_REAL_METRICS_ENABLED,false);
  assert.match(dashboard,/NON MISURATO/);
  assert.match(dashboard,/Raccolta eventi reali disattivata nel codice/);
  assert.match(dashboard,/data-testid="prod-next1e-readiness-dashboard"/);
  assert.doesNotMatch(dashboard,/recordPilotUsageEvent/);
});
