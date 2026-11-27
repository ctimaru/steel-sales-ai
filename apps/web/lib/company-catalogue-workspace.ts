/** Public shape of the existing owner-only catalogue status RPC. */
export const CATALOGUE_STATES = [
  "awaiting_upload", "pending_provenance", "verifying", "in_analysis", "needs_review", "withdrawn",
] as const;
export const CATALOGUE_RIGHTS_STATUSES = ["not_verified", "active", "expired", "revoked"] as const;

export type CompanyCatalogueItem = {
  catalog_id: string;
  name: string;
  edition: string;
  format: "pdf" | "csv";
  state: (typeof CATALOGUE_STATES)[number];
  created_at: string;
  uploaded_at: string | null;
  source_url: string;
  rights_declared_at: string;
  source_checked_at: string | null;
  withdrawn_at: string | null;
  rights_status: (typeof CATALOGUE_RIGHTS_STATUSES)[number];
  rights_verified_at: string | null;
  rights_expires_at: string | null;
  rights_revoked_at: string | null;
};

export type CompanyCatalogueStatus = {
  contract: "netproducers-b3c2-v1";
  details_contract: "company-ux2d2-catalog-status-v1";
  eligible: boolean;
  limit: 20;
  items: CompanyCatalogueItem[];
};

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const textWithin = (value: unknown, min: number, max: number): value is string =>
  typeof value === "string" && value.trim().length >= min && value.length <= max;

function timestamp(value: unknown): value is string {
  if (typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(value) ||
    !Number.isFinite(Date.parse(value))) return false;
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return year > 0 && month >= 1 && month <= 12 && day >= 1 && day <= days[month - 1];
}

function sourceUrl(value: unknown): value is string {
  if (!textWithin(value, 14, 1200)) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" && !!parsed.hostname &&
      !parsed.username && !parsed.password && !parsed.hash;
  } catch {
    return false;
  }
}

/**
 * An old, unavailable or malformed response is never a confirmed empty list.
 * Rights are returned by the database; the client must not infer them from the
 * submission state or from the checkbox accepted during upload.
 */
export function parseCompanyCatalogueStatus(input: unknown): CompanyCatalogueStatus | null {
  if (!isObject(input) || input.contract !== "netproducers-b3c2-v1" ||
    input.details_contract !== "company-ux2d2-catalog-status-v1" ||
    input.limit !== 20 || typeof input.eligible !== "boolean" ||
    !Array.isArray(input.items) || input.items.length > 20 ||
    (!input.eligible && input.items.length !== 0)) return null;

  const items: CompanyCatalogueItem[] = [];
  const ids = new Set<string>();
  for (const item of input.items) {
    if (!isObject(item) || typeof item.catalog_id !== "string" || !uuid.test(item.catalog_id) ||
      ids.has(item.catalog_id) || !textWithin(item.name, 5, 140) || !textWithin(item.edition, 1, 80) ||
      (item.format !== "pdf" && item.format !== "csv") ||
      !CATALOGUE_STATES.includes(item.state as CompanyCatalogueItem["state"]) ||
      !CATALOGUE_RIGHTS_STATUSES.includes(item.rights_status as CompanyCatalogueItem["rights_status"]) ||
      !sourceUrl(item.source_url) || !timestamp(item.created_at) || !timestamp(item.rights_declared_at)) return null;

    for (const field of ["uploaded_at", "source_checked_at", "withdrawn_at", "rights_verified_at", "rights_expires_at", "rights_revoked_at"] as const) {
      if (item[field] !== null && !timestamp(item[field])) return null;
    }
    if (item.state === "withdrawn" && item.withdrawn_at === null) return null;
    if (item.state !== "withdrawn" && item.withdrawn_at !== null) return null;
    if (item.rights_status === "active" &&
      (item.state === "withdrawn" || item.rights_verified_at === null || item.rights_expires_at === null || item.rights_revoked_at !== null)) return null;

    ids.add(item.catalog_id);
    items.push({
      catalog_id: item.catalog_id,
      name: item.name,
      edition: item.edition,
      format: item.format,
      state: item.state as CompanyCatalogueItem["state"],
      created_at: item.created_at,
      uploaded_at: item.uploaded_at as string | null,
      source_url: item.source_url,
      rights_declared_at: item.rights_declared_at,
      source_checked_at: item.source_checked_at as string | null,
      withdrawn_at: item.withdrawn_at as string | null,
      rights_status: item.rights_status as CompanyCatalogueItem["rights_status"],
      rights_verified_at: item.rights_verified_at as string | null,
      rights_expires_at: item.rights_expires_at as string | null,
      rights_revoked_at: item.rights_revoked_at as string | null,
    });
  }
  return { contract: "netproducers-b3c2-v1", details_contract: "company-ux2d2-catalog-status-v1", eligible: input.eligible, limit: 20, items };
}
