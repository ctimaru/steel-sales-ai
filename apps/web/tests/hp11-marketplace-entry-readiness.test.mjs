import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

function read(path) {
  return fs.readFileSync(new URL(path, import.meta.url), "utf8");
}

const migration = read("../../../supabase/migrations/20261001144500_hp11_marketplace_readiness_read_model.sql");
const readiness = read("../lib/marketplace-readiness.ts");
const readinessUi = read("../components/marketplace-readiness.tsx");
const feed = read("../app/(workspace)/marketplace/page.tsx");
const newRequest = read("../app/(workspace)/marketplace/new/page.tsx");
const requestDetail = read("../app/(workspace)/marketplace/[id]/page.tsx");
const opportunity = read("../app/(workspace)/marketplace/opportunities/[id]/page.tsx");
const responseWorkspace = read("../components/marketplace-response-workspace.tsx");
const actions = read("../app/(workspace)/marketplace/actions.ts");

test("HP11 exposes a member-safe organization Marketplace readiness read model", () => {
  assert.match(migration, /hp11_marketplace_readiness_impl/);
  assert.match(migration, /v_user_id := \(select auth\.uid\(\)\)/);
  assert.match(migration, /om\.organization_id = p_organization_id/);
  assert.match(migration, /om\.user_id = v_user_id/);
  assert.match(migration, /om\.status = 'active'/);
  assert.doesNotMatch(migration, /om\.role\s*=\s*'admin'/);
  assert.match(migration, /security definer/);
  assert.match(migration, /security invoker/);
  assert.match(migration, /revoke all on function public\.hp11_marketplace_readiness\(uuid\)/);
  assert.match(migration, /grant execute on function public\.hp11_marketplace_readiness\(uuid\)[\s\S]*authenticated/);
});

test("HP11 readiness mirrors the governed P5.5 supplier matching prerequisites", () => {
  assert.match(migration, /c\.publication_status/);
  assert.match(migration, /l\.link_status = 'active'/);
  assert.match(migration, /'produces'/);
  assert.match(migration, /'distributes'/);
  assert.match(migration, /'stocks'/);
  assert.match(migration, /'processes'/);
  assert.match(migration, /network_company_product_standard_scopes/);
  assert.match(migration, /network_company_product_grade_scopes/);
  assert.match(migration, /network_company_product_dimension_scopes/);
  assert.match(migration, /named_publication_ready/);
  assert.match(migration, /supplier_matching_ready/);
});

test("HP11 frontend consumes the dedicated readiness RPC instead of the admin-only profile helper", () => {
  assert.match(readiness, /hp11_marketplace_readiness/);
  assert.match(readiness, /p_organization_id: organizationId/);
  assert.doesNotMatch(readiness, /getManagedNetworkCompany/);
  assert.doesNotMatch(readiness, /getManagedNetworkProfileState/);
  assert.match(readiness, /namedPublicationReady/);
  assert.match(readiness, /matchingReady/);
});

test("HP11 Marketplace entry explains buyer and supplier readiness with corrective CTAs", () => {
  assert.match(feed, /MarketplaceReadinessPanel/);
  assert.match(feed, /getMarketplaceEntryReadiness\(context\.organizationId, context\.role\)/);
  assert.match(readinessUi, /Marketplace readiness/);
  assert.match(readinessUi, /Pubblica una ricerca/);
  assert.match(readinessUi, /Ricevi match e rispondi/);
  assert.match(readinessUi, /Gestisci Company Profile/);
  assert.match(readinessUi, /Da completare/);
  assert.match(readinessUi, /Migliorabile/);
  assert.match(readiness, /canAdministerCompany/);
  assert.match(readiness, /Chiedi a un Organization Admin/);
  assert.match(readinessUi, /Azione:/);
});

test("HP11 preflights named buyer publication before the database rejects it", () => {
  assert.match(newRequest, /Pubblicazione named pronta/);
  assert.match(newRequest, /Pubblicazione named da completare/);
  assert.match(newRequest, /Completa Company Profile/);
  assert.match(requestDetail, /const publishReady/);
  assert.match(requestDetail, /request\.visibility_mode === "anonymous"/);
  assert.match(requestDetail, /readiness\.buyer\.namedPublicationReady/);
  assert.match(requestDetail, /disabled=\{!publishReady\}/);
  assert.match(requestDetail, /salva la richiesta come anonima/);
  assert.match(readinessUi, /Readiness pubblicazione/);
});

test("HP11 keeps anonymous publication as a valid alternative without weakening named rules", () => {
  assert.match(readinessUi, /Modalità anonima/);
  assert.match(readinessUi, /Company Profile pubblico non è un prerequisito/);
  assert.match(requestDetail, /visibility_mode === "anonymous"/);
  assert.match(newRequest, /value="anonymous"/);
  assert.match(newRequest, /modalità anonima/);
});

test("HP11 turns supplier entitlement and role blockers into next actions", () => {
  assert.match(opportunity, /Accesso ai dettagli richiesto/);
  assert.match(opportunity, /Apri opportunità per te/);
  assert.match(opportunity, /Migliora Company Profile/);
  assert.match(opportunity, /Opportunità leggibile, risposta non abilitata per il tuo ruolo/);
  assert.match(opportunity, /Organization Admin/);
  assert.match(responseWorkspace, /reasonAction/);
  assert.match(responseWorkspace, /Torna alle opportunità aperte/);
  assert.match(responseWorkspace, /Riapri il dettaglio opportunità/);
  assert.match(responseWorkspace, /Response blocker/);
});

test("HP11 humanizes known backend failures and does not leak generic database internals", () => {
  assert.match(actions, /marketplaceIssueFromError/);
  assert.match(actions, /blocker=/);
  assert.match(readiness, /buyer_profile_not_published/);
  assert.match(readiness, /request_line_required/);
  assert.match(readiness, /entitlement_required/);
  assert.match(readiness, /unlock_required/);
  assert.match(readiness, /priced_line_required/);
  assert.match(readiness, /marketplace_operation_failed/);
  assert.match(readiness, /Operazione Marketplace non completata/);
});

test("HP11 preserves Marketplace boundaries and never turns readiness into authority", () => {
  assert.match(readinessUi, /Commercial Memory/);
  assert.match(opportunity, /L’accesso è gestito a livello organizzazione/);
  assert.match(opportunity, /diritto di risposta viene verificato separatamente/);
  assert.doesNotMatch(migration, /marketplace_entitlement_events|marketplace_unlocks|marketplace_responses/);
  assert.doesNotMatch(migration, /insert\s+into\s+public\.(rfqs|offers|orders)/i);
  assert.doesNotMatch(readiness, /grantMarketplace|p5_3_grant_entitlement/);
});
