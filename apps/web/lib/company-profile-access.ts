import "server-only";

import { getNetworkAccessState } from "@/lib/network-access";
import { getInquiryPreferences } from "@/lib/network";

export type CompanyProfileAccess = {
  audience: "free" | "pro" | "unavailable";
  inquiries: "available" | "pro_required" | "unavailable";
  preferences: { organization_id: string; inquiries_enabled: boolean } | null;
};

/** Profile management has its own owner guard; paid inquiry preferences are optional. */
export async function getCompanyProfileAccess(organizationId: string): Promise<CompanyProfileAccess> {
  let canUsePro: boolean;
  try {
    const access = await getNetworkAccessState(organizationId);
    if (typeof access.can_access_network !== "boolean") throw new Error("invalid_network_access");
    canUsePro = access.can_access_network;
  } catch {
    return { audience: "unavailable", inquiries: "unavailable", preferences: null };
  }

  if (!canUsePro) return { audience: "free", inquiries: "pro_required", preferences: null };

  try {
    const preferences = await getInquiryPreferences(organizationId);
    if (preferences.organization_id !== organizationId || typeof preferences.inquiries_enabled !== "boolean") {
      throw new Error("invalid_inquiry_preferences");
    }
    return { audience: "pro", inquiries: "available", preferences };
  } catch {
    return { audience: "pro", inquiries: "unavailable", preferences: null };
  }
}
