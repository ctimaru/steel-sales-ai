import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read=(p)=>fs.readFileSync(new URL("../"+p,import.meta.url),"utf8");
const stripe=read("lib/netpro-billing-stripe.server.ts");
const checkout=read("app/(italian)/(workspace)/network/pro/checkout-actions.ts");
const hook=read("app/api/webhooks/stripe-netpro/route.ts");
const reconcile=read("lib/netpro-billing-reconcile.server.ts");
const confirm=read("app/(italian)/(workspace)/network/pro/checkout-confirm.ts");
const success=read("app/(italian)/(workspace)/network/pro/checkout/success/page.tsx");
const view=read("components/network-pro-catalog.tsx");
const migration=read("../../supabase/migrations/20261113180000_netpro_f1_checkout_intents.sql");
const paid=read("../../supabase/migrations/20261113180500_netpro_f2_paid_entitlements.sql");

test("NETPRO F1 fail-closed: no checkout without provider and server-side price IDs",()=>{
  assert.match(stripe,/NETPRO_BILLING_ENABLED==="true"/);
  assert.match(stripe,/STRIPE_SECRET_KEY/);
  assert.match(stripe,/STRIPE_NETPRO_PRICE_IDS_JSON/);
  assert.match(stripe,/STRIPE_WEBHOOK_SECRET/);
  assert.match(stripe,/verifiedStripePrice/);
  assert.match(stripe,/price\.currency!=="eur"/);
  assert.match(stripe,/price\.recurring\?\.interval/);
  assert.match(checkout,/getWorkspaceContext/);
  assert.match(checkout,/context\.role!=="admin"/);
  assert.match(checkout,/new Set\(input\.modules\)\.size!==input\.modules\.length/);
  assert.match(checkout,/stripePriceId/);
  assert.match(checkout,/await verifiedStripePrice/);
  assert.match(checkout,/context\.organizationId/);
  assert.match(checkout,/stripe_checkout_session_id/);
  assert.match(checkout,/client_reference_id/);
  assert.match(checkout,/automatic_tax\[enabled\]/);
  assert.match(checkout,/netpro-f1-/);
  assert.doesNotMatch(checkout,/public\.netpro1b_module_event|grantEntitlement/);
});

test("NETPRO F1 browser has no direct checkout-intent storage or rights",()=>{
  assert.match(migration,/alter table public\.network_pro_checkout_intents enable row level security/);
  assert.match(migration,/revoke all on public\.network_pro_checkout_intents from public,anon,authenticated/);
  assert.match(migration,/where status in \('pending','paid'\)/);
  assert.match(migration,/stripe_checkout_session_id text unique/);
  assert.match(view,/data-testid="netpro-f1-checkout"/);
  assert.match(view,/!billingReady\|\|!canCheckout\|\|!coverage\|\|selected\.length===0\|\|isStarting/);
  assert.match(view,/Abbonati e sblocca/);
  assert.match(view,/Nessuna richiesta o approvazione manuale/);
});

test("NETPRO F2 signed payment event is independently read back from Stripe before grants",()=>{
  assert.match(stripe,/createHmac\("sha256",secret\)/);
  assert.match(stripe,/timingSafeEqual/);
  assert.match(stripe,/Math\.abs\(nowSeconds-timestamp\)>300/);
  assert.match(hook,/verifyStripeSignature\(raw,request\.headers\.get\("stripe-signature"\),secret\)/);
  assert.match(hook,/case "invoice\.paid"/);
  assert.match(hook,/case "customer\.subscription\.deleted"/);
  assert.match(hook,/case "invoice\.payment_failed"/);
  assert.match(reconcile,/stripeCall<StripeRecord>\("\/checkout\/sessions\/"/);
  assert.match(reconcile,/stripeCall<StripeRecord>\("\/subscriptions\/"/);
  assert.match(reconcile,/stripeCall<StripeRecord>\("\/invoices\/"/);
  assert.match(reconcile,/invoice\.status!=="paid"/);
  assert.match(reconcile,/invoice\.paid!==true/);
  assert.match(reconcile,/invoice\.amount_paid<=0/);
  assert.match(reconcile,/metadata\.netpro_intent_id!==intent\.id/);
  assert.match(reconcile,/priceId!==intent\.stripe_price_id/);
  assert.match(reconcile,/stripeModeMatches\(\[session,subscription,invoice\]\)/);
});

test("NETPRO F2 atomic, idempotent, service-only entitlement lifecycle",()=>{
  assert.match(paid,/auth\.role\(\)/);
  assert.match(paid,/service_role/);
  assert.match(paid,/for update/);
  assert.match(paid,/p_paid_until<=v\.paid_until/);
  assert.match(paid,/insert into public\.organization_product_entitlement_events/);
  assert.match(paid,/on conflict \(idempotency_key\) do nothing/);
  assert.match(paid,/p_paid_until/);
  assert.match(paid,/grant execute on function public\.netpro_f2_apply_paid_period[^;]+to service_role/s);
  assert.match(paid,/grant execute on function public\.netpro_f2_end_subscription[^;]+to service_role/s);
  assert.doesNotMatch(paid,/grant execute on function public\.netpro_f2_apply_paid_period[^;]+to authenticated/s);
  assert.match(reconcile,/netpro_f2_apply_paid_period/);
  assert.match(reconcile,/netpro_f2_end_subscription/);
  assert.match(confirm,/eq\("organization_id",context\.organizationId\)/);
  assert.match(success,/confirmNetworkProCheckout/);
  assert.match(success,/result\.status==="active"/);
  assert.doesNotMatch(success,/netpro1b_module_event|createClient/);
});
