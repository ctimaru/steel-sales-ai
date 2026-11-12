import "server-only";

import { createClient } from "@/lib/supabase/server";
import { getNetworkAccessState } from "@/lib/network-access";
import { searchNetwork, type NetworkSearchItem } from "@/lib/network";
import type { CommercialAiNativeEntities } from "@/lib/commercial-ai-native-intent";
import {
  parseIndustryRequest, rankIndustryResults, type ScopeProduct, type IndustryLookupResult,
} from "@/lib/commercial-industry-knowledge";

/**
 * D: public published Network data, read-only; entitlement and existing RPC
 * security remain the source of truth. We do not query private inbox, contacts,
 * stock, provider models or tenant-owned records here.
 */
export async function searchCommercialIndustryKnowledge(
  question: string,
  entities: CommercialAiNativeEntities,
  missing: string[],
  organizationId: string,
): Promise<IndustryLookupResult> {
  const empty: IndustryLookupResult = {
    companies: [], examined: 0, totalCandidates: 0, limited: false,
    restricted: false, technicalScopeUnavailable: false,
  };
  const request = parseIndustryRequest(question, entities, missing);
  // Keep paid private discovery behind the same Network entitlement as /network.
  const access = await getNetworkAccessState(organizationId).catch(() => null);
  if (!access || !access.can_access_network || access.organization_id !== organizationId)
    return { ...empty, restricted: true };

  const products = request.tubes ? ["tubes_pipes", "hollow_sections"] : [null];
  const searched = await Promise.all(products.map(product =>
    searchNetwork({ role: request.role, country: request.country, product, page: 1 })
  ));
  const byId = new Map<string, NetworkSearchItem>();
  for (const group of searched) {
    for (const company of group.items) {
      if (company?.id && !byId.has(company.id)) byId.set(company.id, company);
    }
  }
  const candidates = Array.from(byId.values()).slice(0, 12);
  if (!candidates.length) return {
    ...empty, totalCandidates: searched.reduce((sum, s) => sum + s.total, 0),
    limited: searched.some(s => s.total > 18),
  };

  const client = await createClient();
  let unavailable = false;
  const entries = await Promise.all(candidates.map(async (company): Promise<[string, ScopeProduct[] | null]> => {
    // The existing RPC checks entitlement and returns only published scopes.
    const { data, error } = await client.rpc("p3_7e_public_product_scope", {
      p_network_company_id: company.id,
    });
    if (error) {
      unavailable = true;
      return [company.id, null];
    }
    const products = data && typeof data === "object" && "products" in data
      ? (data as { products?: unknown }).products : null;
    return [company.id, Array.isArray(products) ? products as ScopeProduct[] : []];
  }));
  const scopes = Object.fromEntries(entries) as Record<string, ScopeProduct[] | null>;
  return {
    companies: rankIndustryResults(candidates, request, scopes, 6),
    examined: candidates.length,
    totalCandidates: searched.reduce((sum, s) => sum + s.total, 0),
    limited: searched.some(s => s.total > 18) || byId.size > candidates.length,
    restricted: false,
    technicalScopeUnavailable: unavailable,
  };
}
