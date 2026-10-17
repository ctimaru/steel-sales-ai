import "server-only";

import { createClient } from "@/lib/supabase/server";

export type ItalyRegionCoverage = {
  contract: "netux2-region-coverage-v1";
  total_companies: number;
  mapped_companies: number;
  unlocated_companies: number;
  regions: { name: string; count: number }[];
};

/** This request runs in the viewer's authenticated tenant context, never with a service key. */
export async function getItalyRegionCoverage(organizationId: string): Promise<ItalyRegionCoverage | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("netux2_region_coverage", {
    p_organization_id: organizationId,
  });
  if (error || !data || typeof data !== "object") return null;
  const coverage = data as ItalyRegionCoverage;
  if (coverage.contract !== "netux2-region-coverage-v1" || !Array.isArray(coverage.regions)) {
    return null;
  }
  return coverage;
}


export type ItalyProvisionalGeoCoverage = {
  contract: "neteima2-geo-coverage-v1";
  mapped_candidates: number;
  regions: { name: string; count: number }[];
};

/** Source-observed provisional research only. Never merge these counts with published locations. */
export async function getItalyProvisionalGeoCoverage(
  organizationId: string, access: "free" | "pro",
): Promise<ItalyProvisionalGeoCoverage | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("neteima2_region_coverage", {
    p_organization_id: organizationId, p_access: access,
  });
  if (error || !data || typeof data !== "object") return null;
  const result = data as ItalyProvisionalGeoCoverage;
  return result.contract === "neteima2-geo-coverage-v1" && Array.isArray(result.regions)
    ? result : null;
}
