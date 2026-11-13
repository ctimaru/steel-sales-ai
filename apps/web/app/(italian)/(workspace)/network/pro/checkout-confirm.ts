"use server";

import {getWorkspaceContext} from "@/lib/workspace-context";
import {billingDb,reconcilePaidCheckout} from "@/lib/netpro-billing-reconcile.server";

export type CheckoutConfirmResult={
  status:"active"|"pending"|"not_found"|"unavailable";paidUntil?:string;
};

/** This is not a success signal. It reads back the live Stripe payment. */
export async function confirmNetworkProCheckout(sessionId:string):Promise<CheckoutConfirmResult>{
  if(typeof sessionId!=="string"||!/^cs_[A-Za-z0-9_]{8,150}$/.test(sessionId))
    return {status:"not_found"};
  const context=await getWorkspaceContext();
  try{
    const {data,error}=await billingDb().from("network_pro_checkout_intents")
      .select("id")
      .eq("stripe_checkout_session_id",sessionId)
      .eq("organization_id",context.organizationId)
      .eq("created_by",context.userId)
      .maybeSingle();
    if(error||!data)return {status:"not_found"};
    const result=await reconcilePaidCheckout(data.id);
    return result.status==="active"
      ?{status:"active",paidUntil:result.paidUntil}
      :{status:"pending"};
  }catch{
    return {status:"unavailable"};
  }
}
