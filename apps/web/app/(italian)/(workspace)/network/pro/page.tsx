import {NetworkProCatalog} from "@/components/network-pro-catalog";
import {netProBillingEnabled} from "@/lib/netpro-billing-stripe.server";
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
  return <NetworkProCatalog coverage={coverage} access={access}
    canCheckout={context.role==="admin"&&context.onboardingStatus!=="suspended"}
    billingReady={netProBillingEnabled()}/>;
}
