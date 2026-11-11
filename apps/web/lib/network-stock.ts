import "server-only";
import { createClient } from "@/lib/supabase/server";

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

function normalizeRows(data: unknown): NetworkInventoryItem[] {
  if (!Array.isArray(data)) return [];
  return data.flatMap((row: unknown) => {
    if (!row || typeof row !== "object") return [];
    const value = row as Record<string, unknown>;
    if (typeof value.id !== "string" || typeof value.company_id !== "string" ||
        typeof value.product_name !== "string" || value.provenance !== "company_declared" ||
        !["stock", "incoming", "production"].includes(String(value.kind)) ||
        !["t", "kg", "m", "bars", "pcs"].includes(String(value.unit)) ||
        !Number.isFinite(Number(value.quantity)) || Number(value.quantity) <= 0 ||
        typeof value.updated_at !== "string") return [];
    return [{
      id: value.id,
      company_id: value.company_id,
      kind: value.kind as NetworkInventoryKind,
      product_name: value.product_name,
      standard: typeof value.standard === "string" ? value.standard : null,
      grade: typeof value.grade === "string" ? value.grade : null,
      dimensions: typeof value.dimensions === "string" ? value.dimensions : null,
      quantity: Number(value.quantity),
      unit: value.unit as NetworkInventoryUnit,
      location: typeof value.location === "string" ? value.location : null,
      available_on: typeof value.available_on === "string" ? value.available_on : null,
      updated_at: value.updated_at,
      provenance: "company_declared" as const,
      publication_status: value.publication_status === "draft" ? "draft" as const : "published" as const,
    }];
  });
}

export async function getPublishedNetworkInventory(
  organizationId: string, companyId: string,
): Promise<NetworkInventoryItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("netprofile_ux1b_public", {
    p_organization_id: organizationId, p_company_id: companyId,
  });
  // During a protected release, the schema can safely lag behind the frontend.
  // Never replace missing published records with inferred stock from other modules.
  if (error?.code === "PGRST202" || error?.code === "42883") return [];
  if (error) throw new Error("published_network_inventory_unavailable");
  return normalizeRows(data).filter((row) => row.company_id === companyId);
}

export async function getManagedNetworkInventory(
  organizationId: string, companyId: string,
): Promise<ManagedNetworkInventory> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("netprofile_ux1b_manage", {
    p_organization_id: organizationId, p_company_id: companyId,
  });
  if (error?.code === "PGRST202" || error?.code === "42883") return { items: [], ready: false };
  if (error) throw new Error("managed_network_inventory_unavailable");
  return { items: normalizeRows(data).filter((row) => row.company_id === companyId), ready: true };
}
