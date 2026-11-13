import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {createHmac} from "node:crypto";
import ts from "typescript";

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
  assert.match(stripe,/NETPRO_BILLING_ENABLED!=="true"/);
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
  assert.match(view,/!billingReady\|\|!canCheckout\|\|!coverage\|\|hasPaidSubscription\|\|selected\.length===0\|\|isStarting/);
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


test("NETPRO F2 verifies actual Stripe HMAC, tampering, replay and invalid format",async()=>{
  // Compile the real TypeScript verifier to isolated ESM; no network or provider key.
  const pureSource=stripe.replace(/^import "server-only";\s*/m,"");
  const compiled=ts.transpileModule(pureSource,{
    compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022},
  }).outputText;
  const verifier=await import("data:text/javascript;base64,"+Buffer.from(compiled).toString("base64"));
  const now=1900000000;
  const body='{"id":"evt_test_valid","type":"invoice.paid"}';
  const secret="whsec_only_a_local_test_secret";
  const timestamp=String(now);
  const sig=createHmac("sha256",secret).update(timestamp+"."+body).digest("hex");
  const signature="t="+timestamp+",v1="+sig;
  assert.equal(verifier.verifyStripeSignature(body,signature,secret,now),true);
  assert.equal(verifier.verifyStripeSignature(body+" ",signature,secret,now),false);
  assert.equal(verifier.verifyStripeSignature(body,signature,secret,now+301),false);
  assert.equal(verifier.verifyStripeSignature(body,"t="+timestamp+",v1="+sig.slice(1),secret,now),false);
  assert.equal(verifier.verifyStripeSignature(body,"v1="+sig,secret,now),false);
  assert.equal(verifier.verifyStripeSignature(body,signature,"whsec_wrong_secret",now),false);
});

test("NETPRO F2 distinguishes retryable paid events from late canceled invoices",()=>{
  assert.match(hook,/data\.payment_status==="paid"&&result\.status==="pending"/);
  assert.match(reconcile,/if\(intent\.status==="expired"\|\|intent\.status==="canceled"\)\s*return \{status:"not_found"\}/);
  assert.match(reconcile,/if\(!intent\.stripe_checkout_session_id\)\s*return \{status:"pending"\}/);
});


test("NETPRO F1 requires complete 16-price Stripe checkout setup and cancel portal",async()=>{
  const pureSource=stripe.replace(/^import "server-only";\s*/m,"");
  const compiled=ts.transpileModule(pureSource,{
    compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022},
  }).outputText;
  const billing=await import("data:text/javascript;base64,"+Buffer.from(compiled).toString("base64"));
  const keys=["NETPRO_BILLING_ENABLED","STRIPE_SECRET_KEY","STRIPE_WEBHOOK_SECRET",
    "SUPABASE_SERVICE_ROLE_KEY","STRIPE_NETPRO_PORTAL_CONFIGURATION_ID",
    "NEXT_PUBLIC_SITE_URL","STRIPE_NETPRO_PRICE_IDS_JSON"];
  const before=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
  try{
    const prices={};
    for(const country of ["IT","EU"]){
      for(const period of ["monthly","annual"]){
        for(let count=1;count<=4;count++)
          prices[country+":"+period+":"+count]="price_validTestingPlan"+country+period+count;
      }
    }
    Object.assign(process.env,{
      NETPRO_BILLING_ENABLED:"true",
      STRIPE_SECRET_KEY:"sk_test_dummy_not_real",
      STRIPE_WEBHOOK_SECRET:"whsec_testing_only",
      SUPABASE_SERVICE_ROLE_KEY:"local-service-credential-not-real",
      STRIPE_NETPRO_PORTAL_CONFIGURATION_ID:"bpc_testingportal123",
      NEXT_PUBLIC_SITE_URL:"https://www.smartsteelsales.com",
      STRIPE_NETPRO_PRICE_IDS_JSON:JSON.stringify(prices),
    });
    assert.equal(billing.netProBillingEnabled(),true);
    assert.equal(billing.stripePriceId({territory:"IT",interval:"monthly",moduleCount:1}),
      prices["IT:monthly:1"]);
    delete prices["EU:annual:4"];
    process.env.STRIPE_NETPRO_PRICE_IDS_JSON=JSON.stringify(prices);
    assert.equal(billing.netProBillingEnabled(),false);
    process.env.STRIPE_NETPRO_PRICE_IDS_JSON=JSON.stringify({...prices,["EU:annual:4"]:"price_repairedtesting"});
    delete process.env.STRIPE_NETPRO_PORTAL_CONFIGURATION_ID;
    assert.equal(billing.netProBillingEnabled(),false);
    process.env.STRIPE_NETPRO_PORTAL_CONFIGURATION_ID="bpc_testingportal123";
    process.env.NETPRO_BILLING_ENABLED="false";
    assert.equal(billing.netProBillingEnabled(),false);
  }finally{
    for(const k of keys){
      if(before[k]===undefined)delete process.env[k];
      else process.env[k]=before[k];
    }
  }
});
