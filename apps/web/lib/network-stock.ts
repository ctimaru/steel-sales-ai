import "server-only";
import { createClient } from "@/lib/supabase/server";
import { normalizeCompanyInventoryRows, parseManagedCompanyInventory } from "@/lib/company-inventory-workspace";

/** NET-PROFILE-UX1.B — published stock is company-declared only. */
export type NetworkInventoryKind = "stock" | "incoming" | "production";
export type NetworkInventoryUnit = "t" | "kg" | "m" | "bars" | "pcs";
export type NetworkInventoryItem = {
  id: string;
  company_id: string;
  kind: NetworkInventoryKind;
  product_name: string;
  standard: string | null;
  grade: string | null;
  dimensions: string | null;
  quantity: number;
  unit: NetworkInventoryUnit;
  location: string | null;
  available_on: string | null;
  updated_at: string;
  provenance: "company_declared";
  publication_status?: "draft" | "published";
};
export type ManagedNetworkInventory = { items: NetworkInventoryItem[]; ready: boolean };

export async function getPublishedNetworkInventory(
  organizationId: string, companyId: string,
): Promise<NetworkInventoryItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("netprofile_ux1b_public", {
    p_organization_id: organizationId, p_company_id: companyId,
  });
  // During a protected release, the schema can safely lag behind the frontend.
  // Never replace missing published records with inferred stock from other modules.
  if (error?.code === "PGRST202" || error?.code === "42883" || error?.code === "42501") return [];
  if (error) throw new Error("published_network_inventory_unavailable");
  return normalizeCompanyInventoryRows(data, "public").filter((row) => row.company_id === companyId).slice(0, 80);
}

export async function getManagedNetworkInventory(
  organizationId: string, companyId: string,
): Promise<ManagedNetworkInventory> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("netprofile_ux1b_manage", {
      p_organization_id: organizationId, p_company_id: companyId,
    });
    // Inventory unavailability must not make the other company profile sections fail.
    if (error) return { items: [], ready: false };
    return parseManagedCompanyInventory(data, companyId);
  } catch {
    return { items: [], ready: false };
  }
}
