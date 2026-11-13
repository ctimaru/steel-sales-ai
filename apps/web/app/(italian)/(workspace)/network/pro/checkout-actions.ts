"use server";

import {createClient as createServiceClient} from "@supabase/supabase-js";
import {getWorkspaceContext} from "@/lib/workspace-context";
import {isNetworkFrontendEnabled} from "@/lib/network-flags";
import {NETWORK_PRO_MODULES,networkProQuote,type NetworkProModuleKey,type NetworkProTerritory} from "@/lib/network-pro-catalog";
import {
  netProBillingEnabled,stripePriceId,stripeCall,verifiedStripePrice,trustedBillingOrigin,
  type NetProBillingInterval,
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
    const verifiedPrice=await verifiedStripePrice(priceId,input.interval);
    // Billing must never silently charge a different amount than the on-page quote.
    // Stripe Tax calculates additional taxes in Stripe Checkout.
    const publishedQuote=networkProQuote(input.modules,input.territory,input.interval);
    if(verifiedPrice.unit_amount!==Math.round(publishedQuote.displayedTotal*100))
      return {status:"unavailable",message:"Il listino non corrisponde al prezzo configurato. Nessun addebito eseguito."};
    const db=serviceDb();
    const modules=[...input.modules].sort();
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
