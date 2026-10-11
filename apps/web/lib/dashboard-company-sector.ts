import "server-only";

import { createClient } from "@/lib/supabase/server";
import { normalizeCompanySector, type CompanySector } from "@/lib/dashboard-role-contract";

/**
 * Read-only dashboard segmentation.
 * Source of truth: the approved organization-to-Network link and the
 * canonical roles returned by the existing governed profile RPC.
 * Fail closed to unknown if unavailable or ambiguous; no authorization effects.
 */
export async function getDashboardCompanySector(organizationId: string): Promise<CompanySector> {
  const supabase = await createClient();
  const { data: linked, error: linkError } = await supabase.rpc("m8_my_network_company");
  if (linkError || !linked || typeof linked !== "object") return "unknown";
  const company = linked as {
    organization_id?: string;
    network_company_id?: string;
    link_status?: string;
  };
  if (company.organization_id !== organizationId || !company.network_company_id) return "unknown";
  if (company.link_status !== "active") return "unknown";

  const { data, error } = await supabase.rpc("p3_7_managed_profile_state", {
    p_network_company_id: company.network_company_id,
  });
  if (error || !data || typeof data !== "object") return "unknown";
  const profile = data as { roles?: Array<{ key?: string; is_primary?: boolean; review_state?: string }> };
  const primaries = (profile.roles ?? []).filter((role) => role.is_primary === true);
  if (primaries.length !== 1) return "unknown";
  // A declared role is sufficient to personalize a display, not to grant permissions.
  return normalizeCompanySector(primaries[0].key);
}
