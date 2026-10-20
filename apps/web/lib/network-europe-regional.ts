import "server-only";
import {createClient} from "@/lib/supabase/server";
import type {FreeCompany} from "@/lib/network-free";
import type {CompactNetworkFilters} from "@/lib/network-compact-directory";

export type EuropeRegionCoverage={
 contract:"net-europe1c-coverage-v1";country:string;
 regions:{code:string;name:string;count:number}[];
 mapped_companies:number;facility_companies:number;coverage_complete:false;
 scope:"published_facilities_only";
};
type RegionalResponse={
 contract:"net-europe1c-region-v1";country:string;region_code:string;
 scope:"published_facilities_only";total:number;page:number;page_size:number;
 items:(FreeCompany&{capabilities?:{key:string;name:string}[]})[];
};
export async function getEuropeRegionCoverage(org:string,access:"free"|"pro",country:string):Promise<EuropeRegionCoverage>{
 const db=await createClient();
 const {data,error}=await db.rpc("net_europe1c_region_coverage",{
  p_organization_id:org,p_access:access,p_country:country,
 });
 if(error)throw new Error(error.message);
 const payload=data as EuropeRegionCoverage|null;
 if(!payload||payload.contract!=="net-europe1c-coverage-v1"||
   payload.country!==country||payload.scope!=="published_facilities_only"||
   !Array.isArray(payload.regions))throw new Error("Invalid European region coverage");
 return payload;
}
export async function getEuropeRegionalSearch(
 org:string,access:"free"|"pro",filters:CompactNetworkFilters,page:number,limit:number,
):Promise<RegionalResponse>{
 const db=await createClient();
 const {data,error}=await db.rpc("net_europe1c_region_search",{
  p_organization_id:org,p_access:access,
  p_country:filters.country,p_region_code:filters.region,
  p_query:filters.q||null,p_role:filters.role||null,
  p_product:filters.product||null,p_capability:filters.capability||null,
  p_market:filters.market||null,p_page:page,p_limit:limit,
 });
 if(error)throw new Error(error.message);
 const result=data as RegionalResponse|null;
 if(!result||result.contract!=="net-europe1c-region-v1"||
   result.country!==filters.country||result.region_code!==filters.region||
   result.scope!=="published_facilities_only"||
   !Array.isArray(result.items)||!Number.isSafeInteger(result.total)){
   throw new Error("Invalid European regional search response");
 }
 return result;
}
