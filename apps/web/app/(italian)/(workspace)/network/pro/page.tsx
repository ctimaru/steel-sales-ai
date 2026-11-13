import {NetworkProCatalog} from "@/components/network-pro-catalog";
import {netProBillingEnabled} from "@/lib/netpro-billing-stripe.server";
import {billingDb} from "@/lib/netpro-billing-reconcile.server";
import {getNetworkProCoverage,getNetworkProAccess} from "@/lib/network-pro-coverage";
import {getWorkspaceContext} from "@/lib/workspace-context";
import {isNetworkFrontendEnabled} from "@/lib/network-flags";
import {redirect} from "next/navigation";

export const dynamic="force-dynamic";

export default async function NetworkProCatalogPage() {
  if (!isNetworkFrontendEnabled()) redirect("/dashboard");
  const context=await getWorkspaceContext();
  const [coverage,access]=await Promise.all([
    getNetworkProCoverage(context.organizationId),
    getNetworkProAccess(context.organizationId),
  ]);
  const billingReady=netProBillingEnabled();
  let hasPaidSubscription=false;
  if(billingReady&&context.role==="admin"){
    try{
      const {data,error}=await billingDb().from("network_pro_checkout_intents")
        .select("id").eq("organization_id",context.organizationId).eq("status","paid").maybeSingle();
      hasPaidSubscription=!error&&Boolean(data?.id);
    }catch{hasPaidSubscription=false;}
  }
  return <NetworkProCatalog coverage={coverage} access={access}
    canCheckout={context.role==="admin"&&context.onboardingStatus!=="suspended"}
    billingReady={billingReady} hasPaidSubscription={hasPaidSubscription}/>;
}
