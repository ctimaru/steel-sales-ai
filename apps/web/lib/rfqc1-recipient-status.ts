/** RFQC1.4 — presentation-only state, no writes and no supplier payloads. */
export type Rfqc1RecipientState =
  | "draft" | "queued" | "sent" | "opened" | "working"
  | "offered" | "declined" | "expired" | "delivery_error" | "awarded";

export type Rfqc1SupplierSummary = {
  id: string;
  status: string;
};
export type Rfqc1DispatchSummary = {
  supplier_id: string;
  status: string;
  sent_at?: string | null;
  opened_at?: string | null;
};
export type Rfqc1QuoteSummary = {
  supplier_id: string;
  status: string;
  revision_no: number;
  submitted_at?: string | null;
  declined_at?: string | null;
};
export type Rfqc1ThreadSummary = {
  supplier_id: string;
  status: string;
  last_message_at?: string | null;
};

export function rfqc1RecipientState(input: {
  supplier: Rfqc1SupplierSummary;
  dispatch?: Rfqc1DispatchSummary | null;
  quotes?: readonly Rfqc1QuoteSummary[];
  thread?: Rfqc1ThreadSummary | null;
  dueAt?: string | null;
  now?: string;
}): Rfqc1RecipientState {
  const { supplier, dispatch } = input;
  if (supplier.status === "awarded") return "awarded";
  const latest = [...(input.quotes ?? [])]
    .filter(item => item.supplier_id === supplier.id)
    .sort((a, b) => b.revision_no - a.revision_no)[0];
  if (supplier.status === "declined" || latest?.status === "declined") return "declined";
  if (latest?.status === "submitted" || latest?.status === "superseded") return "offered";
  if ((input.quotes ?? []).some(q => q.supplier_id === supplier.id && q.status === "submitted")) return "offered";
  if (["bounced", "complained", "failed"].includes(dispatch?.status ?? supplier.status)) return "delivery_error";
  if (["draft", "cancelled"].includes(supplier.status)) return "draft";
  if (supplier.status === "queued" || dispatch?.status === "queued" || dispatch?.status === "sending") return "queued";
  const due = input.dueAt ? Date.parse(input.dueAt) : NaN;
  const now = input.now ? Date.parse(input.now) : Date.now();
  if (Number.isFinite(due) && Number.isFinite(now) && now > due) return "expired";
  if (latest?.status === "draft" || (
    input.thread?.supplier_id === supplier.id &&
    Boolean(input.thread.last_message_at)
  )) return "working";
  if (dispatch?.opened_at || supplier.status === "opened" || dispatch?.status === "opened") return "opened";
  return "sent";
}

export function rfqc1ResponseSummary(input: {
  suppliers: readonly Rfqc1SupplierSummary[];
  quotes: readonly Rfqc1QuoteSummary[];
}): { total: number; answered: number; offered: number; declined: number; label: string } {
  let offered = 0;
  let declined = 0;
  for (const supplier of input.suppliers) {
    const latest = input.quotes
      .filter(q => q.supplier_id === supplier.id)
      .sort((a, b) => b.revision_no - a.revision_no)[0];
    if (supplier.status === "declined" || latest?.status === "declined") declined++;
    else if (
      latest?.status === "submitted" || latest?.status === "superseded" ||
      input.quotes.some(q => q.supplier_id === supplier.id && q.status === "submitted")
    ) offered++;
  }
  const total = input.suppliers.length;
  return { total, answered: offered + declined, offered, declined, label: (offered + declined) + "/" + total };
}

export const rfqc1StateLabels: Record<Rfqc1RecipientState, string> = {
  draft: "Bozza", queued: "In coda", sent: "Inviata",
  opened: "Aperta", working: "In lavorazione", offered: "Offerta",
  declined: "Declinata", expired: "Scaduta", delivery_error: "Invio fallito",
  awarded: "Aggiudicata",
};
