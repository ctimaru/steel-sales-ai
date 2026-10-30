import type {
  CommercialView,
  UnifiedCommercialData,
  UnifiedCommercialItem,
} from "@/lib/commercial-unified-data";

/**
 * Only an authoritative integer count can be presented as an RFQ attention
 * total. Never turn missing or malformed RPC data into an apparent zero.
 */
export function commercialDirectorAttentionCount(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
    ? value : null;
}

/**
 * A resume shortcut, NOT an AI priority prediction. The unified "all" view
 * already sorts tenant-scoped records by creation date. Paged/filtered views
 * may be incomplete and must not be represented as the latest activity.
 */
export function selectCommercialDirectorResumeItem(
  data: UnifiedCommercialData,
  view: CommercialView,
): UnifiedCommercialItem | null {
  if (view !== "all" || data.procurementUnavailable || data.truncated) return null;
  return data.items.find(item =>
    item.origin === "acquisti privati" &&
    (item.kind === "quote" || item.kind === "campaign" ||
      item.kind === "purchase-order" || item.kind === "distinta")
  ) ?? null;
}

export function commercialDirectorResumeLabel(item: UnifiedCommercialItem): string {
  if (item.kind === "quote") return "Offerta fornitore";
  if (item.kind === "campaign") return "RFQ ai fornitori";
  if (item.kind === "purchase-order") return "Ordine acquisti";
  if (item.kind === "distinta") return "Distinta salvata";
  return "Attività commerciale";
}
