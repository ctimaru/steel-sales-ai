import {redirect} from "next/navigation";

import {NetworkProducersExperience} from "@/components/network-producers-experience";
import {getNetworkProducerCatalogLinks} from "@/lib/network-producer-catalogs";
import {getProducerTechnicalClaims} from "@/lib/network-producer-technical";
import {getProducerSourceMentions} from "@/lib/network-producer-source-mentions";
import {isNetworkFrontendEnabled} from "@/lib/network-flags";
import {isSupportedNetworkCountry} from "@/lib/network-eu-countries";
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
  searchParams:Promise<{q?:string;p?:string;country?:string}>;
}){
  if(!isNetworkFrontendEnabled())redirect("/dashboard");
  const params=await searchParams;
  const query=(params.q||"").trim().slice(0,120);
  // Explicit country selection; no automatic EU access from an Italy-only plan.
  const requestedCountry=(params.country||"IT").trim().toUpperCase();
  const country=isSupportedNetworkCountry(requestedCountry)&&requestedCountry!=="US"
    ?requestedCountry:"IT";
  const requestedPage=Number(params.p);
  const page=Number.isSafeInteger(requestedPage)&&requestedPage>=1
    ?Math.min(requestedPage,10000):1;
  const context=await getWorkspaceContext();
  const [result,coverage]=await Promise.all([
    getNetworkProScopedDirectory({
      organizationId:context.organizationId,
      module:"producers",
      country,
      q:query,
      page,
    }),
    getNetworkProCoverage(context.organizationId),
  ]);
  const publishedCount=coverage?.countries.find(row=>row.countryCode===country)
    ?.publishedModules.producers??null;
  const ids=result.status==="ready"?result.data.items.map(company=>company.id):[];
  const [catalogs,technicalClaims,sourceMentions]=result.status==="ready"
    ?await Promise.all([
      country==="IT"?getNetworkProducerCatalogLinks(context.organizationId,ids):Promise.resolve([]),
      getProducerTechnicalClaims(context.organizationId,ids,country),
      country==="IT"?getProducerSourceMentions(context.organizationId,ids):Promise.resolve([]),
    ])
    :[[],[],[]];

  return <NetworkProducersExperience
    result={result}
    query={query}
    country={country}
    page={page}
    publishedCount={publishedCount}
    catalogs={catalogs}
    technicalClaims={technicalClaims}
    sourceMentions={sourceMentions}
  />;
}
