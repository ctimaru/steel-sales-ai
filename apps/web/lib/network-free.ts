import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { NetworkCompanyRole } from "@/lib/network-experience";

export type FreeCompany = {
  id: string;
  legal_name: string;
  trading_name: string | null;
  country_code: string;
  website_url: string | null;
  verification_status: string;
  claimed_status: string;
  roles: { key: string; name: string; is_primary: boolean }[];
  products: string[];
  location: { region: string | null; city: string | null } | null;
  discovery_status?: "unconfirmed";
  source_url?: string | null;
  license_url?: string | null;
  origin?: string;
  finished_only?: boolean;
  geography_status?: "published" | "sourced_unverified" | "unknown";
  geo_source_url?: string | null;
  market_name?: string | null;
  market_source_url?: string | null;
  market_evidence_status?: "candidate" | "accepted";
  steel_priority?: number;
  steel_reason?: string;
  steel_source_url?: string | null;
  steel_evidence_status?: "candidate" | "accepted" | null;
};
export type FreeDirectory = {
  contract: "netux11-free-v1";
  items: FreeCompany[];
  total: number;
  regions: string[];
  viewer_role: NetworkCompanyRole | null;
  discovered_total?: number;
  discovery_unavailable?: boolean;
};
export type FreeProfile = {
  contract: "netux11-free-profile-v1";
  company: Pick<FreeCompany, "id" | "legal_name" | "trading_name" | "country_code" | "website_url" | "claimed_status" | "verification_status" | "discovery_status"> & { description: string | null };
  roles: FreeCompany["roles"];
  products: string[];
  facilities: { city: string | null; region: string | null; country_code: string }[];
  source_url?: string | null;
  license_url?: string | null;
  origin?: string;
  finished_only?: boolean;
};

export async function getFreeNetworkDirectory(
  organizationId: string,
  filters: { q?: string; role?: string; region?: string },
): Promise<FreeDirectory> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("netux11_free_directory", {
    p_organization_id: organizationId,
    p_query: (filters.q || "").trim().slice(0, 120) || null,
    p_role: filters.role || null,
    p_region: (filters.region || "").trim().slice(0, 90) || null,
    p_limit: 100,
  });
  if (error || !data || typeof data !== "object") throw new Error("network_free_directory_unavailable");
  const result = data as FreeDirectory;
  if (result.contract !== "netux11-free-v1" || !Array.isArray(result.items)) {
    throw new Error("network_free_directory_invalid_contract");
  }
  // Provisional company discoveries share the same active-company access boundary.
  // No per-company review required; source/role stay explicitly unconfirmed.
  const {data: discoveries, error: discoveryError} = await supabase.rpc("netfast_free_directory",{
    p_organization_id:organizationId,
    p_query:(filters.q || "").trim().slice(0,120) || null,
    p_role:filters.role || null,
    p_region:(filters.region || "").trim().slice(0,90) || null,
    p_limit: 100,
  });
  if(discoveryError || !discoveries || typeof discoveries!=="object" ||
    (discoveries as {contract?:string}).contract!=="netfast-discovery-v1") return {...result,discovery_unavailable:true};
  const additional=discoveries as {items:FreeCompany[];total:number};
  if(!Array.isArray(additional.items) || typeof additional.total!=="number") return {...result,discovery_unavailable:true};
  return {...result,items:[...result.items,...additional.items],
    total:result.total+additional.total, discovered_total:additional.total, discovery_unavailable:false};
}

export async function getFreeNetworkProfile(
  organizationId: string,
  companyId: string,
): Promise<FreeProfile | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("netux11_free_profile", {
    p_organization_id: organizationId,
    p_company_id: companyId,
  });
  // Provisional UUIDs are not canonical company IDs. Some canonical readers
  // reject an unknown UUID rather than returning null, so always try the
  // separately authorized provisional reader before declaring a dead link.
  if (error || data === null) {
    const {data:discovery,error:discoveryError}=await supabase.rpc("netfast_free_profile",{
      p_organization_id:organizationId,p_discovery_id:companyId,
    });
    if (!discoveryError && discovery && typeof discovery === "object" &&
        (discovery as {contract?:string}).contract === "netfast-discovery-profile-v1") {
      return discovery as unknown as FreeProfile;
    }
    // Keep canonical outages visible, never silently turn them into 404s.
    if (error) throw new Error("network_free_profile_unavailable");
    if (discoveryError) throw new Error("network_discovery_profile_unavailable");
    return null;
  }
  if (typeof data !== "object" || (data as FreeProfile).contract !== "netux11-free-profile-v1") {
    throw new Error("network_free_profile_invalid_contract");
  }
  return data as FreeProfile;
}

export function safeNetworkWebsiteUrl(value: string | null | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch {
    return null;
  }
}

/** Lightweight viewer role for Pro's discovery ordering.
 * Authorization remains in NET-UX1.1's active-company guard; read failure
 * means "no known role", never assume an entitlement or company classification.
 */
export async function getFreeNetworkViewerRole(organizationId:string): Promise<NetworkCompanyRole|null> {
  const supabase = await createClient();
  const {data,error} = await supabase.rpc("netux11_free_directory",{
    p_organization_id:organizationId,
    p_query:null,p_role:null,p_region:null,p_limit:1,
  });
  if (error || !data || (data as FreeDirectory).contract !== "netux11-free-v1") return null;
  const role = (data as FreeDirectory).viewer_role;
  const known: readonly string[] = ["producer","trader_distributor","processor_service_provider","end_user"];
  return role && known.includes(role) ? role : null;
}

/** Pro/superadmin discovery uses PA1.3 entitlement, not the Free-only organization link.
 * The SQL reader shares the exact provisional, source-governed record view. */
export async function getProNetworkDiscoveryDirectory(
 organizationId:string,filters:{q?:string;role?:string;region?:string;persona?:string;page?:number},
):Promise<FreeDirectory & {discovery_page:NetworkBrowsePage}>{
 const page=await getNetworkBrowsePage(organizationId,"pro","unconfirmed",filters);
 return {contract:"netux11-free-v1",items:page.items,total:page.total,
  discovered_total:page.total,viewer_role:null,regions:[],discovery_page:page};
}

export async function getProNetworkDiscoveryProfile(
 organizationId:string,companyId:string,
):Promise<FreeProfile|null>{
 const supabase=await createClient();
 const {data,error}=await supabase.rpc("netlaunch1_pro_profile",{
  p_organization_id:organizationId,p_discovery_id:companyId,
 });
 if(error)throw new Error("network_pro_discovery_profile_unavailable");
 if(data===null)return null;
 const result=data as {contract?:string};
 if(result.contract!=="netfast-discovery-profile-v1")
   throw new Error("network_pro_discovery_profile_invalid");
 return data as unknown as FreeProfile;
}

/** NET-LAUNCH4B: one independently paged, authorized company source.
 * The server controls ranking, totals, and page boundaries; the browser never sorts a partial collection.
 */
export type NetworkBrowsePage = {
  contract: "netlaunch4b-page-v1";
  source: "published" | "unconfirmed";
  items: FreeCompany[];
  total: number;
  page: number;
  page_size: number;
  has_more: boolean;
};
export type NetworkPagedDirectory = FreeDirectory & {
  published_page: NetworkBrowsePage;
  discovery_page: NetworkBrowsePage | null;
};
function validPage(value: number | undefined): number {
  return typeof value === "number" && Number.isInteger(value) && value > 0
    ? Math.min(value,100000) : 1;
}
export async function getNetworkBrowsePage(
  organizationId: string,access: "free" | "pro",source: "published" | "unconfirmed",
  filters:{q?:string;role?:string;region?:string;persona?:string;page?:number},
):Promise<NetworkBrowsePage>{
 const supabase=await createClient();
 const {data,error}=await supabase.rpc("netlaunch4b_browse_page",{
  p_organization_id:organizationId,p_access:access,p_source:source,
  p_query:(filters.q??"").trim().slice(0,120)||null,
  p_role:filters.role||null,p_region:(filters.region??"").trim().slice(0,90)||null,
  p_persona:filters.persona||null,p_page:validPage(filters.page),p_limit:18,
 });
 if(error || !data || typeof data!=="object") throw new Error("network_browse_page_unavailable");
 const page=data as NetworkBrowsePage;
 if(page.contract!=="netlaunch4b-page-v1"||page.source!==source||!Array.isArray(page.items)
    ||typeof page.total!=="number"||typeof page.has_more!=="boolean"
    ||!Number.isInteger(page.page)||!Number.isInteger(page.page_size))throw new Error("network_browse_page_invalid_contract");
 return page;
}
export async function getFreeNetworkPagedDirectory(
 organizationId:string,
 filters:{q?:string;role?:string;region?:string;persona?:string;page?:number;discoveryPage?:number},
):Promise<NetworkPagedDirectory>{
 const viewerRole=await getFreeNetworkViewerRole(organizationId);
 const rankedFilters={...filters,persona:filters.persona||viewerRole||undefined};
 const published=await getNetworkBrowsePage(organizationId,"free","published",rankedFilters);
 const provisional=await getNetworkBrowsePage(organizationId,"free","unconfirmed",{
  ...rankedFilters,page:filters.discoveryPage,
 }).catch(()=>null);
 return {
  contract:"netux11-free-v1",items:[...published.items,...(provisional?.items??[])],
  total:published.total+(provisional?.total??0),viewer_role:viewerRole,regions:[],
  discovered_total:provisional?.total??0,discovery_unavailable:!provisional,
  published_page:published,discovery_page:provisional,
 };
}


/** DATA1C: sourced market matches from the *existing* provisional directory.
 * This RPC enforces the same Free/Pro organization permission as normal browsing.
 * A candidate means the company website describes the sector: never a verified firm.
 */
export async function getNetworkDiscoveredMarketPage(
 organizationId:string,access:"free"|"pro",filters:{
  market:string;q?:string;role?:string;region?:string;offset:number;limit:number;
 }
):Promise<{items:FreeCompany[];total:number}>{
 const supabase=await createClient();
 const {data,error}=await supabase.rpc("netdata1c_market_discovery_page",{
  p_organization_id:organizationId,p_access:access,p_market:filters.market,
  p_query:(filters.q||"").trim().slice(0,120)||null,
  p_role:filters.role||null,
  p_region:(filters.region||"").trim().slice(0,90)||null,
  p_offset:filters.offset,p_limit:filters.limit,
 });
 if(error||!data||typeof data!=="object")throw new Error("network_market_discovery_unavailable");
 const obj=data as {contract?:string;items?:FreeCompany[];total?:number;candidate_not_verified?:boolean};
 if(obj.contract!=="netdata1c-market-discovery-v1"||obj.candidate_not_verified!==true||
    !Array.isArray(obj.items)||typeof obj.total!=="number"||obj.items.length>filters.limit)
   throw new Error("network_market_discovery_invalid_contract");
 return {items:obj.items,total:obj.total};
}


/** DATA1B.4: a globally ranked, tenant-gated page from the full authorized pool.
 * Unknown evidence is explicit and candidates are never supplier qualification.
 */
export async function getNetworkSteelRelevancePage(
 organizationId:string,access:"free"|"pro",filters:{
  q?:string;role?:string;region?:string;offset:number;limit:number;
 }
):Promise<{items:FreeCompany[];total:number;published:number;discovered:number;evidenceTotal:number}>{
 const supabase=await createClient();
 const {data,error}=await supabase.rpc("netdata1b4_steel_relevance_page",{
  p_organization_id:organizationId,p_access:access,
  p_query:(filters.q||"").trim().slice(0,120)||null,
  p_role:filters.role||null,p_region:(filters.region||"").trim().slice(0,90)||null,
  p_offset:filters.offset,p_limit:filters.limit,
 });
 if(error||!data||typeof data!=="object")throw new Error("network_steel_ranking_unavailable");
 const obj=data as {contract?:string;items?:FreeCompany[];total?:number;
   published?:number;discovered?:number;evidence_total?:number;candidate_not_verified?:boolean};
 if(obj.contract!=="netdata1b4-steel-ranking-v1"||obj.candidate_not_verified!==true||
   !Array.isArray(obj.items)||obj.items.length>filters.limit||
   !Number.isInteger(obj.total)||!Number.isInteger(obj.published)||
   !Number.isInteger(obj.discovered)||!Number.isInteger(obj.evidence_total)||
   obj.total!==obj.published+obj.discovered||
   !obj.items.every(item=>typeof item.id==="string" && typeof item.steel_priority==="number" &&
     item.steel_priority>=1 && item.steel_priority<=5 &&
     typeof item.steel_reason==="string" &&
     (item.steel_evidence_status===null || item.steel_evidence_status==="candidate" ||
       item.steel_evidence_status==="accepted")))
   throw new Error("network_steel_ranking_invalid_contract");
 return {items:obj.items,total:obj.total,published:obj.published,
   discovered:obj.discovered,evidenceTotal:obj.evidence_total};
}
