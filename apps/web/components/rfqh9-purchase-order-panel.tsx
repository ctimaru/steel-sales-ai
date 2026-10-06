"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  issuePurchaseOrder,
  updatePurchaseOrderTerms,
} from "@/app/(workspace)/marketplace/rfq-hub/[rfqId]/po-actions";

type PoVersion = {
  id: string;
  version_no: number;
  status: string;
  po_number: string;
  delivery_status: string;
  provider_message_id: string | null;
  confirmation_due_at: string | null;
  issued_at: string;
  snapshot_sha256: string;
  supplier_url?: string | null;
  response: {
    decision: string;
    message: string | null;
    confirmed_delivery_date: string | null;
    supplier_reference: string | null;
    responded_at: string;
  } | null;
};

type PoLine = {
  id: string;
  line_position: number;
  description: string;
  standard_code: string | null;
  grade_code: string | null;
  finish_code: string | null;
  awarded_tonnes: number | string;
  awarded_meters: number | string;
  unit_eur_t: number | string;
  unit_eur_m: number | string;
  line_total_eur: number | string;
  lead_time_days: number | null;
  delivery_date: string | null;
};

type PurchaseOrder = {
  id: string;
  supplier_id: string;
  status: string;
  po_draft_ref: string;
  supplier_name: string | null;
  supplier_email: string | null;
  incoterm: string | null;
  payment_terms: string | null;
  delivery_date: string | null;
  lead_time_days: number | null;
  total_tonnes: number | string;
  total_eur: number | string;
  notes: string | null;
  issued_at: string | null;
  versions: PoVersion[];
  lines: PoLine[];
};

export type Rfqh9PoState = {
  contract?: string;
  rfq_id?: string;
  purchase_orders?: PurchaseOrder[];
};

function num(value: number | string | null | undefined) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function number(value: number | string | null | undefined, digits = 2) {
  return num(value).toLocaleString("it-IT", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  });
}

function dateTime(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "—";
  return new Intl.DateTimeFormat("it-IT", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function statusLabel(status: string) {
  if (status === "supplier_confirmed") return "Confermato supplier";
  if (status === "supplier_rejected") return "Rifiutato supplier";
  if (status === "change_requested") return "Modifica richiesta";
  if (status === "issued") return "Emesso · attesa conferma";
  if (status === "superseded") return "Superato";
  return status;
}

function PurchaseOrderCard({
  rfqId,
  po,
}: {
  rfqId: string;
  po: PurchaseOrder;
}) {
  const router = useRouter();
  const [incoterm, setIncoterm] = useState(po.incoterm || "");
  const [paymentTerms, setPaymentTerms] = useState(po.payment_terms || "");
  const [deliveryDate, setDeliveryDate] = useState(po.delivery_date || "");
  const [leadTimeDays, setLeadTimeDays] = useState(
    po.lead_time_days === null ? "" : String(po.lead_time_days),
  );
  const [notes, setNotes] = useState(po.notes || "");
  const [buyerMessage, setBuyerMessage] = useState("");
  const [confirmationDueAt, setConfirmationDueAt] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [lastSupplierUrl, setLastSupplierUrl] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const editable = ["draft", "change_requested", "supplier_rejected"].includes(
    po.status,
  );
  const latest = po.versions[0] ?? null;

  function saveTerms() {
    setFeedback(null);
    startTransition(async () => {
      const parsedLead = leadTimeDays.trim() ? Number(leadTimeDays) : null;
      const result = await updatePurchaseOrderTerms({
        rfqId,
        poDraftId: po.id,
        incoterm,
        paymentTerms,
        deliveryDate: deliveryDate || null,
        leadTimeDays:
          parsedLead !== null && Number.isFinite(parsedLead) ? parsedLead : null,
        notes,
      });
      if (!result.ok) {
        setFeedback(result.error ?? "Salvataggio non riuscito.");
        return;
      }
      setFeedback("Termini PO aggiornati.");
      router.refresh();
    });
  }

  function issue() {
    if (
      !window.confirm(
        "Emettere una nuova versione del Purchase Order? Prezzi e quantità resteranno congelati dall'award.",
      )
    ) {
      return;
    }

    setFeedback(null);
    startTransition(async () => {
      const result = await issuePurchaseOrder({
        rfqId,
        poDraftId: po.id,
        buyerMessage,
        confirmationDueAt: confirmationDueAt || null,
      });

      if (!result.ok) {
        setFeedback(result.error ?? "Emissione non riuscita.");
        return;
      }

      setLastSupplierUrl(result.supplierUrl ?? null);
      setFeedback(
        result.warning
          ? "PO emesso. " + result.warning
          : "PO emesso e inviato al supplier.",
      );
      router.refresh();
    });
  }

  async function copyLink(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setFeedback("Link personale supplier copiato.");
    } catch {
      setFeedback("Non è stato possibile copiare automaticamente il link.");
    }
  }

  return (
    <article className="rounded-3xl border border-[#dce2df] bg-white">
      <div className="border-b border-[#e7ece9] px-5 py-5 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.1em] text-[#1a5144]">
              {po.po_draft_ref}
            </p>
            <h3 className="mt-1 text-lg font-semibold text-[#1d2824]">
              {po.supplier_name || po.supplier_email || "Fornitore"}
            </h3>
            <p className="mt-1 text-xs text-[#718078]">
              {po.supplier_email || "Nessuna email supplier"}
            </p>
          </div>
          <div className="text-right">
            <span className="rounded-full bg-[#edf5f2] px-3 py-1 text-[10px] font-bold uppercase text-[#173f35]">
              {statusLabel(po.status)}
            </span>
            <p className="mt-2 text-lg font-semibold text-[#173f35]">
              € {number(po.total_eur, 2)}
            </p>
            <p className="text-[10px] text-[#718078]">
              {number(po.total_tonnes, 3)} t
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-5 px-5 py-5 sm:px-6">
        <div className="overflow-x-auto">
          <table className="min-w-[760px] w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#dce2df] text-[#66736e]">
                <th className="py-2">Riga</th>
                <th className="py-2">Articolo</th>
                <th className="py-2 text-right">t</th>
                <th className="py-2 text-right">€/t</th>
                <th className="py-2 text-right">€/m</th>
                <th className="py-2 text-right">Totale</th>
              </tr>
            </thead>
            <tbody>
              {po.lines.map((line) => (
                <tr key={line.id} className="border-b border-[#edf0ee]">
                  <td className="py-3 font-semibold">{line.line_position}</td>
                  <td className="py-3">
                    <p className="font-semibold">{line.description}</p>
                    <p className="mt-0.5 text-[10px] text-[#718078]">
                      {line.standard_code || "—"} · {line.grade_code || "—"} ·{" "}
                      {line.finish_code || "—"}
                    </p>
                  </td>
                  <td className="py-3 text-right">{number(line.awarded_tonnes, 3)}</td>
                  <td className="py-3 text-right">€ {number(line.unit_eur_t, 2)}</td>
                  <td className="py-3 text-right">€ {number(line.unit_eur_m, 4)}</td>
                  <td className="py-3 text-right font-semibold">
                    € {number(line.line_total_eur, 2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {editable ? (
          <div className="rounded-2xl border border-[#dce2df] bg-[#fbfcfb] p-4">
            <p className="text-xs font-bold uppercase tracking-[0.08em] text-[#1a5144]">
              Termini operativi PO
            </p>
            <p className="mt-1 text-[10px] leading-4 text-[#718078]">
              Prezzi e quantità sono congelati dall&apos;award. Qui puoi aggiornare solo
              condizioni operative prima dell&apos;emissione o del reissue.
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className="text-xs font-semibold text-[#52615b]">
                Incoterm
                <input
                  value={incoterm}
                  onChange={(event) => setIncoterm(event.target.value)}
                  className="mt-1.5 h-10 w-full rounded-xl border border-[#cfd8d4] bg-white px-3"
                />
              </label>
              <label className="text-xs font-semibold text-[#52615b]">
                Pagamento
                <input
                  value={paymentTerms}
                  onChange={(event) => setPaymentTerms(event.target.value)}
                  className="mt-1.5 h-10 w-full rounded-xl border border-[#cfd8d4] bg-white px-3"
                />
              </label>
              <label className="text-xs font-semibold text-[#52615b]">
                Consegna
                <input
                  type="date"
                  value={deliveryDate}
                  onChange={(event) => setDeliveryDate(event.target.value)}
                  className="mt-1.5 h-10 w-full rounded-xl border border-[#cfd8d4] bg-white px-3"
                />
              </label>
              <label className="text-xs font-semibold text-[#52615b]">
                Lead time giorni
                <input
                  inputMode="numeric"
                  value={leadTimeDays}
                  onChange={(event) => setLeadTimeDays(event.target.value)}
                  className="mt-1.5 h-10 w-full rounded-xl border border-[#cfd8d4] bg-white px-3"
                />
              </label>
            </div>
            <label className="mt-3 block text-xs font-semibold text-[#52615b]">
              Note PO
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={2}
                maxLength={4000}
                className="mt-1.5 w-full rounded-xl border border-[#cfd8d4] bg-white px-3 py-2.5"
              />
            </label>
            <button
              type="button"
              onClick={saveTerms}
              disabled={pending}
              className="mt-3 inline-flex min-h-10 items-center rounded-xl border border-[#b8d2c8] bg-white px-4 text-xs font-bold text-[#173f35] disabled:opacity-50"
            >
              {pending ? "Salvo…" : "Salva termini"}
            </button>
          </div>
        ) : null}

        {editable ? (
          <div className="rounded-2xl border border-[#cfe1da] bg-[#edf5f2] p-4">
            <p className="text-xs font-bold uppercase tracking-[0.08em] text-[#1a5144]">
              Emissione
            </p>
            <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_260px]">
              <label className="text-xs font-semibold text-[#52615b]">
                Messaggio al supplier
                <textarea
                  value={buyerMessage}
                  onChange={(event) => setBuyerMessage(event.target.value)}
                  rows={3}
                  maxLength={4000}
                  placeholder="Es. Confermare ordine e data di consegna…"
                  className="mt-1.5 w-full rounded-xl border border-[#cfd8d4] bg-white px-3 py-2.5"
                />
              </label>
              <label className="text-xs font-semibold text-[#52615b]">
                Conferma richiesta entro
                <input
                  type="datetime-local"
                  value={confirmationDueAt}
                  onChange={(event) => setConfirmationDueAt(event.target.value)}
                  className="mt-1.5 h-10 w-full rounded-xl border border-[#cfd8d4] bg-white px-3"
                />
              </label>
            </div>
            <button
              type="button"
              onClick={issue}
              disabled={pending}
              className="mt-3 inline-flex min-h-11 items-center rounded-xl bg-[#173f35] px-5 text-sm font-bold text-white disabled:opacity-50"
            >
              {pending
                ? "Emetto…"
                : po.versions.length
                  ? "Emetti nuova versione PO"
                  : "Emetti Purchase Order"}
            </button>
            <p className="mt-2 text-[10px] leading-4 text-[#527268]">
              Ogni emissione crea uno snapshot immutabile e un nuovo link personale supplier.
            </p>
          </div>
        ) : null}

        {lastSupplierUrl ? (
          <div className="rounded-xl border border-[#eadfbe] bg-[#fffaf1] p-3">
            <p className="text-xs font-semibold text-[#6d5d2f]">
              Link personale supplier disponibile per questa emissione.
            </p>
            <button
              type="button"
              onClick={() => copyLink(lastSupplierUrl)}
              className="mt-2 text-xs font-bold text-[#6d5d2f] underline underline-offset-4"
            >
              Copia link
            </button>
          </div>
        ) : null}

        {po.versions.length ? (
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.08em] text-[#1a5144]">
              Storico versioni
            </p>
            <div className="mt-3 space-y-2">
              {po.versions.map((version) => (
                <div
                  key={version.id}
                  className="rounded-2xl border border-[#e2e7e4] bg-[#fbfcfb] p-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold text-[#1d2824]">
                        {version.po_number}
                      </p>
                      <p className="mt-1 text-[10px] text-[#718078]">
                        {dateTime(version.issued_at)} · email {version.delivery_status}
                      </p>
                    </div>
                    <span className="rounded-full bg-white px-2.5 py-1 text-[9px] font-bold uppercase text-[#52615b] ring-1 ring-inset ring-[#dce2df]">
                      {statusLabel(version.status)}
                    </span>
                  </div>

                  {version.response ? (
                    <div className="mt-2 rounded-xl bg-white px-3 py-2 text-xs text-[#52615b]">
                      <strong>{statusLabel(version.response.decision)}</strong>
                      {version.response.message ? " · " + version.response.message : ""}
                      {version.response.confirmed_delivery_date
                        ? " · consegna " + version.response.confirmed_delivery_date
                        : ""}
                      {version.response.supplier_reference
                        ? " · rif. " + version.response.supplier_reference
                        : ""}
                    </div>
                  ) : null}

                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    {version.supplier_url ? (
                      <>
                        <a
                          href={version.supplier_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[10px] font-bold text-[#173f35] underline underline-offset-4"
                        >
                          Apri documento
                        </a>
                        <button
                          type="button"
                          onClick={() => copyLink(version.supplier_url as string)}
                          className="text-[10px] font-bold text-[#52615b] underline underline-offset-4"
                        >
                          Copia link supplier
                        </button>
                      </>
                    ) : null}
                    <span className="text-[9px] text-[#87908c]">
                      SHA {version.snapshot_sha256.slice(0, 12)}…
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {feedback ? (
          <p className="text-xs font-semibold text-[#66736e]">{feedback}</p>
        ) : null}
      </div>
    </article>
  );
}

export function Rfqh9PurchaseOrderPanel({
  rfqId,
  state,
}: {
  rfqId: string;
  state: Rfqh9PoState | null;
}) {
  const purchaseOrders = state?.purchase_orders ?? [];
  if (!purchaseOrders.length) return null;

  const confirmed = purchaseOrders.filter(
    (po) => po.status === "supplier_confirmed",
  ).length;

  return (
    <section className="rounded-3xl border border-[#cddbd6] bg-[#f8faf9] p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#1a5144]">
            RFQH9 · Purchase Order Issuance &amp; Supplier Confirmation
          </p>
          <h2 className="mt-1 text-xl font-semibold text-[#1d2824]">
            Emetti e governa gli ordini ai supplier
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#66736e]">
            Ogni PO è versionato. Il supplier può confermare, rifiutare o richiedere
            modifiche senza account; la risposta resta collegata alla versione esatta.
          </p>
        </div>
        <span className="rounded-full bg-white px-3 py-1 text-[10px] font-bold uppercase text-[#173f35]">
          {confirmed}/{purchaseOrders.length} confermati
        </span>
      </div>

      <div className="mt-4 space-y-4">
        {purchaseOrders.map((po) => (
          <PurchaseOrderCard key={po.id} rfqId={rfqId} po={po} />
        ))}
      </div>
    </section>
  );
}
