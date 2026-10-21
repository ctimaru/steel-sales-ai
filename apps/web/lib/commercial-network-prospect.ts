import "server-only";
import { createClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * C4.1: a saved Network company is a PRIVATE prospect of the current user,
 * NOT a verified Company 360 association, shared organization CRM entity,
 * contact, RFQ recipient, or commercial activity created on behalf of anyone.
 */
export type CommercialNetworkProspect = {
  status: "saved" | "not_saved" | "unavailable";
  savedAt: string | null;
};

export async function getCommercialNetworkProspect(
  organizationId: string,
  userId: string,
  networkCompanyId: string,
): Promise<CommercialNetworkProspect> {
  if (![organizationId, userId, networkCompanyId].every((id) => UUID.test(id))) {
    return { status: "unavailable", savedAt: null };
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("network_saved_companies")
    .select("created_at")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .eq("network_company_id", networkCompanyId)
    .maybeSingle();
  if (error) return { status: "unavailable", savedAt: null };
  return data
    ? { status: "saved", savedAt: typeof data.created_at === "string" ? data.created_at : null }
    : { status: "not_saved", savedAt: null };
}
