import "server-only";

import { createHash } from "node:crypto";
import { parseDescriptionAssistantReview, type DescriptionAssistantReview } from "@/lib/company-description-assistant";
import { createClient } from "@/lib/supabase/server";

/** Match SQL exactly, including whitespace; null and an empty description have the same value. */
export function companyDescriptionHash(description: string | null) {
  return createHash("sha256").update(description ?? "", "utf8").digest("hex");
}

export function unavailableDescriptionReview(companyId: string, description: string | null): DescriptionAssistantReview {
  return {
    networkCompanyId: companyId,
    currentDescription: description,
    currentDescriptionHash: companyDescriptionHash(description),
    availability: "unavailable",
    proposal: null,
    decision: null,
  };
}

export async function getCompanyDescriptionReview(organizationId: string, companyId: string) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("company_ux2c1_description_review", {
      p_organization_id: organizationId,
      p_network_company_id: companyId,
    });
    return error ? null : parseDescriptionAssistantReview(data, companyId);
  } catch {
    // The existing editor stays visible while the assistant is temporarily unavailable.
    return null;
  }
}
