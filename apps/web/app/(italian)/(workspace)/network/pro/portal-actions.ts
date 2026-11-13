"use server";

import {getWorkspaceContext} from "@/lib/workspace-context";
import {netProBillingEnabled,stripeCall,trustedBillingOrigin} from "@/lib/netpro-billing-stripe.server";
import {billingDb} from "@/lib/netpro-billing-reconcile.server";

type PortalResult={status:"ready";url:string}|{status:"unavailable"|"forbidden";message:string};

export async function openNetworkProCustomerPortal():Promise<PortalResult>{
  if(!netProBillingEnabled())return {
    status:"unavailable",message:"Il portale abbonamenti non è ancora disponibile.",
  };
  const context=await getWorkspaceContext();
  if(context.role!=="admin")return {
    status:"forbidden",message:"Solo l’amministratore aziendale può gestire l'abbonamento.",
  };
  try{
    const origin=trustedBillingOrigin();
    if(!origin)throw new Error("origin_unavailable");
    const {data,error}=await billingDb().from("network_pro_checkout_intents")
      .select("stripe_customer_id")
      .eq("organization_id",context.organizationId)
      .eq("status","paid").maybeSingle();
    if(error||!data?.stripe_customer_id)return {
      status:"unavailable",message:"Nessun abbonamento pagato disponibile.",
    };
    const portalConfig=process.env.STRIPE_NETPRO_PORTAL_CONFIGURATION_ID;
    // Portal configuration MUST disallow subscription plan changes until
    // module/territory upgrade reconciliation is implemented and verified.
    if(!portalConfig||!/^bpc_[A-Za-z0-9]{10,}$/.test(portalConfig))
      throw new Error("portal_configuration_required");
    const params=new URLSearchParams();
    params.set("configuration",portalConfig);
    params.set("customer",data.stripe_customer_id);
    params.set("return_url",origin+"/network/pro");
    const session=await stripeCall<{url:string}>("/billing_portal/sessions",{
      method:"POST",params,
    });
    const url=new URL(session.url);
    if(url.protocol!=="https:"||!url.hostname.endsWith(".stripe.com"))
      throw new Error("unexpected_portal_destination");
    return {status:"ready",url:url.toString()};
  }catch{
    return {status:"unavailable",message:"Gestione abbonamento temporaneamente non disponibile."};
  }
}
