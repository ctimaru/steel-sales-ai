import type { FreeCompany } from "@/lib/network-free";

/**
 * HOME-NETPREVIEW1: Home preview of the published Network for organizations
 * without the Pro Network entitlement.
 *
 * Source: the same server-ranked, permission-checked free browse page that
 * /network already shows to these organizations (netlaunch4b_browse_page,
 * access "free", source "published"). Nothing here grants access or ranks
 * companies; it only trims and formats the first page for display.
 * A listing is NOT a supplier recommendation or a technical qualification.
 */
export type FreeNetworkPreviewItem = {
  id: string;
  name: string;
  role: string | null;
  place: string;
  verified: boolean;
};

export type FreeNetworkPreview = {
  companies: FreeNetworkPreviewItem[];
  total: number;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function selectFreeNetworkPreview(
  page: { items?: unknown; total?: unknown } | null | undefined,
  ownOrganizationName: string,
  limit = 3,
): FreeNetworkPreview | null {
  if (!page || !Array.isArray(page.items)) return null;
  const own = clean(ownOrganizationName).toLowerCase();
  const companies: FreeNetworkPreviewItem[] = [];
  for (const raw of page.items as Partial<FreeCompany>[]) {
    if (companies.length >= limit) break;
    if (!raw || typeof raw.id !== "string" || !UUID.test(raw.id)) continue;
    const legal = clean(raw.legal_name);
    const name = clean(raw.trading_name) || legal;
    if (!name) continue;
    // Never suggest the viewer's own company back to them.
    if (own && (legal.toLowerCase() === own || name.toLowerCase() === own)) continue;
    const roles = Array.isArray(raw.roles) ? raw.roles : [];
    const primary = roles.find((role) => role?.is_primary) ?? roles[0];
    const city = clean(raw.location?.city);
    const region = clean(raw.location?.region);
    const country = clean(raw.country_code).toUpperCase();
    const place = [city || region, country].filter(Boolean).join(" · ");
    companies.push({
      id: raw.id,
      name,
      role: clean(primary?.name) || null,
      place,
      verified: raw.verification_status === "verified",
    });
  }
  const total = typeof page.total === "number" && Number.isFinite(page.total) && page.total >= 0
    ? Math.floor(page.total)
    : companies.length;
  return { companies, total };
}
