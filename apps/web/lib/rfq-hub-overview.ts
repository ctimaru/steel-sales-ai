/** Small presentation contract: never infer quotes or orders from RFQ status. */
export type RfqHubCampaignStatus = "draft" | "ready" | "launched" | "collecting" | "awarded" | "closed" | "cancelled";
export type RfqHubOrderStatus = "draft" | "issued" | "supplier_confirmed" | "supplier_rejected" | "change_requested" | "cancelled";

export function rfqCampaignStatusLabel(value: string): string {
  const labels: Record<RfqHubCampaignStatus, string> = {
    draft: "Bozza", ready: "Pronta", launched: "Inviata",
    collecting: "Raccolta offerte", awarded: "Aggiudicata",
    closed: "Chiusa", cancelled: "Annullata",
  };
  return labels[value as RfqHubCampaignStatus] ?? "Stato da verificare";
}
export function rfqOrderStatusLabel(value: string): string {
  const labels: Record<RfqHubOrderStatus, string> = {
    draft: "Bozza PO", issued: "Emesso · attesa conferma",
    supplier_confirmed: "Confermato", supplier_rejected: "Rifiutato",
    change_requested: "Modifica richiesta", cancelled: "Annullato",
  };
  return labels[value as RfqHubOrderStatus] ?? "Stato da verificare";
}
export function formatHubDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ?
    new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "short", year: "numeric", timeZone: "Europe/Rome" }).format(date) : "—";
}
export type HubInboxItem = {
  item_id: string;
  rfq_id: string;
  headline: string;
  detail: string;
  requires_action: boolean;
  priority: "urgent" | "high" | "normal" | "waiting";
  due_at: string | null;
};
export function parseHubInboxItems(value: unknown, visibleRfqIds: ReadonlySet<string>): HubInboxItem[] | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const data = value as { items?: unknown };
  if (!Array.isArray(data.items)) return null;
  return data.items
    .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object" && !Array.isArray(item)))
    .filter((item) => typeof item.rfq_id === "string" && visibleRfqIds.has(item.rfq_id) && item.requires_action === true)
    .filter((item) => ["urgent", "high", "normal", "waiting"].includes(String(item.priority)))
    .slice(0, 6)
    .map((item) => ({
      item_id: String(item.item_id ?? ""),
      rfq_id: String(item.rfq_id),
      headline: typeof item.headline === "string" ? item.headline.slice(0, 240) : "Attività da verificare",
      detail: typeof item.detail === "string" ? item.detail.slice(0, 400) : "",
      requires_action: true,
      priority: item.priority as HubInboxItem["priority"],
      due_at: typeof item.due_at === "string" ? item.due_at : null,
    }));
}
