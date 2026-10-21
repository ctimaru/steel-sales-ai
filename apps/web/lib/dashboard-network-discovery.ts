import type { CompanySector } from "@/lib/dashboard-role-contract";
import type { NetworkSearchItem } from "@/lib/network";
import type { PulseAdvancedInterests } from "@/lib/steel-pulse-advanced";

/**
 * DASH-NEXT1C.2: explainable discovery from the published M6 Network catalog.
 *
 * A company here is NOT a verified supplier for a particular RFQ and a taxonomy
 * entry is NOT a validated technical capability. No AI, price, contact or
 * private RFQ information is used to rank companies.
 */
export type DashboardNetworkMatch = {
  id: string;
  name: string;
  countryCode: string;
  category: string | null;
  product: string;
  capability: string | null;
  reasons: string[];
  verifiedProfile: boolean;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EU = new Set([
  "AT","BE","BG","HR","CY","CZ","DK","EE","FI","FR","DE","GR","HU",
  "IE","IT","LV","LT","LU","MT","NL","PL","PT","RO","SK","SI","ES","SE",
]);

const roleAffinity: Record<CompanySector, readonly string[]> = {
  produttore: ["trader_distributor", "end_user", "processor_service_provider"],
  commerciante: ["end_user", "processor_service_provider", "producer"],
  terzista: ["trader_distributor", "end_user", "producer"],
  utilizzatore: ["trader_distributor", "processor_service_provider", "producer"],
  unknown: [],
};

// Explicit catalog wording only. Generic tubes_pipes is NOT sufficient to
// assert any specific manufacturing process or steel grade.
const productTerms: Record<string, readonly string[]> = {
  round_tubes: ["round", "tond", "circular"],
  hollow_sections: ["hollow", "profil", "quadrat", "rettang", "square", "rectangular"],
  seamless_tubes: ["seamless", "senza saldatura"],
  welded_tubes: ["welded", "saldat"],
  stainless_steel: ["stainless", "inox", "inossidabil"],
  steel_processing: ["processing", "lavoraz", "taglio", "cutting", "fabricat"],
};
const processingTerms = productTerms.steel_processing;
const validText = (value: unknown, max = 95) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";
const matchingText = (value: string, terms: readonly string[]) =>
  terms.some((term) => value.toLocaleLowerCase("it-IT").includes(term));

function countryInterestMatch(company: NetworkSearchItem, interests: PulseAdvancedInterests) {
  const countries = [company.country_code, ...(Array.isArray(company.facility_countries) ? company.facility_countries : [])]
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.toUpperCase());
  if (interests.territory_interests.includes("italy") && countries.includes("IT")) return "Italia";
  if (interests.territory_interests.includes("europe") && countries.some((country) => EU.has(country))) return "UE";
  if (interests.territory_interests.includes("usa") && countries.includes("US")) return "USA";
  // The M6 list does NOT provide a trustworthy regional facet. Never interpret
  // Italy macro-areas as confirmed facility locations in the dashboard.
  return null;
}

export function selectDashboardNetworkCompanies(
  items: readonly NetworkSearchItem[],
  sector: CompanySector,
  interests: PulseAdvancedInterests,
  ownOrganizationName = "",
  limit = 2,
): DashboardNetworkMatch[] {
  const ownName = ownOrganizationName.trim().toLocaleLowerCase("it-IT");
  const seen = new Set<string>();
  return items.flatMap((company, index) => {
    if (!company || !UUID.test(company.id) || seen.has(company.id)) return [];
    seen.add(company.id);
    const name = validText(company.trading_name || company.legal_name, 115);
    const legal = validText(company.legal_name, 115);
    if (!name || (ownName && (name.toLocaleLowerCase("it-IT") === ownName ||
      legal.toLocaleLowerCase("it-IT") === ownName))) return [];

    const products = Array.isArray(company.products) ? company.products
      .filter((product) => product && typeof product.name === "string" && typeof product.key === "string")
      : [];
    // Only present a company with at least one explicitly catalogued product.
    if (!products.some((product) => product.key === "tubes_pipes")) return [];
    const roles = Array.isArray(company.roles) ? company.roles
      .filter((role) => role && typeof role.key === "string" && typeof role.name === "string")
      : [];
    const capabilities = Array.isArray(company.capabilities) ? company.capabilities
      .filter((capability) => capability && typeof capability.key === "string" && typeof capability.name === "string")
      : [];

    const productMatch = products.find((product) =>
      interests.product_interests.some((interest) => interest !== "steel_processing" &&
        matchingText(product.key + " " + product.name, productTerms[interest] ?? [])));
    const capabilityMatch = interests.product_interests.includes("steel_processing")
      ? capabilities.find((capability) => matchingText(capability.key + " " + capability.name, processingTerms))
      : null;
    const relatedRoles = roleAffinity[sector];
    const roleMatch = roles.find((role) => relatedRoles.includes(role.key));
    const territory = countryInterestMatch(company, interests);
    const productName = validText(productMatch?.name ?? products[0].name, 85);
    const capabilityName = validText(capabilityMatch?.name ?? capabilities[0]?.name, 85);
    const reasons = [
      ...(productMatch ? ["Prodotto di interesse: " + validText(productMatch.name, 65)] : []),
      ...(capabilityMatch ? ["Lavorazione a catalogo: " + validText(capabilityMatch.name, 65)] : []),
      ...(roleMatch ? ["Settore di possibile interesse: " + validText(roleMatch.name, 65)] : []),
      ...(territory ? ["Presenza geografica: " + territory] : []),
    ];
    // The list is a small deterministic ranking of the first published M6
    // catalog page, not an exhaustive supplier search or validated supplier fit.
    const score = (productMatch ? 5 : 0) + (capabilityMatch ? 4 : 0) +
      (roleMatch ? 3 : 0) + (territory ? 2 : 0) +
      (company.verification_status === "verified" ? 1 : 0);
    return [{
      index, score,
      company: {
        id: company.id,
        name,
        countryCode: /^[A-Z]{2}$/.test(company.country_code?.toUpperCase() ?? "")
          ? company.country_code.toUpperCase() : "—",
        category: validText(roleMatch?.name ?? roles.find((role) => role.is_primary)?.name ?? roles[0]?.name, 70) || null,
        product: productName,
        capability: capabilityName || null,
        reasons: reasons.slice(0, 2),
        verifiedProfile: company.verification_status === "verified",
      } satisfies DashboardNetworkMatch,
    }];
  }).sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, Math.max(0, Math.min(3, Math.floor(limit))))
    .map((entry) => entry.company);
}
