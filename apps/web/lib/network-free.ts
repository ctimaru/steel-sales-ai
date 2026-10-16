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
  origin?: string;
  finished_only?: boolean;
};
export type FreeDirectory = {
  contract: "netux11-free-v1";
  items: FreeCompany[];
  total: number;
  regions: string[];
  viewer_role: NetworkCompanyRole | null;
  discovered_total?: number;
};
export type FreeProfile = {
  contract: "netux11-free-profile-v1";
  company: Pick<FreeCompany, "id" | "legal_name" | "trading_name" | "country_code" | "website_url" | "claimed_status" | "verification_status" | "discovery_status"> & { description: string | null };
  roles: FreeCompany["roles"];
  products: string[];
  facilities: { city: string | null; region: string | null; country_code: string }[];
  source_url?: string | null;
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
    p_limit: 50,
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
    p_limit:50,
  });
  if(discoveryError || !discoveries || typeof discoveries!=="object" ||
    (discoveries as {contract?:string}).contract!=="netfast-discovery-v1") return result;
  const additional=discoveries as {items:FreeCompany[];total:number};
  if(!Array.isArray(additional.items) || typeof additional.total!=="number") return result;
  return {...result,items:[...result.items,...additional.items],
    total:result.total+additional.total, discovered_total:additional.total};
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
  if (error) throw new Error("network_free_profile_unavailable");
  if (data === null) {
    const {data:discovery,error:discoveryError}=await supabase.rpc("netfast_free_profile",{
      p_organization_id:organizationId,p_discovery_id:companyId,
    });
    if(discoveryError || !discovery) return null;
    const preview=discovery as FreeProfile & {contract:string};
    if(preview.contract!=="netfast-discovery-profile-v1") return null;
    return preview as FreeProfile;
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
