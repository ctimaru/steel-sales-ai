"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { submitPurchaseOrderDecision } from "@/app/(public)/po/respond/[token]/actions";
import type { Rfqh9SupplierPortal } from "@/lib/rfqh9-po";

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

function dateLabel(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "—";
  return new Intl.DateTimeFormat("it-IT", {
    dateStyle: "medium",
  }).format(date);
}

function dateTimeLabel(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "—";
  return new Intl.DateTimeFormat("it-IT", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function decisionLabel(value: string | undefined) {
  if (value === "confirmed") return "Confermato";
  if (value === "rejected") return "Rifiutato";
  if (value === "change_requested") return "Modifica richiesta";
  return value || "—";
}

export function Rfqh9SupplierPoPortal({
  token,
  portal,
}: {
  token: string;
  portal: Rfqh9SupplierPortal;
}) {
  const router = useRouter();
  const [decision, setDecision] =
    useState<"confirmed" | "rejected" | "change_requested">("confirmed");
  const [message, setMessage] = useState("");
  const [deliveryDate, setDeliveryDate] = useState(portal.delivery_date || "");
  const [supplierReference, setSupplierReference] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setFeedback(null);
    if (
      (decision === "rejected" || decision === "change_requested") &&
      !message.trim()
    ) {
      setFeedback("Inserisci una motivazione.");
      return;
    }

    startTransition(async () => {
      const result = await submitPurchaseOrderDecision({
        token,
        decision,
        message,
        confirmedDeliveryDate: deliveryDate || null,
        supplierReference,
      });
      if (!result.ok) {
        setFeedback(result.error ?? "Risposta non riuscita.");
        return;
      }
      setFeedback("Risposta registrata.");
      router.refresh();
    });
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-4 py-6 sm:px-6 sm:py-8">
      <section className="overflow-hidden rounded-3xl border border-[#cddbd6] bg-white print:border-0">
        <div className="bg-[#123d34] px-6 py-6 text-white sm:px-8">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#a8cfc1]">
            Smart Steel Sales · Purchase Order
          </p>
          <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold sm:text-3xl">
                {portal.po_number}
              </h1>
              <p className="mt-1 text-sm text-[#cfe1da]">
                Versione {portal.version_no} · emesso {dateTimeLabel(portal.issued_at)}
              </p>
            </div>
            <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold uppercase">
              {decisionLabel(portal.status)}
            </span>
          </div>
        </div>

        <div className="space-y-6 px-6 py-6 sm:px-8">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl bg-[#f7f9f8] p-4">
              <p className="text-[10px] font-bold uppercase text-[#718078]">Buyer</p>
              <p className="mt-1 text-base font-semibold text-[#1d2824]">
                {portal.buyer_organization_name || "Buyer"}
              </p>
            </div>
            <div className="rounded-2xl bg-[#f7f9f8] p-4">
              <p className="text-[10px] font-bold uppercase text-[#718078]">Supplier</p>
              <p className="mt-1 text-base font-semibold text-[#1d2824]">
                {portal.supplier_name || "Fornitore"}
              </p>
            </div>
          </div>

          {portal.buyer_message ? (
            <div className="rounded-2xl border border-[#dce2df] bg-[#fbfcfb] p-4">
              <p className="text-[10px] font-bold uppercase text-[#718078]">
                Messaggio buyer
              </p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#45534e]">
                {portal.buyer_message}
              </p>
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div className="rounded-xl bg-[#f7f9f8] p-3">
              <p className="text-[10px] uppercase text-[#718078]">Totale</p>
              <p className="mt-1 text-lg font-semibold text-[#173f35]">
                € {number(portal.total_eur, 2)}
              </p>
            </div>
            <div className="rounded-xl bg-[#f7f9f8] p-3">
              <p className="text-[10px] uppercase text-[#718078]">Tonnellate</p>
              <p className="mt-1 text-lg font-semibold text-[#1d2824]">
                {number(portal.total_tonnes, 3)}
              </p>
            </div>
            <div className="rounded-xl bg-[#f7f9f8] p-3">
              <p className="text-[10px] uppercase text-[#718078]">Incoterm</p>
              <p className="mt-1 text-sm font-semibold">{portal.incoterm || "—"}</p>
            </div>
            <div className="rounded-xl bg-[#f7f9f8] p-3">
              <p className="text-[10px] uppercase text-[#718078]">Pagamento</p>
              <p className="mt-1 text-sm font-semibold">
                {portal.payment_terms || "—"}
              </p>
            </div>
            <div className="rounded-xl bg-[#f7f9f8] p-3">
              <p className="text-[10px] uppercase text-[#718078]">Consegna</p>
              <p className="mt-1 text-sm font-semibold">
                {dateLabel(portal.delivery_date)}
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-[900px] w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-[#cfd8d4] text-[#66736e]">
                  <th className="px-2 py-2">Riga</th>
                  <th className="px-2 py-2">Articolo</th>
                  <th className="px-2 py-2">Norma</th>
                  <th className="px-2 py-2">Grado</th>
                  <th className="px-2 py-2 text-right">t</th>
                  <th className="px-2 py-2 text-right">€/t</th>
                  <th className="px-2 py-2 text-right">€/m</th>
                  <th className="px-2 py-2 text-right">Totale</th>
                </tr>
              </thead>
              <tbody>
                {(portal.lines ?? []).map((line) => (
                  <tr key={line.line_position} className="border-b border-[#edf0ee]">
                    <td className="px-2 py-3 font-semibold">{line.line_position}</td>
                    <td className="px-2 py-3">
                      <p className="font-semibold text-[#1d2824]">{line.description}</p>
                      <p className="mt-0.5 text-[10px] text-[#718078]">
                        {line.finish_code || "—"}
                      </p>
                    </td>
                    <td className="px-2 py-3">{line.standard_code || "—"}</td>
                    <td className="px-2 py-3">{line.grade_code || "—"}</td>
                    <td className="px-2 py-3 text-right">{number(line.awarded_tonnes, 3)}</td>
                    <td className="px-2 py-3 text-right">€ {number(line.unit_eur_t, 2)}</td>
                    <td className="px-2 py-3 text-right">€ {number(line.unit_eur_m, 4)}</td>
                    <td className="px-2 py-3 text-right font-semibold">
                      € {number(line.line_total_eur, 2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {portal.notes ? (
            <div className="rounded-2xl bg-[#f7f9f8] p-4">
              <p className="text-[10px] font-bold uppercase text-[#718078]">Note PO</p>
              <p className="mt-2 whitespace-pre-wrap text-sm text-[#45534e]">{portal.notes}</p>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#e7ece9] pt-4 text-[10px] text-[#718078]">
            <span>Snapshot SHA-256: {portal.snapshot_sha256}</span>
            <button
              type="button"
              onClick={() => window.print()}
              className="rounded-xl border border-[#cfd8d4] bg-white px-3 py-2 text-xs font-bold text-[#173f35] print:hidden"
            >
              Stampa / Salva PDF
            </button>
          </div>
        </div>
      </section>

      {portal.response ? (
        <section className="rounded-2xl border border-[#cfe1da] bg-[#edf5f2] p-5 print:hidden">
          <p className="text-xs font-bold uppercase tracking-[0.1em] text-[#1a5144]">
            Risposta registrata
          </p>
          <h2 className="mt-1 text-lg font-semibold text-[#173f35]">
            {decisionLabel(portal.response.decision)}
          </h2>
          <p className="mt-2 text-sm text-[#52615b]">
            {portal.response.message || "Nessuna nota aggiuntiva."}
          </p>
          {portal.response.supplier_reference ? (
            <p className="mt-2 text-xs font-semibold text-[#52615b]">
              Riferimento supplier: {portal.response.supplier_reference}
            </p>
          ) : null}
        </section>
      ) : portal.can_respond ? (
        <section className="rounded-3xl border border-[#cddbd6] bg-white p-5 sm:p-6 print:hidden">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#1a5144]">
            Conferma ordine
          </p>
          <h2 className="mt-1 text-xl font-semibold text-[#1d2824]">
            Conferma, rifiuta o richiedi una modifica
          </h2>
          {portal.confirmation_due_at ? (
            <p className="mt-2 text-xs font-semibold text-[#7b5e2b]">
              Risposta richiesta entro {dateTimeLabel(portal.confirmation_due_at)}
            </p>
          ) : null}

          <div className="mt-4 grid gap-3 lg:grid-cols-[220px_1fr]">
            <label className="text-xs font-semibold text-[#52615b]">
              Decisione
              <select
                value={decision}
                onChange={(event) =>
                  setDecision(
                    event.target.value as "confirmed" | "rejected" | "change_requested",
                  )
                }
                className="mt-1.5 h-10 w-full rounded-xl border border-[#cfd8d4] bg-white px-3 text-sm"
              >
                <option value="confirmed">Conferma ordine</option>
                <option value="change_requested">Richiedi modifica</option>
                <option value="rejected">Rifiuta ordine</option>
              </select>
            </label>

            <label className="text-xs font-semibold text-[#52615b]">
              Messaggio
              <textarea
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                rows={3}
                maxLength={4000}
                placeholder={
                  decision === "confirmed"
                    ? "Nota opzionale…"
                    : "Motivazione obbligatoria…"
                }
                className="mt-1.5 w-full rounded-xl border border-[#cfd8d4] bg-white px-3 py-2.5 text-sm"
              />
            </label>
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-semibold text-[#52615b]">
              Data consegna confermata
              <input
                type="date"
                value={deliveryDate}
                onChange={(event) => setDeliveryDate(event.target.value)}
                className="mt-1.5 h-10 w-full rounded-xl border border-[#cfd8d4] bg-white px-3 text-sm"
              />
            </label>
            <label className="text-xs font-semibold text-[#52615b]">
              Riferimento ordine supplier
              <input
                value={supplierReference}
                onChange={(event) => setSupplierReference(event.target.value)}
                maxLength={200}
                placeholder="Es. conferma OC / riferimento ERP"
                className="mt-1.5 h-10 w-full rounded-xl border border-[#cfd8d4] bg-white px-3 text-sm"
              />
            </label>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={submit}
              disabled={pending}
              className="inline-flex min-h-11 items-center rounded-xl bg-[#173f35] px-5 text-sm font-bold text-white disabled:opacity-50"
            >
              {pending ? "Registro…" : "Registra risposta"}
            </button>
            {feedback ? (
              <span className="text-xs font-semibold text-[#66736e]">{feedback}</span>
            ) : null}
          </div>
        </section>
      ) : (
        <section className="rounded-2xl border border-[#eadfbe] bg-[#fffaf1] p-5 text-sm text-[#6d5d2f] print:hidden">
          Questa versione non è più aperta alla risposta. Potrebbe essere stata sostituita
          da una versione successiva o la scadenza potrebbe essere trascorsa.
        </section>
      )}
    </div>
  );
}
