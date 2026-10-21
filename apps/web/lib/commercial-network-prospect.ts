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

/** Explicitly requested personal shortlist: never read other users' prospects. */
export type CommercialProspectListItem = {
  id: string;
  name: string;
  country: string;
  savedAt: string;
};

export async function listCommercialNetworkProspects(
  organizationId: string,
  userId: string,
): Promise<CommercialProspectListItem[] | null> {
  if (!UUID.test(organizationId) || !UUID.test(userId)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("network_saved_companies")
    .select("network_company_id,created_at,network_companies!inner(legal_name,trading_name,country_code,publication_status)")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .eq("network_companies.publication_status", "published")
    .order("created_at", { ascending: false })
    .limit(12);
  if (error) return null;
  return (data ?? []).flatMap((saved) => {
    const company = Array.isArray(saved.network_companies)
      ? saved.network_companies[0] : saved.network_companies;
    if (!UUID.test(saved.network_company_id) || !company) return [];
    const name = String(company.trading_name || company.legal_name || "").trim().slice(0, 115);
    if (!name) return [];
    return [{
      id: saved.network_company_id,
      name,
      country: String(company.country_code || "—").slice(0, 2),
      savedAt: String(saved.created_at || ""),
    }];
  });
}
