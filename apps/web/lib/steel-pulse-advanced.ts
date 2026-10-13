import type { SteelPulsePublicCard } from "@/lib/steel-pulse-public";
import type { PulseProfessionalInterest } from "@/lib/steel-pulse-personalized";

/**
 * DASH-FEED4: strict, non-sensitive, self-declared interests.
 * Product/territory hints affect order only. Approved SP5 cards are the sole input.
 * No inferred customer, email, pricing, RFQ, geolocation or access data.
 */
export const pulseProductInterests = [
  { key: "round_tubes", label: "Tubi tondi", terms: ["tubo tondo", "tubi tondi", "round tube", "circular hollow"] },
  { key: "hollow_sections", label: "Profili cavi", terms: ["profilo cavo", "profili cavi", "hollow section", "tubo quadro", "tubi quadri", "tubo rettangolare"] },
  { key: "seamless_tubes", label: "Tubi senza saldatura", terms: ["senza saldatura", "seamless", "en 10216", "api 5l"] },
  { key: "welded_tubes", label: "Tubi saldati", terms: ["tubo saldato", "tubi saldati", "welded", "en 10217"] },
  { key: "stainless_steel", label: "Acciaio inox", terms: ["inox", "inossidabile", "stainless"] },
  { key: "steel_processing", label: "Lavorazioni", terms: ["lavorazioni", "taglio", "piegatura", "tagli", "processing", "fabrication"] },
] as const;

export const pulseTerritoryInterests = [
  { key: "italy", label: "Italia", terms: ["italia", "italiano", "italiana", "italian", "italy"] },
  { key: "north_west", label: "Nord-Ovest", terms: ["piemonte", "liguria", "lombardia", "valle d'aosta", "north-west italy", "northwest italy"] },
  { key: "north_east", label: "Nord-Est", terms: ["veneto", "trentino", "friuli", "emilia-romagna", "northeast italy", "north-east italy"] },
  { key: "center", label: "Centro Italia", terms: ["toscana", "umbria", "marche", "lazio", "central italy"] },
  { key: "south", label: "Sud Italia", terms: ["campania", "puglia", "basilicata", "calabria", "molise", "abruzzo", "southern italy"] },
  { key: "islands", label: "Isole", terms: ["sicilia", "sardegna", "sicily", "sardinia"] },
  { key: "europe", label: "Europa", terms: ["europa", "europe", "european", "ue ", "union europea", "eurofer"] },
  { key: "usa", label: "USA", terms: ["stati uniti", "united states", "u.s.", "usa", "american", "america"] },
] as const;

export type PulseProductInterest = (typeof pulseProductInterests)[number]["key"];
export type PulseTerritoryInterest = (typeof pulseTerritoryInterests)[number]["key"];
export type PulseAdvancedInterests = {
  product_interests: PulseProductInterest[];
  territory_interests: PulseTerritoryInterest[];
};
export const EMPTY_PULSE_ADVANCED_INTERESTS: PulseAdvancedInterests = {
  product_interests: [], territory_interests: [],
};

const productKeys = new Set<string>(pulseProductInterests.map((item) => item.key));
const territoryKeys = new Set<string>(pulseTerritoryInterests.map((item) => item.key));

export function parsePulseAdvancedInterests(value: unknown): PulseAdvancedInterests | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const data = value as Record<string, unknown>;
  const products = data.product_interests;
  const territories = data.territory_interests;
  if (!Array.isArray(products) || products.length > 6 ||
      !products.every((key) => typeof key === "string" && productKeys.has(key)) ||
      new Set(products).size !== products.length ||
      !Array.isArray(territories) || territories.length > 8 ||
      !territories.every((key) => typeof key === "string" && territoryKeys.has(key)) ||
      new Set(territories).size !== territories.length) return null;
  return {
    product_interests: products as PulseProductInterest[],
    territory_interests: territories as PulseTerritoryInterest[],
  };
}

const roleTopicAffinity: Record<PulseProfessionalInterest, readonly SteelPulsePublicCard["topic"][]> = {
  all: [],
  producer: ["raw_materials", "market"],
  trader: ["market", "trade"],
  processor: ["technology", "raw_materials"],
  end_user: ["market", "technology"],
};

/** Deterministic editorial text relevance, not verified geotags or AI-inferred company data. */
export function rankPersonalizedPulseCards(
  cards: readonly SteelPulsePublicCard[],
  interests: PulseAdvancedInterests,
  role: PulseProfessionalInterest,
): SteelPulsePublicCard[] {
  if (!interests.product_interests.length && !interests.territory_interests.length)
    return [...cards];
  const productTerms = pulseProductInterests.filter((x) => interests.product_interests.includes(x.key))
    .flatMap((x) => [...x.terms]);
  const territoryTerms = pulseTerritoryInterests.filter((x) => interests.territory_interests.includes(x.key))
    .flatMap((x) => [...x.terms]);
  return cards.map((card, index) => {
    const content = [card.headline, card.summary, card.relevance].join(" ").toLocaleLowerCase("it-IT");
    const product = productTerms.some((term) => content.includes(term)) ? 8 : 0;
    const territory = territoryTerms.some((term) => content.includes(term)) ? 5 : 0;
    const professional = (roleTopicAffinity[role] ?? []).includes(card.topic) ? 2 : 0;
    return { card, index, score: product + territory + professional };
  }).sort((a,b) => b.score - a.score || a.index - b.index).map((x) => x.card);
}
