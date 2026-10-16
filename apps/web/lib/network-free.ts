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
};
export type FreeDirectory = {
  contract: "netux11-free-v1";
  items: FreeCompany[];
  total: number;
  regions: string[];
  viewer_role: NetworkCompanyRole | null;
};
export type FreeProfile = {
  contract: "netux11-free-profile-v1";
  company: Pick<FreeCompany, "id" | "legal_name" | "trading_name" | "country_code" | "website_url" | "claimed_status" | "verification_status"> & { description: string | null };
  roles: FreeCompany["roles"];
  products: string[];
  facilities: { city: string | null; region: string | null; country_code: string }[];
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
  return result;
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
  if (data === null) return null;
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
