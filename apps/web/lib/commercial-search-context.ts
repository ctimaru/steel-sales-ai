/**
 * COMM-UX1C — One entry point for the existing tenant-scoped Commercial Memory.
 * The RFQ procurement worklist remains a separate, explicitly linked search.
 * These helpers never resolve a Network (public) company into private CRM data.
 */
export const commercialSearchScopes = [
  { value: "all", label: "Tutto", types: [] },
  { value: "activities", label: "RFQ e offerte", types: ["rfq", "offer", "order", "delivery"] },
  { value: "companies", label: "Aziende", types: ["company"] },
  { value: "products", label: "Prodotti", types: ["product"] },
  { value: "documents", label: "Documenti", types: ["document"] },
] as const;

export type CommercialSearchScope = typeof commercialSearchScopes[number]["value"];
export type CommercialMemoryType = "document" | "company" | "product" | "rfq" | "offer" | "order" | "delivery";

/** Never trust scope supplied through URL/form input as a database filter. */
export function parseCommercialSearchScope(value: unknown): CommercialSearchScope {
  return commercialSearchScopes.find((entry) => entry.value === value)?.value ?? "all";
}
export function commercialSearchScopeTypes(scope: CommercialSearchScope): CommercialMemoryType[] {
  return [...commercialSearchScopes.find((entry) => entry.value === scope)!.types];
}
export function normalizeCommercialSearchQuery(input: unknown): string {
  return typeof input === "string" ? input.trim().slice(0, 160) : "";
}
export function commercialSearchHref(query = "", scope: CommercialSearchScope = "all"): string {
  const params = new URLSearchParams();
  const safeQuery = normalizeCommercialSearchQuery(query);
  if (safeQuery) params.set("q", safeQuery);
  if (scope !== "all") params.set("scope", scope);
  const search = params.toString();
  return "/commercial/search" + (search ? "?" + search : "");
}
export function operationalSearchHref(query = ""): string {
  const params = new URLSearchParams();
  const safeQuery = normalizeCommercialSearchQuery(query).slice(0, 80);
  if (safeQuery) params.set("q", safeQuery);
  return "/commercial" + (params.size ? "?" + params.toString() : "") + "#commercial-worklist";
}
