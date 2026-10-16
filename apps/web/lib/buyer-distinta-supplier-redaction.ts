/**
 * Supplier-facing exports must NEVER include buyer-internal target prices.
 * Private buyer-side snapshot/read models may retain targets under RLS, but
 * outbound email and supplier-copy formats must use this redacted projection.
 */
import type { BuyerDistintaCalculatedLine } from "@/lib/buyer-distinta";

export function supplierVisibleBuyerLines(
  lines: BuyerDistintaCalculatedLine[],
): BuyerDistintaCalculatedLine[] {
  return lines.map(line=>({
    ...line,
    targetEurT:null,
    targetEurM:null,
    targetTotalEur:null,
  }));
}
