import "server-only";

import { getNetworkProfile } from "@/lib/network";
import { getNetworkAccessState } from "@/lib/network-access";
import { isNetworkFrontendEnabled } from "@/lib/network-flags";

/**
 * NEXT1C.3: context-only handoff from a published Network company into the
 * organization's existing Commerciale workspace. Read-only; no CRM contacts,
 * supplier attachments, draft mutation, network inquiry or provider dispatch.
 */
export type CommercialNetworkContext = {
  id: string;
  name: string;
  country: string;
  role: string | null;
  products: string[];
  verifiedIdentity: boolean;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function getCommercialNetworkContext(
  organizationId: string,
  networkCompanyId?: string | null,
): Promise<CommercialNetworkContext | null> {
  if (!isNetworkFrontendEnabled() || typeof networkCompanyId !== "string" ||
      !UUID.test(networkCompanyId)) return null;

  // The link's UUID is untrusted. Revalidate the current organization against
  // its own Network entitlement before querying any company profile.
  const access = await getNetworkAccessState(organizationId).catch(() => null);
  if (!access?.can_access_network || access.organization_id !== organizationId) return null;

  // This RPC exposes only the published, public-company profile; preserve its
  // server-side publication policy and fail closed if the record is unavailable.
  const profile = await getNetworkProfile(networkCompanyId).catch(() => null);
  if (!profile || profile.company?.id !== networkCompanyId) return null;

  const name = (profile.company.trading_name || profile.company.legal_name || "").trim().slice(0, 115);
  if (!name) return null;
  const primary = profile.roles?.find((role) => role.is_primary) ?? profile.roles?.[0];
  const products = [...new Set(
    (profile.products ?? [])
      .filter((product) => typeof product.name === "string")
      .map((product) => product.name.trim().slice(0, 70))
      .filter(Boolean),
  )].slice(0, 2);
  return {
    id: networkCompanyId,
    name,
    country: /^[A-Z]{2}$/.test(profile.company.country_code || "") ? profile.company.country_code : "—",
    role: typeof primary?.name === "string" ? primary.name.trim().slice(0, 70) : null,
    products,
    verifiedIdentity: profile.company.verification_status === "verified",
  };
}
