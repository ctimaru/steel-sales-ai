import { NETWORK_PRO_MODULES, NETWORK_PRO_PRICE_BOOK, type NetworkProModuleKey } from "@/lib/network-pro-catalog";

// D.2: indicative, non-binding commercial hypothesis. Never used for billing or access.
export const FOUNDING_PRICE_VERSION = "mkt9d1-proposed-2026-11-24";
export const FOUNDING_MONTHLY_IT = [0,29,49,69,89] as const;
export const FOUNDING_TERM_MONTHS = 12;
export type FoundingRole = "producer" | "distributor" | "processor" | "end_user";
export const FOUNDING_PRESETS: Record<FoundingRole, readonly NetworkProModuleKey[]> = {
  producer: ["distributors","processors","end_users"],
  distributor: ["producers","end_users","processors"],
  processor: ["distributors","producers"],
  end_user: ["distributors","producers"],
};
export function foundingQuote(input: readonly string[]) {
  const selected = NETWORK_PRO_MODULES.filter(m=>input.includes(m.key)).map(m=>m.key);
  const count=selected.length as 0|1|2|3|4;
  const monthly=FOUNDING_MONTHLY_IT[count], reference=NETWORK_PRO_PRICE_BOOK.IT[count];
  return {selected,count,monthly,reference,annualDifference:(reference-monthly)*FOUNDING_TERM_MONTHS,territory:"IT" as const,version:FOUNDING_PRICE_VERSION,purchasable:false as const};
}
