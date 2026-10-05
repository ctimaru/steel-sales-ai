import "server-only";

import { createClient } from "@/lib/supabase/server";
import type {
  PriceListCatalogEntry,
  PriceListExplorerItem,
} from "@/lib/public-price-lists";

export async function listPriceListsForRequest(includeInternal = false) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("pl1_price_list_catalog", {
    p_include_internal: includeInternal,
  });

  if (error) {
    console.error("PL1 request catalogue failed:", error.message);
    return [] as PriceListCatalogEntry[];
  }

  return Array.isArray(data) ? (data as PriceListCatalogEntry[]) : [];
}

export async function getPriceListExplorerVersion(
  versionId: string,
  includeInternal = false,
) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("pl1_price_list_explorer_version", {
    p_version_id: versionId,
    p_include_internal: includeInternal,
  });

  if (error) {
    console.error("PL1 explorer version failed:", error.message);
    return null;
  }

  const rows = Array.isArray(data) ? (data as PriceListCatalogEntry[]) : [];
  return rows[0] ?? null;
}

export async function getPriceListExplorerItems(
  versionId: string,
  includeInternal = false,
) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("pl1_price_list_explorer_items", {
    p_version_id: versionId,
    p_include_internal: includeInternal,
  });

  if (error) {
    console.error("PL1 explorer items failed:", error.message);
    return [] as PriceListExplorerItem[];
  }

  return Array.isArray(data) ? (data as PriceListExplorerItem[]) : [];
}
