import {NextRequest,NextResponse} from "next/server";
import {verifyStripeSignature,stripeId} from "@/lib/netpro-billing-stripe.server";
import {
  reconcilePaidCheckout,reconcileStripeSubscription,expireStripeSession,endStripeSubscription,
} from "@/lib/netpro-billing-reconcile.server";

export const runtime="nodejs";
export const dynamic="force-dynamic";

type Event={id?:unknown;type?:unknown;livemode?:unknown;data?:{object?:Record<string,unknown>}};
const response=(status:number)=>NextResponse.json({ok:status===200},{status});
const ref=(v:unknown,prefix:string)=>stripeId(v,prefix)?v:null;

function invoiceSubscription(object:Record<string,unknown>):string|null{
  const parent=object.parent as {subscription_details?:{subscription?:unknown}}|undefined;
  const lines=object.lines as {data?:Array<{parent?:{subscription_item_details?:{subscription?:unknown}}}>}|undefined;
  return ref(object.subscription,"sub")||
    ref(parent?.subscription_details?.subscription,"sub")||
    ref(lines?.data?.[0]?.parent?.subscription_item_details?.subscription,"sub");
}

/** Stripe retries non-200 results. Never accept client-created payment claims. */
export async function POST(request:NextRequest){
  const secret=process.env.STRIPE_WEBHOOK_SECRET;
  if(!secret||!process.env.STRIPE_SECRET_KEY)return response(503);
  const raw=await request.text();
  if(raw.length>250_000||!verifyStripeSignature(raw,request.headers.get("stripe-signature"),secret))
    return response(400);
  let event:Event;
  try{event=JSON.parse(raw) as Event;}catch{return response(400);}
  if(!stripeId(event.id,"evt")||typeof event.type!=="string")return response(400);
  const live=process.env.STRIPE_SECRET_KEY.startsWith("sk_live_");
  if(event.livemode!==live)return response(400);
  const data=event.data?.object||{};
  try{
    switch(event.type){
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": {
        const sessionId=ref(data.id,"cs");
        const intentId=typeof data.client_reference_id==="string"?data.client_reference_id:null;
        const metadata=data.metadata as {netpro_intent_id?:unknown}|undefined;
        if(sessionId&&intentId&&metadata?.netpro_intent_id===intentId){
          const result=await reconcilePaidCheckout(intentId);
          // Stripe retries a non-2xx webhook. A paid subscription must not
          // be acknowledged until its automatic entitlement commit succeeds.
          if(data.payment_status==="paid"&&result.status==="pending")
            throw new Error("paid_session_not_reconciled");
        }
        break;
      }
      case "invoice.paid": {
        const id=invoiceSubscription(data);
        if(id){
          const result=await reconcileStripeSubscription(id);
          if(result.status==="pending")throw new Error("paid_invoice_not_reconciled");
        }
        break;
      }
      case "customer.subscription.deleted": {
        const id=ref(data.id,"sub"),customer=ref(data.customer,"cus");
        if(id&&customer)await endStripeSubscription(id,customer,event.id);
        break;
      }
      case "checkout.session.expired":{
        const id=ref(data.id,"cs");
        if(id)await expireStripeSession(id);
        break;
      }
      // A failed renewal never creates a grant; the previously paid
      // expires_at is enforced by the database's scope authorization.
      case "invoice.payment_failed":
      case "checkout.session.async_payment_failed":
        break;
      default:
        break;
    }
    return response(200);
  }catch{
    // No raw payload, PII, secrets or card data in logs.
    console.error("NETPRO-F2 webhook reconciliation failed");
    return response(500);
  }
}
