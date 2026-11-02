import "server-only";

import { createClient } from "@/lib/supabase/server";

/** NET-UX LOT1B — which of the given Network companies the current user saved
 * in the private list (RLS: own rows only, active organization). */
export async function getSavedNetworkCompanyIds(organizationId: string, ids: string[]): Promise<string[]> {
  const distinct = [...new Set(ids)].slice(0, 50);
  if (!distinct.length) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("network_saved_companies")
    .select("network_company_id")
    .eq("organization_id", organizationId)
    .in("network_company_id", distinct);
  if (error) return [];
  return (data ?? []).map((row) => String(row.network_company_id));
}
