import { safeInternalNext, withCommercialReturnTo } from "@/lib/auth-next";

export function normalizeCompanyClaimRef(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const ref = value.trim().toLowerCase();
  return /^[0-9a-f]{64}$/.test(ref) ? ref : null;
}

/** Keep an existing member's selected company through login, without accepting a target ID. */
export function registrationClaimNext(value: string | undefined): string | null {
  const safe = safeInternalNext(value, "");
  if (!safe) return null;
  const url = new URL(safe, "https://smartsteelsales.local");
  if (url.pathname !== "/register" && url.pathname !== "/en/register") return null;
  const references = url.searchParams.getAll("claim_ref");
  const claimRef = references.length === 1 ? normalizeCompanyClaimRef(references[0]) : null;
  if (!claimRef) return null;
  return withCommercialReturnTo(
    `${url.pathname}?claim_ref=${claimRef}`,
    url.searchParams.get("return_to"),
  );
}
