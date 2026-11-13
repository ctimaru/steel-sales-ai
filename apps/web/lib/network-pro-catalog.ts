/**
 * NET-PRO-CATALOG1.A: proposed commercial packaging only.
 * Not a billing source of truth and NEVER an authorization grant.
 * Existing pa1_3_network_access_state still controls private Network reads.
 */
export const NETWORK_PRO_MODULES = [
  {
    key: "producers",
    title: "Produttori",
    role: "producer",
    description: "Tubifici, acciaierie e produttori di profili, lamiere, coil e altri prodotti siderurgici.",
    audience: "Per commercianti e uffici acquisti",
    example: "Chi produce tubolari EN 10219 S355 in Europa?",
  },
  {
    key: "distributors",
    title: "Commercianti",
    role: "trader_distributor",
    description: "Distributori, stockholder, grossisti, trader e centri di vendita.",
    audience: "Per produttori, carpenterie e commercianti",
    example: "Quali stockholder di tubi operano in Italia?",
  },
  {
    key: "end_users",
    title: "Carpenterie e utilizzatori",
    role: "end_user",
    description: "Carpenterie, costruttori di macchinari, OEM, EPC e utilizzatori industriali.",
    audience: "Per produttori e commercianti",
    example: "Quali carpenterie lavorano tubolari strutturali?",
  },
  {
    key: "processors",
    title: "Terzisti e lavorazioni",
    role: "processor_service_provider",
    description: "Taglio, zincatura, saldatura, piegatura, verniciatura e lavorazioni specialistiche.",
    audience: "Per tutta la filiera",
    example: "Trova aziende con taglio laser e zincatura in Lombardia.",
  },
] as const;

export type NetworkProModuleKey = (typeof NETWORK_PRO_MODULES)[number]["key"];
export type NetworkProTerritory = "IT" | "EU";

export const NETWORK_PRO_PRICE_BOOK = {
  IT: { 0: 0, 1: 39, 2: 66, 3: 94, 4: 119 },
  EU: { 0: 0, 1: 69, 2: 117, 3: 166, 4: 199 },
} as const;

export const NETWORK_PRO_ANNUAL_DISCOUNT_PERCENT = 15;

export function networkProQuote(
  selected: readonly NetworkProModuleKey[],
  territory: NetworkProTerritory,
  billing: "monthly" | "annual" = "monthly",
) {
  const valid = new Set<string>(NETWORK_PRO_MODULES.map((module) => module.key));
  const count = new Set(selected.filter((key) => valid.has(key))).size as 0 | 1 | 2 | 3 | 4;
  const monthlyBase = NETWORK_PRO_PRICE_BOOK[territory][count];
  const annualTotal = Math.round(monthlyBase * 12 * (1 - NETWORK_PRO_ANNUAL_DISCOUNT_PERCENT / 100));
  return {
    count,
    monthlyBase,
    annualTotal,
    displayedTotal: billing === "annual" ? annualTotal : monthlyBase,
    billing,
    // Marketing-only quote; actual billing must recalculate server-side in future.
    purchasable: false as const,
  };
}
