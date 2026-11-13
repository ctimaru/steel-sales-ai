import "server-only";
import {createClient} from "@supabase/supabase-js";
import {stripeCall,stripeId} from "@/lib/netpro-billing-stripe.server";

type StripeRecord=Record<string,unknown>;
type Intent={
  id:string;organization_id:string;stripe_price_id:string;stripe_checkout_session_id:string|null;
  stripe_subscription_id:string|null;stripe_customer_id:string|null;status:string;
};
function asObject(value:unknown):StripeRecord|null{
  return value&&typeof value==="object"&&!Array.isArray(value)?value as StripeRecord:null;
}
function getId(value:unknown,prefix:string):string|null{
  const id=typeof value==="string"?value:asObject(value)?.id;
  return stripeId(id,prefix)?id:null;
}
export function billingDb(){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!key)throw new Error("billing_service_unconfigured");
  return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
}
function stripeModeMatches(objects:StripeRecord[]){
  const live=process.env.STRIPE_SECRET_KEY?.startsWith("sk_live_");
  return typeof live==="boolean" && objects.every(item=>item.livemode===live);
}

export type ReconcileResult=
  |{status:"active";paidUntil:string}
  |{status:"pending"|"not_found"};

export async function reconcilePaidCheckout(intentId:string):Promise<ReconcileResult>{
  if(!/^[0-9a-f-]{36}$/i.test(intentId))return {status:"not_found"};
  const db=billingDb();
  const {data,error}=await db.from("network_pro_checkout_intents")
    .select("id,organization_id,stripe_price_id,stripe_checkout_session_id,stripe_subscription_id,stripe_customer_id,status")
    .eq("id",intentId).maybeSingle();
  if(error||!data)return {status:"not_found"};
  const intent=data as Intent;
  if(!intent.stripe_checkout_session_id||intent.status==="expired"||intent.status==="canceled")
    return {status:"pending"};
  if(!stripeId(intent.stripe_checkout_session_id,"cs"))throw new Error("invalid_session_binding");

  // Fresh readback from Stripe every time, not from the browser redirect or webhook payload.
  const session=await stripeCall<StripeRecord>("/checkout/sessions/"+intent.stripe_checkout_session_id);
  if(!stripeModeMatches([session])||session.id!==intent.stripe_checkout_session_id||
     session.mode!=="subscription"||
     session.client_reference_id!==intent.id||
     session.status!=="complete"||
     session.payment_status!=="paid"){
    return {status:"pending"};
  }
  const subscriptionId=getId(session.subscription,"sub");
  const customerId=getId(session.customer,"cus");
  if(!subscriptionId||!customerId)return {status:"pending"};
  if(intent.stripe_subscription_id&&intent.stripe_subscription_id!==subscriptionId)throw new Error("subscription_mismatch");
  if(intent.stripe_customer_id&&intent.stripe_customer_id!==customerId)throw new Error("customer_mismatch");

  const subscription=await stripeCall<StripeRecord>("/subscriptions/"+subscriptionId);
  const metadata=asObject(subscription.metadata)||{};
  const customerInSubscription=getId(subscription.customer,"cus");
  const items=asObject(subscription.items)?.data;
  const single=Array.isArray(items)&&items.length===1?asObject(items[0]):null;
  const priceId=getId(single?.price,"price");
  const periodEnd=single?.current_period_end??subscription.current_period_end;
  if(!stripeModeMatches([session,subscription])||
     subscription.id!==subscriptionId||
     subscription.status!=="active"||customerInSubscription!==customerId||
     metadata.netpro_intent_id!==intent.id||priceId!==intent.stripe_price_id||
     !Number.isSafeInteger(periodEnd)||Number(periodEnd)*1000<=Date.now()||
     Number(periodEnd)*1000>Date.now()+370*86400_000){
    return {status:"pending"};
  }
  const invoiceId=getId(subscription.latest_invoice,"in");
  if(!invoiceId)return {status:"pending"};
  const invoice=await stripeCall<StripeRecord>("/invoices/"+invoiceId);
  if(!stripeModeMatches([session,subscription,invoice])||
     invoice.id!==invoiceId||invoice.status!=="paid"||invoice.paid!==true||
     invoice.paid_out_of_band===true||invoice.collection_method!=="charge_automatically"||
     invoice.currency!=="eur"||
     typeof invoice.amount_paid!=="number"||invoice.amount_paid<=0||
     getId(invoice.customer,"cus")!==customerId){
    return {status:"pending"};
  }
  const {data:applied,error:applyError}=await db.rpc("netpro_f2_apply_paid_period",{
    p_intent_id:intent.id,
    p_session_id:intent.stripe_checkout_session_id,
    p_subscription_id:subscriptionId,
    p_customer_id:customerId,
    p_price_id:intent.stripe_price_id,
    p_invoice_id:invoiceId,
    p_paid_until:new Date(Number(periodEnd)*1000).toISOString(),
  });
  if(applyError)throw new Error("billing_entitlement_commit_failed");
  if(applied?.status!=="active"&&applied?.status!=="already_recorded")
    throw new Error("billing_entitlement_unexpected_state");
  return {status:"active",paidUntil:new Date(Number(periodEnd)*1000).toISOString()};
}

export async function reconcileStripeSubscription(subscriptionId:string):Promise<ReconcileResult>{
  if(!stripeId(subscriptionId,"sub"))return {status:"not_found"};
  const subscription=await stripeCall<StripeRecord>("/subscriptions/"+subscriptionId);
  const intentId=asObject(subscription.metadata)?.netpro_intent_id;
  if(typeof intentId!=="string")return {status:"not_found"};
  return reconcilePaidCheckout(intentId);
}

export async function expireStripeSession(sessionId:string){
  if(!stripeId(sessionId,"cs"))return;
  const session=await stripeCall<StripeRecord>("/checkout/sessions/"+sessionId);
  if(session.status!=="expired")return;
  const {error}=await billingDb().rpc("netpro_f2_expire_checkout",{p_session_id:sessionId});
  if(error)throw new Error("billing_session_expire_failed");
}

export async function endStripeSubscription(subscriptionId:string,customerId:string,eventId:string){
  if(!stripeId(subscriptionId,"sub")||!stripeId(customerId,"cus")||!stripeId(eventId,"evt"))return;
  const db=billingDb();
  const {error}=await db.rpc("netpro_f2_end_subscription",{
    p_subscription_id:subscriptionId,p_customer_id:customerId,p_event_id:eventId,
  });
  if(error)throw new Error("billing_revoke_failed");
}
