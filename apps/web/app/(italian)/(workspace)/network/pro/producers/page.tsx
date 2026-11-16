import {redirect} from "next/navigation";

import {NetworkProducersExperience} from "@/components/network-producers-experience";
import {getNetworkProducerCatalogLinks} from "@/lib/network-producer-catalogs";
import {getProducerTechnicalClaims} from "@/lib/network-producer-technical";
import {isNetworkFrontendEnabled} from "@/lib/network-flags";
import {getNetworkProCoverage,getNetworkProScopedDirectory} from "@/lib/network-pro-coverage";
import {getWorkspaceContext} from "@/lib/workspace-context";

export const dynamic="force-dynamic";

/**
 * A dedicated manufacturer experience built on the EXISTING producer entitlement.
 * Only data returned by the tenant-authorized scoped-directory RPC is sent to the
 * interactive client. Product claims, technical catalogs, and certifications must
 * not be inferred from a company name or domain.
 */
export default async function NetworkProProducersPage({
  searchParams,
}:{
  searchParams:Promise<{q?:string;p?:string}>;
}){
  if(!isNetworkFrontendEnabled())redirect("/dashboard");
  const params=await searchParams;
  const query=(params.q||"").trim().slice(0,120);
  const requestedPage=Number(params.p);
  const page=Number.isSafeInteger(requestedPage)&&requestedPage>=1
    ?Math.min(requestedPage,10000):1;
  const context=await getWorkspaceContext();
  const [result,coverage]=await Promise.all([
    getNetworkProScopedDirectory({
      organizationId:context.organizationId,
      module:"producers",
      country:"IT",
      q:query,
      page,
    }),
    getNetworkProCoverage(context.organizationId),
  ]);
  const publishedCount=coverage?.countries.find(row=>row.countryCode==="IT")
    ?.publishedModules.producers??null;
  const [catalogs,technicalClaims]=result.status==="ready"
    ?await Promise.all([
      getNetworkProducerCatalogLinks(context.organizationId,
        result.data.items.map(company=>company.id)),
      getProducerTechnicalClaims(context.organizationId,
        result.data.items.map(company=>company.id)),
    ])
    :[[],[]];

  return <NetworkProducersExperience
    result={result}
    query={query}
    page={page}
    publishedCount={publishedCount}
    catalogs={catalogs}
    technicalClaims={technicalClaims}
  />;
}
