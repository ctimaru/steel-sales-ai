import "server-only";

import { createClient } from "@/lib/supabase/server";

/**
 * NET-SAVE-INLINE1: the viewer's saved-companies total for the "Salvate" tab
 * counter. RLS limits the count to the signed-in user's own rows in an active
 * organization with Network access. Any failure returns null, which hides the
 * counter instead of showing a wrong zero.
 */
export async function countNetworkSavedCompanies(organizationId: string, userId: string): Promise<number | null> {
  try {
    const supabase = await createClient();
    const { count, error } = await supabase
      .from("network_saved_companies")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("user_id", userId);
    return error || typeof count !== "number" ? null : count;
  } catch {
    return null;
  }
}
