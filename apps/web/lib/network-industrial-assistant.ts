import "server-only";

import { parseIndustrialReview, type IndustrialReview } from "@/lib/company-industrial-assistant";
import { createClient } from "@/lib/supabase/server";

export function unavailableIndustrialReview(companyId: string): IndustrialReview {
  const unavailableHash = "0".repeat(64);
  return {
    networkCompanyId: companyId, availability: "unavailable", sourceUrls: [], observedAt: null,
    extractorVersion: null, proposals: [],
    stateHashes: { products: unavailableHash, capabilities: unavailableHash, markets: unavailableHash, certifications: unavailableHash },
  };
}

export async function getCompanyIndustrialReview(organizationId: string, companyId: string) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("company_ux2c2_industrial_review", {
      p_organization_id: organizationId,
      p_network_company_id: companyId,
    });
    return error ? null : parseIndustrialReview(data, companyId);
  } catch {
    // The canonical editors remain usable when a proposal cannot be loaded.
    return null;
  }
}
