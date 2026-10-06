"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import {
  declineSupplierQuote,
  saveSupplierQuote,
  startSupplierQuoteRevision,
  submitSupplierQuote,
  type QuoteLineInput,
} from "@/app/(public)/rfq/respond/[token]/actions";

type RequestLine = {
  line_id: string;
  position: number;
  description: string;
  standard: string | null;
  grade: string | null;
  finish: string | null;
  quantity_mode: string;
  quantity: number | string;
  bar_length_m: number | string | null;
  weight_kg_m: number | string;
  line_meters: number | string;
  line_tonnes: number | string;
  note: string | null;
};

type ExistingQuoteLine = {
  line_id: string;
  position: number;
  response_status: "quoted" | "not_available";
  price_basis: "eur_t" | "eur_m" | null;
  unit_price: number | string | null;
  normalized_eur_t: number | string | null;
  normalized_eur_m: number | string | null;
  offered_quantity: number | string | null;
  offered_quantity_mode: "meters" | "tonnes" | "bars" | null;
  moq_tonnes: number | string | null;
  lead_time_days: number | string | null;
  delivery_date: string | null;
  notes: string | null;
};

type ExistingQuote = {
  id: string;
  revision_no: number;
  status: "draft" | "submitted" | "declined" | "superseded";
  incoterm: string | null;
  payment_terms: string | null;
  validity_until: string | null;
  lead_time_days: number | string | null;
  delivery_date: string | null;
  moq_tonnes: number | string | null;
  notes: string | null;
  decline_reason: string | null;
  attachment_name: string | null;
  attachment_size_bytes: number | string | null;
  submitted_at: string | null;
  lines: ExistingQuoteLine[];
};

type EditableLine = {
  lineId: string;
  responseStatus: "quoted" | "not_available";
  priceBasis: "eur_t" | "eur_m";
  unitPrice: string;
  offeredQuantity: string;
  offeredQuantityMode: "meters" | "tonnes" | "bars";
  moqTonnes: string;
  leadTimeDays: string;
  deliveryDate: string;
  notes: string;
};

function asText(value: unknown) {
  return value === null || value === undefined ? "" : String(value);
}

function normalizeDecimal(value: string) {
  return value.trim().replace(",", ".");
}

function quantityModeLabel(mode: string) {
  if (mode === "tonnes") return "t";
  if (mode === "bars") return "barre";
  return "m";
}

function formatNumber(value: number, digits = 2) {
  return value.toLocaleString("it-IT", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  });
}

function buildInitialLine(line: RequestLine, existing?: ExistingQuoteLine): EditableLine {
  return {
    lineId: line.line_id,
    responseStatus: existing?.response_status ?? "quoted",
    priceBasis: existing?.price_basis ?? "eur_t",
    unitPrice: asText(existing?.unit_price),
    offeredQuantity: asText(existing?.offered_quantity ?? line.quantity),
    offeredQuantityMode:
      existing?.offered_quantity_mode ??
      (["meters", "tonnes", "bars"].includes(line.quantity_mode)
        ? (line.quantity_mode as "meters" | "tonnes" | "bars")
        : "meters"),
    moqTonnes: asText(existing?.moq_tonnes),
    leadTimeDays: asText(existing?.lead_time_days),
    deliveryDate: existing?.delivery_date ?? "",
    notes: existing?.notes ?? "",
  };
}

export function RfqSupplierResponseForm({
  token,
  canRespond,
  expired,
  lines,
  quote,
  uploadUrl,
}: {
  token: string;
  canRespond: boolean;
  expired: boolean;
  lines: RequestLine[];
  quote: ExistingQuote | null;
  uploadUrl: string;
}) {
  const router = useRouter();
  const quoteLineById = useMemo(
    () => new Map((quote?.lines ?? []).map((line) => [line.line_id, line])),
    [quote?.lines],
  );

  const [incoterm, setIncoterm] = useState(quote?.incoterm ?? "");
  const [paymentTerms, setPaymentTerms] = useState(quote?.payment_terms ?? "");
  const [validityUntil, setValidityUntil] = useState(quote?.validity_until ?? "");
  const [leadTimeDays, setLeadTimeDays] = useState(asText(quote?.lead_time_days));
  const [deliveryDate, setDeliveryDate] = useState(quote?.delivery_date ?? "");
  const [moqTonnes, setMoqTonnes] = useState(asText(quote?.moq_tonnes));
  const [notes, setNotes] = useState(quote?.notes ?? "");
  const [declineReason, setDeclineReason] = useState(quote?.decline_reason ?? "");
  const [attachmentName, setAttachmentName] = useState(quote?.attachment_name ?? null);
  const [editableLines, setEditableLines] = useState<EditableLine[]>(
    lines.map((line) => buildInitialLine(line, quoteLineById.get(line.line_id))),
  );
  const [feedback, setFeedback] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [uploadPending, setUploadPending] = useState(false);

  const submitted = quote?.status === "submitted";
  const declined = quote?.status === "declined";
  const editable = canRespond && !expired && !submitted && !declined;

  function updateLine(lineId: string, patch: Partial<EditableLine>) {
    setEditableLines((current) =>
      current.map((line) => (line.lineId === lineId ? { ...line, ...patch } : line)),
    );
  }

  function payloadLines(): QuoteLineInput[] {
    return editableLines.map((line) => ({
      lineId: line.lineId,
      responseStatus: line.responseStatus,
      priceBasis: line.responseStatus === "quoted" ? line.priceBasis : null,
      unitPrice:
        line.responseStatus === "quoted" ? normalizeDecimal(line.unitPrice) : null,
      offeredQuantity: normalizeDecimal(line.offeredQuantity),
      offeredQuantityMode: line.offeredQuantityMode,
      moqTonnes: normalizeDecimal(line.moqTonnes),
      leadTimeDays: line.leadTimeDays.trim(),
      deliveryDate: line.deliveryDate,
      notes: line.notes,
    }));
  }

  function saveDraft(afterSave?: () => Promise<void>) {
    setFeedback(null);
    startTransition(async () => {
      const result = await saveSupplierQuote({
        token,
        header: {
          incoterm,
          paymentTerms,
          validityUntil,
          leadTimeDays: leadTimeDays.trim(),
          deliveryDate,
          moqTonnes: normalizeDecimal(moqTonnes),
          notes,
        },
        lines: payloadLines(),
      });

      if (!result.ok) {
        setFeedback(result.error ?? "Salvataggio non riuscito.");
        return;
      }

      if (afterSave) {
        await afterSave();
        return;
      }

      setFeedback("Bozza salvata.");
      router.refresh();
    });
  }

  function submit() {
    saveDraft(async () => {
      const result = await submitSupplierQuote(token);
      if (!result.ok) {
        setFeedback(result.error ?? "Invio offerta non riuscito.");
        return;
      }
      setFeedback("Offerta inviata al buyer.");
      router.refresh();
    });
  }

  function decline() {
    if (!window.confirm("Confermi che non vuoi presentare un'offerta per questa RFQ?")) {
      return;
    }
    setFeedback(null);
    startTransition(async () => {
      const result = await declineSupplierQuote(token, declineReason);
      if (!result.ok) {
        setFeedback(result.error ?? "Rifiuto RFQ non riuscito.");
        return;
      }
      setFeedback("RFQ rifiutata. Il buyer vedrà l'esito.");
      router.refresh();
    });
  }

  function revise() {
    setFeedback(null);
    startTransition(async () => {
      const result = await startSupplierQuoteRevision(token);
      if (!result.ok) {
        setFeedback(result.error ?? "Non è stato possibile creare la revisione.");
        return;
      }
      setFeedback("Nuova revisione aperta.");
      router.refresh();
    });
  }

  async function uploadAttachment(file: File | null) {
    if (!file) return;
    setFeedback(null);
    setUploadPending(true);
    try {
      const form = new FormData();
      form.set("token", token);
      form.set("file", file);
      const response = await fetch(uploadUrl, {
        method: "POST",
        body: form,
      });
      const payload = (await response.json().catch(() => ({}))) as {
        attachment_name?: string;
        error?: string;
        detail?: string;
      };
      if (!response.ok) {
        setFeedback(
          payload.error === "file_size_limit_10mb"
            ? "L'allegato supera il limite di 10 MB."
            : payload.error === "pdf_xls_xlsx_only"
              ? "Sono accettati solo PDF, XLS e XLSX."
              : payload.detail || "Upload allegato non riuscito.",
        );
        return;
      }
      setAttachmentName(payload.attachment_name ?? file.name);
      setFeedback("Allegato caricato.");
      router.refresh();
    } finally {
      setUploadPending(false);
    }
  }

  return (
    <section className="rounded-3xl border border-[#cddbd6] bg-white">
      <div className="border-b border-[#e5ebe8] px-5 py-5 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#1a5144]">
              RFQH4 · Supplier Response Portal
            </p>
            <h2 className="mt-1 text-xl font-semibold text-[#1d2824]">
              {submitted
                ? "Offerta inviata"
                : declined
                  ? "RFQ rifiutata"
                  : "Compila la tua offerta"}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#66736e]">
              Puoi quotare in €/t oppure €/m. Smart Steel Sales calcola automaticamente
              l&apos;unità equivalente usando il peso kg/m richiesto dal buyer.
            </p>
          </div>
          {quote ? (
            <span className="rounded-full bg-[#edf5f2] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-[#173f35]">
              Revisione {quote.revision_no} · {quote.status}
            </span>
          ) : null}
        </div>
      </div>

      {declined ? (
        <div className="px-5 py-6 sm:px-6">
          <p className="text-sm font-semibold text-[#1d2824]">
            Hai indicato che non puoi quotare questa richiesta.
          </p>
          {quote?.decline_reason ? (
            <p className="mt-2 text-sm text-[#66736e]">{quote.decline_reason}</p>
          ) : null}
        </div>
      ) : (
        <>
          <div className="space-y-4 px-4 py-5 sm:px-6">
            {lines.map((requestLine, index) => {
              const line = editableLines[index];
              const weight = Number(requestLine.weight_kg_m);
              const rawPrice = Number(normalizeDecimal(line?.unitPrice ?? ""));
              const counterpart =
                Number.isFinite(rawPrice) && rawPrice > 0 && Number.isFinite(weight) && weight > 0
                  ? line.priceBasis === "eur_t"
                    ? rawPrice * weight / 1000
                    : rawPrice * 1000 / weight
                  : null;

              return (
                <article
                  key={requestLine.line_id}
                  className="rounded-2xl border border-[#dce2df] bg-[#fbfcfb] p-4 sm:p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-[#1a5144]">
                        Riga {requestLine.position}
                      </p>
                      <h3 className="mt-1 text-base font-semibold text-[#1d2824]">
                        {requestLine.description}
                      </h3>
                      <p className="mt-1 text-xs leading-5 text-[#718078]">
                        {[requestLine.standard, requestLine.grade, requestLine.finish]
                          .filter(Boolean)
                          .join(" · ") || "Specifica buyer"}
                      </p>
                    </div>
                    <div className="rounded-xl bg-white px-3 py-2 text-right">
                      <p className="text-[10px] uppercase tracking-[0.08em] text-[#718078]">
                        Richiesto
                      </p>
                      <p className="mt-1 text-sm font-semibold text-[#1d2824]">
                        {asText(requestLine.quantity)} {quantityModeLabel(requestLine.quantity_mode)}
                      </p>
                      <p className="text-[10px] text-[#718078]">
                        {formatNumber(weight, 3)} kg/m
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <label className="text-xs font-semibold text-[#52615b]">
                      Disponibilità
                      <select
                        value={line.responseStatus}
                        onChange={(event) =>
                          updateLine(line.lineId, {
                            responseStatus: event.target.value as "quoted" | "not_available",
                          })
                        }
                        disabled={!editable}
                        className="mt-1.5 h-11 w-full rounded-xl border border-[#cfd8d4] bg-white px-3 text-sm text-[#1d2824] disabled:bg-[#f2f4f3]"
                      >
                        <option value="quoted">Quoto questa riga</option>
                        <option value="not_available">Non disponibile</option>
                      </select>
                    </label>

                    {line.responseStatus === "quoted" ? (
                      <>
                        <label className="text-xs font-semibold text-[#52615b]">
                          Base prezzo
                          <select
                            value={line.priceBasis}
                            onChange={(event) =>
                              updateLine(line.lineId, {
                                priceBasis: event.target.value as "eur_t" | "eur_m",
                              })
                            }
                            disabled={!editable}
                            className="mt-1.5 h-11 w-full rounded-xl border border-[#cfd8d4] bg-white px-3 text-sm text-[#1d2824] disabled:bg-[#f2f4f3]"
                          >
                            <option value="eur_t">€/t</option>
                            <option value="eur_m">€/m</option>
                          </select>
                        </label>

                        <label className="text-xs font-semibold text-[#52615b]">
                          Prezzo {line.priceBasis === "eur_t" ? "€/t" : "€/m"}
                          <input
                            value={line.unitPrice}
                            onChange={(event) =>
                              updateLine(line.lineId, { unitPrice: event.target.value })
                            }
                            disabled={!editable}
                            inputMode="decimal"
                            placeholder={line.priceBasis === "eur_t" ? "es. 760" : "es. 8,25"}
                            className="mt-1.5 h-11 w-full rounded-xl border border-[#cfd8d4] bg-white px-3 text-sm text-[#1d2824] disabled:bg-[#f2f4f3]"
                          />
                        </label>

                        <div className="rounded-xl border border-[#cfe1da] bg-[#edf5f2] px-3 py-2.5">
                          <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#527268]">
                            Equivalente
                          </p>
                          <p className="mt-1 text-sm font-semibold text-[#173f35]">
                            {counterpart === null
                              ? "—"
                              : line.priceBasis === "eur_t"
                                ? "€ " + formatNumber(counterpart, 4) + "/m"
                                : "€ " + formatNumber(counterpart, 2) + "/t"}
                          </p>
                        </div>
                      </>
                    ) : null}
                  </div>

                  {line.responseStatus === "quoted" ? (
                    <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <label className="text-xs font-semibold text-[#52615b]">
                        Quantità offerta
                        <input
                          value={line.offeredQuantity}
                          onChange={(event) =>
                            updateLine(line.lineId, { offeredQuantity: event.target.value })
                          }
                          disabled={!editable}
                          inputMode="decimal"
                          className="mt-1.5 h-10 w-full rounded-xl border border-[#d9e0dd] bg-white px-3 text-sm disabled:bg-[#f2f4f3]"
                        />
                      </label>
                      <label className="text-xs font-semibold text-[#52615b]">
                        Unità
                        <select
                          value={line.offeredQuantityMode}
                          onChange={(event) =>
                            updateLine(line.lineId, {
                              offeredQuantityMode: event.target.value as "meters" | "tonnes" | "bars",
                            })
                          }
                          disabled={!editable}
                          className="mt-1.5 h-10 w-full rounded-xl border border-[#d9e0dd] bg-white px-3 text-sm disabled:bg-[#f2f4f3]"
                        >
                          <option value="meters">metri</option>
                          <option value="tonnes">tonnellate</option>
                          <option value="bars">barre</option>
                        </select>
                      </label>
                      <label className="text-xs font-semibold text-[#52615b]">
                        MOQ t
                        <input
                          value={line.moqTonnes}
                          onChange={(event) =>
                            updateLine(line.lineId, { moqTonnes: event.target.value })
                          }
                          disabled={!editable}
                          inputMode="decimal"
                          placeholder="opzionale"
                          className="mt-1.5 h-10 w-full rounded-xl border border-[#d9e0dd] bg-white px-3 text-sm disabled:bg-[#f2f4f3]"
                        />
                      </label>
                      <label className="text-xs font-semibold text-[#52615b]">
                        Lead time giorni
                        <input
                          value={line.leadTimeDays}
                          onChange={(event) =>
                            updateLine(line.lineId, { leadTimeDays: event.target.value })
                          }
                          disabled={!editable}
                          inputMode="numeric"
                          placeholder="opzionale"
                          className="mt-1.5 h-10 w-full rounded-xl border border-[#d9e0dd] bg-white px-3 text-sm disabled:bg-[#f2f4f3]"
                        />
                      </label>
                      <label className="text-xs font-semibold text-[#52615b]">
                        Data consegna
                        <input
                          type="date"
                          value={line.deliveryDate}
                          onChange={(event) =>
                            updateLine(line.lineId, { deliveryDate: event.target.value })
                          }
                          disabled={!editable}
                          className="mt-1.5 h-10 w-full rounded-xl border border-[#d9e0dd] bg-white px-3 text-sm disabled:bg-[#f2f4f3]"
                        />
                      </label>
                      <label className="text-xs font-semibold text-[#52615b] sm:col-span-2 lg:col-span-3">
                        Note riga
                        <input
                          value={line.notes}
                          onChange={(event) =>
                            updateLine(line.lineId, { notes: event.target.value })
                          }
                          disabled={!editable}
                          maxLength={2000}
                          placeholder="Tolleranze, disponibilità, vincoli..."
                          className="mt-1.5 h-10 w-full rounded-xl border border-[#d9e0dd] bg-white px-3 text-sm disabled:bg-[#f2f4f3]"
                        />
                      </label>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>

          <div className="border-t border-[#e5ebe8] bg-[#f8faf9] px-5 py-5 sm:px-6">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#1a5144]">
              Condizioni generali offerta
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <label className="text-xs font-semibold text-[#52615b]">
                Incoterm
                <input
                  value={incoterm}
                  onChange={(event) => setIncoterm(event.target.value)}
                  disabled={!editable}
                  maxLength={32}
                  placeholder="es. DAP, EXW"
                  className="mt-1.5 h-10 w-full rounded-xl border border-[#cfd8d4] bg-white px-3 text-sm disabled:bg-[#f2f4f3]"
                />
              </label>
              <label className="text-xs font-semibold text-[#52615b]">
                Pagamento
                <input
                  value={paymentTerms}
                  onChange={(event) => setPaymentTerms(event.target.value)}
                  disabled={!editable}
                  maxLength={240}
                  placeholder="es. 60 gg d.f.f.m."
                  className="mt-1.5 h-10 w-full rounded-xl border border-[#cfd8d4] bg-white px-3 text-sm disabled:bg-[#f2f4f3]"
                />
              </label>
              <label className="text-xs font-semibold text-[#52615b]">
                Validità offerta
                <input
                  type="date"
                  value={validityUntil}
                  onChange={(event) => setValidityUntil(event.target.value)}
                  disabled={!editable}
                  className="mt-1.5 h-10 w-full rounded-xl border border-[#cfd8d4] bg-white px-3 text-sm disabled:bg-[#f2f4f3]"
                />
              </label>
              <label className="text-xs font-semibold text-[#52615b]">
                Lead time generale
                <input
                  value={leadTimeDays}
                  onChange={(event) => setLeadTimeDays(event.target.value)}
                  disabled={!editable}
                  inputMode="numeric"
                  placeholder="giorni"
                  className="mt-1.5 h-10 w-full rounded-xl border border-[#cfd8d4] bg-white px-3 text-sm disabled:bg-[#f2f4f3]"
                />
              </label>
              <label className="text-xs font-semibold text-[#52615b]">
                Data consegna generale
                <input
                  type="date"
                  value={deliveryDate}
                  onChange={(event) => setDeliveryDate(event.target.value)}
                  disabled={!editable}
                  className="mt-1.5 h-10 w-full rounded-xl border border-[#cfd8d4] bg-white px-3 text-sm disabled:bg-[#f2f4f3]"
                />
              </label>
              <label className="text-xs font-semibold text-[#52615b]">
                MOQ generale t
                <input
                  value={moqTonnes}
                  onChange={(event) => setMoqTonnes(event.target.value)}
                  disabled={!editable}
                  inputMode="decimal"
                  placeholder="opzionale"
                  className="mt-1.5 h-10 w-full rounded-xl border border-[#cfd8d4] bg-white px-3 text-sm disabled:bg-[#f2f4f3]"
                />
              </label>
            </div>

            <label className="mt-3 block text-xs font-semibold text-[#52615b]">
              Note generali
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                disabled={!editable}
                rows={3}
                maxLength={4000}
                className="mt-1.5 w-full rounded-xl border border-[#cfd8d4] bg-white px-3 py-2.5 text-sm disabled:bg-[#f2f4f3]"
              />
            </label>

            <div className="mt-4 rounded-2xl border border-[#dce2df] bg-white p-4">
              <p className="text-xs font-semibold text-[#52615b]">Allegato offerta</p>
              <p className="mt-1 text-xs text-[#718078]">
                PDF, XLS o XLSX · massimo 10 MB. L&apos;allegato resta privato tra te e il buyer.
              </p>
              {attachmentName ? (
                <p className="mt-2 text-sm font-semibold text-[#173f35]">
                  ✓ {attachmentName}
                </p>
              ) : null}
              {editable ? (
                <input
                  type="file"
                  accept=".pdf,.xls,.xlsx,application/pdf,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  disabled={uploadPending}
                  onChange={(event) => void uploadAttachment(event.target.files?.[0] ?? null)}
                  className="mt-3 block w-full text-xs text-[#52615b] file:mr-3 file:rounded-lg file:border-0 file:bg-[#edf5f2] file:px-3 file:py-2 file:font-semibold file:text-[#173f35]"
                />
              ) : null}
            </div>

            {editable ? (
              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => saveDraft()}
                  disabled={pending || uploadPending}
                  className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[#b8d2c8] bg-white px-5 text-sm font-bold text-[#173f35] disabled:opacity-50"
                >
                  {pending ? "Salvataggio…" : "Salva bozza"}
                </button>
                <button
                  type="button"
                  onClick={submit}
                  disabled={pending || uploadPending}
                  className="platform-primary inline-flex min-h-11 items-center justify-center rounded-xl px-5 text-sm font-bold disabled:opacity-50"
                >
                  {pending ? "Invio…" : "Invia offerta"}
                </button>
              </div>
            ) : submitted && canRespond && !expired ? (
              <button
                type="button"
                onClick={revise}
                disabled={pending}
                className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl border border-[#b8d2c8] bg-white px-5 text-sm font-bold text-[#173f35] disabled:opacity-50"
              >
                {pending ? "Apertura revisione…" : "Crea nuova revisione"}
              </button>
            ) : null}

            {editable ? (
              <div className="mt-6 border-t border-[#e5ebe8] pt-5">
                <label className="block text-xs font-semibold text-[#52615b]">
                  Se non puoi quotare, motivazione opzionale
                  <input
                    value={declineReason}
                    onChange={(event) => setDeclineReason(event.target.value)}
                    maxLength={1000}
                    placeholder="es. materiale fuori gamma"
                    className="mt-1.5 h-10 w-full max-w-xl rounded-xl border border-[#d9e0dd] bg-white px-3 text-sm"
                  />
                </label>
                <button
                  type="button"
                  onClick={decline}
                  disabled={pending || uploadPending}
                  className="mt-3 text-sm font-semibold text-[#8b5148] underline underline-offset-4 disabled:opacity-50"
                >
                  Non posso quotare questa RFQ
                </button>
              </div>
            ) : null}

            {feedback ? (
              <p className="mt-4 rounded-xl border border-[#dce2df] bg-white px-4 py-3 text-sm font-semibold text-[#52615b]">
                {feedback}
              </p>
            ) : null}
          </div>
        </>
      )}
    </section>
  );
}
