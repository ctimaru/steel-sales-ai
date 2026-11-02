import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import ts from "typescript";

const read=path=>readFileSync(new URL(path,import.meta.url),"utf8");
const load=async path=>{
  const source=read(path).replace(/^import .*;$/gm,"");
  const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText;
  return import("data:text/javascript;base64,"+Buffer.from(js).toString("base64"));
};
globalThis.process??={env:{}};
const sql=read("../../../supabase/migrations/20261102110000_netcontact1_public_company_channels.sql");
const sqlTest=read("../../../supabase/tests/netcontact1_public_company_channels.sql");
const gate=read("../../../.github/workflows/p0-required-gate.yml");
const workflow=read("../../../.github/workflows/netcontact1-public-contacts.yml");
const worker=read("../../../services/worker/app/netcontact1_public_contacts.py");
const reach=read("../lib/network-rfq-reachability.ts");
const listing=read("../lib/network-compact-directory.ts");
const ui=read("../components/network-compact-experience.tsx");
const actions=read("../app/(italian)/(workspace)/marketplace/rfq-hub/network-handoff-actions.ts");
const receiver=read("../components/rfq-network-supplier-receiver.tsx");
const consolePage=read("../app/(italian)/(platform)/platform/company-discovery/contacts/page.tsx");
const consoleActions=read("../app/(italian)/(platform)/platform/company-discovery/contacts/actions.ts");
const profile=read("../app/(italian)/(workspace)/network/[id]/page.tsx");
const handoff=await load("../lib/network-rfq-supplier-handoff.ts");

test("NET-CONTACT1 SQL stages only company channels, never publishes",()=>{
  assert.match(sql,/private\.netcontact1_generic_local_part/);
  assert.match(sql,/private\.netcontact1_domain_matches/);
  assert.match(sql,/'pending_review',v_source,v_assertion,now\(\)/);
  assert.match(sql,/'public_web',v_source,'platform_curated'/);
  assert.match(sql,/Founder decision: personal or foreign-domain addresses are never staged/);
  assert.match(sql,/Source must be on the company website/);
  // Staging never writes a published row; publication only through LR4.
  const stage=sql.split("create or replace function public.netcontact1_stage_company_channel")[1].split("create or replace function")[0];
  assert.doesNotMatch(stage,/'published'\)|publication_status='published',|lr4_review_contact_privacy_impl/);
  assert.match(sql,/private\.lr4_review_contact_privacy_impl\(v_id,'company_channel',null,null,/);
  assert.match(sql,/perform private\.require_platform_permission\('network\.privacy_governance_review'\)/);
  assert.match(sql,/revoke all on function public\.netcontact1_stage_company_channel\(uuid,text,text,text\) from public,anon,authenticated;/);
  assert.match(sql,/grant execute on function public\.netcontact1_stage_company_channel\(uuid,text,text,text\) to service_role;/);
  assert.doesNotMatch(sql,/update public\.network_data_assertions/,"assertions stay immutable");
});

test("NET-CONTACT1 reachability: paid guard, same rule as rfqh2_add_supplier, address never returned",()=>{
  const fn=sql.split("create or replace function public.netcontact1_rfq_reachability")[1];
  assert.match(fn,/private\.pa1_3_require_network_access\(p_organization_id\)/);
  assert.match(fn,/private\.rfqh2_best_network_contact/);
  assert.match(fn,/'company_id',r->>'company_id','channel'/);
  assert.doesNotMatch(fn,/'email',\s*(nc\.|b\.|x\.)?email/);
  assert.match(reach,/error\.code === "PGRST202" && readiness/);
  assert.match(reach,/netcontact1-reach-v1/);
});

test("NET-CONTACT1 selection accepts platform or email reachability only",()=>{
  assert.equal(handoff.isRfqReachable("available",undefined),true);
  assert.equal(handoff.isRfqReachable("unavailable","email"),true);
  assert.equal(handoff.isRfqReachable("unavailable","none"),false);
  assert.equal(handoff.isRfqReachable("pending","none"),false);
  assert.equal(handoff.isRfqReachable(undefined,undefined),false);
  assert.match(listing,/access==="pro"&&ids\.length/);
  assert.match(listing,/getNetworkRfqReachability\(organizationId,ids,map\)/);
  assert.match(ui,/const EMAIL_REACHABLE_LABEL="Contattabile via email";/);
  assert.match(ui,/data-testid="network-email-reachable"/);
  assert.match(actions,/getNetworkRfqReachability\(organizationId, ids, readiness\)/);
  assert.match(receiver,/Via email aziendale/);
});

test("NET-CONTACT1 Platform console is root-only and bulk",()=>{
  assert.match(consolePage,/await requirePlatformSuperadmin\(\);/);
  assert.match(consoleActions,/await requirePlatformSuperadmin\(\);/);
  assert.match(consolePage,/netcontact1_pending_company_channels/);
  assert.match(consoleActions,/netcontact1_approve_company_channels/);
  assert.match(consoleActions,/netcontact1_reject_company_channels/);
  assert.match(consolePage,/defaultChecked/);
  assert.match(consolePage,/Nomi di persona e cellulari non entrano mai/);
  assert.doesNotMatch(consolePage+consoleActions,/service_role|createAdminClient/);
});

test("NET-CONTACT1 crawler: exact domain, dry-run default, main-only workflow, CI registered",()=>{
  assert.match(worker,/from \.netcompact4b_geo_batch import contact_links/);
  assert.match(worker,/mobile or non-geographic: never treated as a switchboard/);
  assert.match(worker,/mode="pending_review_staging" if persist else "dry_run"/);
  assert.match(workflow,/workflow_dispatch:/);
  assert.match(workflow,/if: github\.ref == 'refs\/heads\/main'/);
  assert.match(workflow,/persist_pending_review:[\s\S]*?default: false/);
  assert.match(gate,/netcontact1_public_company_channels\.sql/);
  assert.match(sqlTest,/personal address never staged/);
  assert.match(sqlTest,/pending channel is not RFQ-usable/);
});

test("NET-CONTACT1 profile shows reviewed channels as mailto/tel links",()=>{
  assert.match(profile,/href=\{"mailto:" \+ contact\.email\}/);
  assert.match(profile,/href=\{"tel:" \+ contact\.phone\.replace/);
  assert.match(profile,/sales: "Commerciale"/);
});
