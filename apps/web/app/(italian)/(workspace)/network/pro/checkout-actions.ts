"use server";

import {createClient as createServiceClient} from "@supabase/supabase-js";
import {getWorkspaceContext} from "@/lib/workspace-context";
import {isNetworkFrontendEnabled} from "@/lib/network-flags";
import {NETWORK_PRO_MODULES,networkProQuote,type NetworkProModuleKey,type NetworkProTerritory} from "@/lib/network-pro-catalog";
import {
  netProBillingEnabled,stripePriceId,stripeCall,verifiedStripePrice,trustedBillingOrigin,
  type NetProBillingInterval,verifyNetworkProPortalReady,
} from "@/lib/netpro-billing-stripe.server";

type CheckoutRequest={
  modules:NetworkProModuleKey[];
  territory:NetworkProTerritory;
  interval:NetProBillingInterval;
};
type CheckoutResult={status:"ready";url:string}|{status:"unavailable"|"invalid"|"forbidden";message:string};
const moduleKeys=new Set<string>(NETWORK_PRO_MODULES.map(m=>m.key));

function serviceDb(){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!key)throw new Error("netpro_service_unconfigured");
  return createServiceClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
}

export async function startNetworkProCheckout(input:CheckoutRequest):Promise<CheckoutResult>{
  if(!isNetworkFrontendEnabled()||!netProBillingEnabled())
    return {status:"unavailable",message:"Abbonamenti online non ancora disponibili."};

  if(!input||!Array.isArray(input.modules)||
    input.modules.length<1||input.modules.length>4||
    new Set(input.modules).size!==input.modules.length||
    input.modules.some(key=>typeof key!=="string"||!moduleKeys.has(key))||
    !["IT","EU"].includes(input.territory)||
    !["monthly","annual"].includes(input.interval))
    return {status:"invalid",message:"Seleziona moduli, territorio e periodicità validi."};

  const context=await getWorkspaceContext();
  if(context.role!=="admin"||context.onboardingStatus==="suspended")
    return {status:"forbidden",message:"Solo l’amministratore aziendale può acquistare Network PRO."};

  const priceId=stripePriceId({
    territory:input.territory,interval:input.interval,
    moduleCount:input.modules.length as 1|2|3|4,
  });
  const origin=trustedBillingOrigin();
  if(!priceId||!origin)
    return {status:"unavailable",message:"Il listino di pagamento non è ancora configurato."};

  try{
    // Never take a payment until self-service cancel/invoice/payment methods work.
    await verifyNetworkProPortalReady();
    const verifiedPrice=await verifiedStripePrice(priceId,input.interval);
    // Billing must never silently charge a different amount than the on-page quote.
    // Stripe Tax calculates additional taxes in Stripe Checkout.
    const publishedQuote=networkProQuote(input.modules,input.territory,input.interval);
    if(verifiedPrice.unit_amount!==Math.round(publishedQuote.displayedTotal*100))
      return {status:"unavailable",message:"Il listino non corrisponde al prezzo configurato. Nessun addebito eseguito."};
    const db=serviceDb();
    const modules=[...input.modules].sort();

    // A lost redirect must not strand the customer or generate a second
    // billable subscription. Resume the existing session for this company.
    const {data:existing,error:lookupError}=await db.from("network_pro_checkout_intents")
      .select("id,created_by,module_keys,territory,billing_interval,stripe_price_id,stripe_checkout_session_id,status")
      .eq("organization_id",context.organizationId)
      .in("status",["pending","paid"]).maybeSingle();
    if(lookupError)throw new Error("checkout_lookup_failed");
    if(existing){
      if(existing.status==="paid")return {
        status:"invalid",message:"Hai già un abbonamento attivo. Gestiscilo dal portale.",
      };
      if(existing.created_by!==context.userId||
         existing.territory!==input.territory||
         existing.billing_interval!==input.interval||
         existing.stripe_price_id!==priceId||
         JSON.stringify(existing.module_keys)!==JSON.stringify(modules))
        return {status:"invalid",message:"Esiste già un checkout aziendale in corso. Completalo prima di cambiarne i moduli."};
      if(!existing.stripe_checkout_session_id)
        return {status:"invalid",message:"Il checkout aziendale è in preparazione. Ripeti l'operazione tra poco."};
      const remote=await stripeCall<{id:string;url:string|null;status:string;client_reference_id:string;expires_at:number}>(
        "/checkout/sessions/"+existing.stripe_checkout_session_id
      );
      if(remote.id!==existing.stripe_checkout_session_id||
         remote.client_reference_id!==existing.id)throw new Error("checkout_resume_mismatch");
      if(remote.status==="expired"){
        const {error:expireError}=await db.from("network_pro_checkout_intents")
          .update({status:"expired",updated_at:new Date().toISOString()})
          .eq("id",existing.id).eq("status","pending");
        if(expireError)throw new Error("checkout_resume_expire_failed");
      }else if(remote.status==="complete"){
        return {status:"ready",url:origin+"/network/pro/checkout/success?session_id="+encodeURIComponent(remote.id)};
      }else if(remote.status==="open"&&remote.expires_at>Date.now()/1000&&remote.url){
        const url=new URL(remote.url);
        if(url.protocol!=="https:"||!url.hostname.endsWith(".stripe.com"))
          throw new Error("checkout_resume_bad_url");
        return {status:"ready",url:url.toString()};
      }else{
        return {status:"invalid",message:"Checkout in elaborazione. Nessun secondo abbonamento è stato creato."};
      }
    }
    // The unique partial index rejects duplicate active/pending purchases per organization.
    const {data:intent,error:insertError}=await db
      .from("network_pro_checkout_intents")
      .insert({
        organization_id:context.organizationId,
        created_by:context.userId,
        module_keys:modules,
        territory:input.territory,
        billing_interval:input.interval,
        stripe_price_id:priceId,
        status:"pending",
      })
      .select("id").single();
    if(insertError?.code==="23505")
      return {status:"invalid",message:"Esiste già un checkout o abbonamento attivo per questa azienda."};
    if(insertError||!intent?.id)throw new Error("checkout_intent_unavailable");

    try{
      const params=new URLSearchParams();
      params.set("mode","subscription");
      params.set("line_items[0][price]",priceId);
      params.set("line_items[0][quantity]","1");
      params.set("client_reference_id",intent.id);
      params.set("metadata[netpro_intent_id]",intent.id);
      params.set("subscription_data[metadata][netpro_intent_id]",intent.id);
      params.set("billing_address_collection","required");
      params.set("tax_id_collection[enabled]","true");
      params.set("automatic_tax[enabled]","true");
      params.set("payment_method_types[0]","card");
      params.set("success_url",origin+"/network/pro/checkout/success?session_id={CHECKOUT_SESSION_ID}");
      params.set("cancel_url",origin+"/network/pro?checkout=canceled");
      const session=await stripeCall<{id:string;url:string;mode:string}>("/checkout/sessions",{
        method:"POST",params,idempotencyKey:"netpro-f1-"+intent.id,
      });
      const destination=new URL(session.url);
      if(!session.id.startsWith("cs_")||session.mode!=="subscription"||
        destination.protocol!=="https:"||
        !(destination.hostname==="checkout.stripe.com"||
          destination.hostname.endsWith(".stripe.com")))
        throw new Error("unexpected_checkout_session");

      const {data:updated,error:updateError}=await db.from("network_pro_checkout_intents")
        .update({stripe_checkout_session_id:session.id,updated_at:new Date().toISOString()})
        .eq("id",intent.id).eq("status","pending").is("stripe_checkout_session_id",null)
        .select("id").single();
      if(updateError||!updated?.id)throw new Error("checkout_session_not_persisted");
      return {status:"ready",url:destination.toString()};
    }catch{
      await db.from("network_pro_checkout_intents")
        .update({status:"expired",updated_at:new Date().toISOString()})
        .eq("id",intent.id).eq("status","pending").is("stripe_checkout_session_id",null);
      throw new Error("stripe_checkout_creation_failed");
    }
  }catch{
    return {status:"unavailable",message:"Impossibile avviare il checkout sicuro. Riprova più tardi."};
  }
}
