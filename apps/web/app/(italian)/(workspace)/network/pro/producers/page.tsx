import {redirect} from "next/navigation";

import {NetworkProducersExperience} from "@/components/network-producers-experience";
import {getNetworkProducerCatalogLinks} from "@/lib/network-producer-catalogs";
import {getProducerTechnicalClaims} from "@/lib/network-producer-technical";
import {getProducerSourceMentions} from "@/lib/network-producer-source-mentions";
import {isNetworkFrontendEnabled} from "@/lib/network-flags";
import {isSupportedNetworkCountry} from "@/lib/network-eu-countries";
import {getNetworkProCoverage,getNetworkProScopedDirectory} from "@/lib/network-pro-coverage";
import {getSavedNetworkCompanyIds} from "@/lib/network-saved-set";
import {getProducerFacets,getProducerFilteredDirectory,type ProducerFacets} from "@/lib/network-producer-directory";
import {EMPTY_PRODUCER_FILTERS,hasActiveProducerFilters,parseProducerFilters} from "@/lib/network-producer-filters";
import type {NetworkProDirectoryResult} from "@/lib/network-pro-coverage";
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
  searchParams:Promise<{q?:string;p?:string;country?:string}&Record<string,string|string[]|undefined>>;
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
  // NET-PRODUCERS-FILTERS1: Italy reads the filtered directory (all producers, documented
  // values only unless «menzioni» is switched on). If that RPC is unavailable, the page
  // falls back to the basic directory without filters — never a partial or guessed list.
  const requestedFilters=country==="IT"?parseProducerFilters(params):EMPTY_PRODUCER_FILTERS;
  const [filtered,facets,coverage]=await Promise.all([
    country==="IT"
      ?getProducerFilteredDirectory({organizationId:context.organizationId,q:query,page,filters:requestedFilters})
      :Promise.resolve(null),
    country==="IT"
      ?getProducerFacets(context.organizationId,requestedFilters.includeMentions)
      :Promise.resolve<ProducerFacets|null>(null),
    getNetworkProCoverage(context.organizationId),
  ]);
  const filtersAvailable=filtered!==null;
  const filters=filtersAvailable?requestedFilters:EMPTY_PRODUCER_FILTERS;
  const result:NetworkProDirectoryResult=filtered?filtered.result:await getNetworkProScopedDirectory({
    organizationId:context.organizationId,
    module:"producers",
    country,
    q:query,
    page,
  });
  const filtersDropped=!filtersAvailable&&hasActiveProducerFilters(requestedFilters);
  const publishedCount=coverage?.countries.find(row=>row.countryCode===country)
    ?.publishedModules.producers??null;
  const ids=result.status==="ready"?result.data.items.map(company=>company.id):[];
  // NET-PRODUCERS-UX3: «Salva» on each row; the saved set is the user's own private list (RLS).
  const [catalogs,technicalClaims,sourceMentions,savedIds]=result.status==="ready"
    ?await Promise.all([
      country==="IT"?getNetworkProducerCatalogLinks(context.organizationId,ids):Promise.resolve([]),
      getProducerTechnicalClaims(context.organizationId,ids,country),
      country==="IT"?getProducerSourceMentions(context.organizationId,ids):Promise.resolve([]),
      getSavedNetworkCompanyIds(context.organizationId,ids).catch(()=>null),
    ])
    :[[],[],[],[]];

  return <NetworkProducersExperience
    result={result}
    query={query}
    country={country}
    page={page}
    publishedCount={publishedCount}
    catalogs={catalogs}
    technicalClaims={technicalClaims}
    sourceMentions={sourceMentions}
    savedIds={savedIds}
    filters={filters}
    facets={filtersAvailable?facets:null}
    filtersAvailable={filtersAvailable}
    filtersDropped={filtersDropped}
  />;
}
