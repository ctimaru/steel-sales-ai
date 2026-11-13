import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const get=(path)=>fs.readFileSync(new URL("../"+path,import.meta.url),"utf8");
const migration=get("../../supabase/migrations/20261113160500_net_pro_catalog1e_activation_request.sql");
const server=get("app/(italian)/(workspace)/network/pro/actions.ts");
const page=get("app/(italian)/(workspace)/network/pro/page.tsx");
const ui=get("components/network-pro-catalog.tsx");
const catalog=get("lib/network-pro-catalog.ts");

test("NET-PRO-CATALOG1.E persists requests, not subscriptions, with tenant isolation",()=>{
  assert.match(migration,/create table public\.network_pro_activation_requests/);
  assert.match(migration,/organization_id uuid not null references public\.organizations/);
  assert.match(migration,/alter table public\.network_pro_activation_requests enable row level security/);
  assert.match(migration,/revoke all on table public\.network_pro_activation_requests from public, anon, authenticated/);
  assert.match(migration,/security definer set search_path=''/);
  assert.match(migration,/m\.user_id=v_user/);
  assert.match(migration,/m\.status='active' and m\.role='admin'/);
  assert.match(migration,/m\.organization_id=p_organization_id/);
  assert.match(migration,/o\.onboarding_status is distinct from 'suspended'/);
  assert.match(migration,/on conflict \(organization_id\) where request_status='requested'/);
  assert.match(migration,/request_status in \('requested','contacted','closed','declined'\)/);
  assert.match(migration,/grant execute on function public\.netpro1e_request_activation[^;]*to authenticated,service_role/s);
  assert.doesNotMatch(migration,/insert into public\.organization_product_entitlement_events/i);
  assert.doesNotMatch(migration,/netpro1b_module_event\s*\(/i);
  assert.doesNotMatch(migration,/create\s+policy\s+.*to\s+authenticated/i);
});

test("NET-PRO-CATALOG1.E authenticates request caller, validates module/period/area, and does not trust client quote",()=>{
  assert.match(server,/"use server"/);
  assert.match(server,/getWorkspaceContext/);
  assert.match(server,/context\.role!=="admin"/);
  assert.match(server,/context\.organizationId/);
  assert.match(server,/new Set\(input\.modules\)\.size!==input\.modules\.length/);
  assert.match(server,/input\.modules\.some\(module=>/);
  assert.match(server,/netpro1e_request_activation/);
  assert.doesNotMatch(server,/service_role|SERVICE_ROLE_KEY|grantEntitlement|paymentIntent/i);
  assert.doesNotMatch(migration,/monthly_price|annual_price|amount_cents|payment_status/i);
});

test("NET-PRO-CATALOG1.E UI makes enquiry non-binding and shows success only after RPC",()=>{
  assert.match(page,/canRequestActivation=\{context\.role==="admin"/);
  assert.match(ui,/data-testid="netpro1e-request"/);
  assert.match(ui,/onClick=\{requestActivation\}/);
  assert.match(ui,/!canRequestActivation\|\|selected\.length===0\|\|!coverage\|\|isSubmitting/);
  assert.match(ui,/requestNetworkProActivation\(\{modules:selected,territory,billing\}\)/);
  assert.match(ui,/requestStatus\.status==="recorded"/);
  assert.match(ui,/Nessun pagamento, ordine o diritto PRO nasce da questa richiesta/);
  assert.match(ui,/role="status" aria-live="polite"/);
  assert.match(catalog,/purchasable: false as const/);
});
