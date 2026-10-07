"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { confirmRfqAward } from "@/app/(workspace)/marketplace/rfq-hub/[rfqId]/award-actions";
import type { RfqComparisonData, RfqComparisonLineQuote } from "@/components/rfq-quote-comparison";

type AwardRow = {
  id: string;
  rfq_line_id: string;
  supplier_id: string;
  line_position: number;
  description: string;
  awarded_tonnes: number | string;
  awarded_meters: number | string;
  unit_eur_t: number | string;
  unit_eur_m: number | string;
  line_total_eur: number | string;
  savings_eur: number | string;
};

type PoLine = {
  id: string;
  line_position: number;
  description: string;
  awarded_tonnes: number | string;
  awarded_meters: number | string;
  unit_eur_t: number | string;
  unit_eur_m: number | string;
  line_total_eur: number | string;
};

type PoDraft = {
  id: string;
  supplier_id: string;
  status: string;
  po_draft_ref: string;
  supplier_name_snapshot: string | null;
  supplier_email_snapshot: string | null;
  quote_revision_no: number;
  incoterm: string | null;
  payment_terms: string | null;
  total_tonnes: number | string;
  total_eur: number | string;
  commercial_order_id: string | null;
  lines: PoLine[];
};

export type Rfqh7AwardSnapshot = {
  id: string;
  award_mode: "full" | "split";
  reason: string;
  line_count: number;
  supplier_count: number;
  total_tonnes: number | string;
  total_eur: number | string;
  target_total_eur: number | string;
  savings_eur: number | string;
  savings_pct: number | string | null;
  confirmed_at: string;
  allocations: AwardRow[];
  poDrafts: PoDraft[];
};

type DraftAllocation = {
  key: string;
  supplierId: string;
  tonnes: string;
};

function num(value: number | string | null | undefined) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function number(value: number | string | null | undefined, digits = 3) {
  const parsed = num(value);
  if (parsed === null) return "—";
  return parsed.toLocaleString("it-IT", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  });
}

function money(value: number | string | null | undefined, digits = 0) {
  const parsed = num(value);
  if (parsed === null) return "—";
  return "€ " + parsed.toLocaleString("it-IT", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function pct(value: number | string | null | undefined) {
  const parsed = num(value);
  if (parsed === null) return "—";
  const sign = parsed > 0 ? "+" : "";
  return sign + parsed.toLocaleString("it-IT", { maximumFractionDigits: 1 }) + "%";
}

function candidateLabel(quote: RfqComparisonLineQuote) {
  return quote.supplier_name || "Fornitore";
}

function freshKey() {
  return Math.random().toString(36).slice(2);
}

export function RfqAwardPanel({
  rfqId,
  campaignStatus,
  comparison,
  award,
  canExecute = true,
}: {
  rfqId: string;
  campaignStatus: string;
  comparison: RfqComparisonData | null;
  award: Rfqh7AwardSnapshot | null;
  canExecute?: boolean;
}) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, DraftAllocation[]>>({});

  const lines = comparison?.lines ?? [];
  const suppliers = comparison?.suppliers ?? [];

  const supplierNameById = useMemo(
    () =>
      new Map(
        suppliers.map((supplier) => [
          supplier.supplier_id,
          supplier.supplier_name || supplier.supplier_email || "Fornitore",
        ]),
      ),
    [suppliers],
  );

  if (award) {
    return (
      <section className="overflow-hidden rounded-3xl border border-[#bdd8ce] bg-white">
        <div className="border-b border-[#d8e8e2] bg-[#edf5f2] px-5 py-5 sm:px-6">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#1a5144]">
            RFQH7 · Award confermato
          </p>
          <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-[#173f35]">
                {award.award_mode === "full" ? "Award unico" : "Split award"} congelato
              </h2>
              <p className="mt-1 text-sm text-[#527268]">
                {award.supplier_count} supplier · {award.line_count} righe · {number(award.total_tonnes)} t
              </p>
            </div>
            <div className="text-right">
              <p className="text-xl font-semibold text-[#173f35]">{money(award.total_eur)}</p>
              <p className="text-xs text-[#527268]">
                Saving {money(award.savings_eur)} · {pct(award.savings_pct)}
              </p>
            </div>
          </div>
          <p className="mt-3 rounded-xl bg-white/70 px-4 py-3 text-sm text-[#45534e]">
            <strong>Motivazione:</strong> {award.reason}
          </p>
        </div>

        <div className="px-5 py-5 sm:px-6">
          <p className="text-xs font-bold uppercase tracking-[0.1em] text-[#1a5144]">
            Allocazioni congelate
          </p>
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-[760px] w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#dce2df] text-[#66736e]">
                  <th className="py-2">Riga</th>
                  <th className="py-2">Supplier</th>
                  <th className="py-2 text-right">t</th>
                  <th className="py-2 text-right">€/t</th>
                  <th className="py-2 text-right">Totale</th>
                  <th className="py-2 text-right">Saving</th>
                </tr>
              </thead>
              <tbody>
                {award.allocations.map((row) => (
                  <tr key={row.id} className="border-b border-[#edf0ee]">
                    <td className="py-3 font-semibold">{row.line_position} · {row.description}</td>
                    <td className="py-3">{supplierNameById.get(row.supplier_id) || "Fornitore"}</td>
                    <td className="py-3 text-right">{number(row.awarded_tonnes)}</td>
                    <td className="py-3 text-right">{money(row.unit_eur_t, 2)}</td>
                    <td className="py-3 text-right font-semibold">{money(row.line_total_eur)}</td>
                    <td className="py-3 text-right">{money(row.savings_eur)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-6">
            <p className="text-xs font-bold uppercase tracking-[0.1em] text-[#1a5144]">
              Purchase Order draft
            </p>
            <p className="mt-1 text-xs leading-5 text-[#718078]">
              Sono bozze procurement: nessun ordine è stato inviato automaticamente. Il bridge con
              l&apos;entità commerciale orders resta esplicito e opzionale.
            </p>
            <div className="mt-3 grid gap-3 lg:grid-cols-2">
              {award.poDrafts.map((po) => (
                <article key={po.id} className="rounded-2xl border border-[#dce2df] bg-[#fbfcfb] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold text-[#1a5144]">{po.po_draft_ref}</p>
                      <p className="mt-1 text-base font-semibold text-[#1d2824]">
                        {po.supplier_name_snapshot || supplierNameById.get(po.supplier_id) || "Fornitore"}
                      </p>
                      <p className="mt-1 text-[10px] text-[#718078]">
                        Quote rev. {po.quote_revision_no} · {po.status}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-base font-semibold text-[#173f35]">{money(po.total_eur)}</p>
                      <p className="text-[10px] text-[#718078]">{number(po.total_tonnes)} t</p>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-xl bg-white p-2.5">
                      <p className="text-[9px] uppercase text-[#87908c]">Incoterm</p>
                      <p className="mt-1 font-semibold">{po.incoterm || "—"}</p>
                    </div>
                    <div className="rounded-xl bg-white p-2.5">
                      <p className="text-[9px] uppercase text-[#87908c]">Pagamento</p>
                      <p className="mt-1 font-semibold">{po.payment_terms || "—"}</p>
                    </div>
                  </div>
                  <p className="mt-3 text-[10px] text-[#718078]">
                    {po.commercial_order_id
                      ? "Collegato a ordine commerciale."
                      : "Non ancora collegato a un ordine commerciale."}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (!comparison || lines.length === 0 || suppliers.length === 0) {
    return (
      <section className="rounded-2xl border border-[#dce2df] bg-white p-5">
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#1a5144]">RFQH7 · Award</p>
        <h2 className="mt-1 text-lg font-semibold text-[#1d2824]">Award non ancora disponibile</h2>
        <p className="mt-2 text-sm text-[#66736e]">Serve almeno un&apos;offerta submitted confrontabile.</p>
      </section>
    );
  }

  const canAward = ["launched", "collecting"].includes(campaignStatus);

  function candidatesFor(lineId: string) {
    const line = lines.find((item) => item.line_id === lineId);
    return (line?.quotes ?? []).filter(
      (quote) =>
        quote.response_status === "quoted" &&
        !quote.revision_in_progress &&
        (num(quote.offered_tonnes) ?? 0) > 0 &&
        (num(quote.normalized_eur_t) ?? 0) > 0,
    );
  }

  function setSingle(lineId: string, supplierId: string, tonnes: number) {
    setDrafts((current) => ({
      ...current,
      [lineId]: [{ key: freshKey(), supplierId, tonnes: String(tonnes) }],
    }));
  }

  function prefillBestPerLine() {
    const next: Record<string, DraftAllocation[]> = {};
    for (const line of lines) {
      const best = line.quotes.find(
        (quote) => quote.is_best_price && quote.is_full_line_coverage && !quote.revision_in_progress,
      );
      if (best) {
        next[line.line_id] = [{
          key: freshKey(),
          supplierId: best.supplier_id,
          tonnes: String(num(line.line_tonnes) ?? ""),
        }];
      }
    }
    setDrafts(next);
  }

  function prefillBestSingle() {
    const supplier = suppliers.find(
      (item) => item.is_best_full_price && !item.revision_in_progress,
    );
    if (!supplier) return;
    const next: Record<string, DraftAllocation[]> = {};
    for (const line of lines) {
      const quote = line.quotes.find(
        (item) => item.supplier_id === supplier.supplier_id && item.is_full_line_coverage,
      );
      if (quote) {
        next[line.line_id] = [{
          key: freshKey(),
          supplierId: supplier.supplier_id,
          tonnes: String(num(line.line_tonnes) ?? ""),
        }];
      }
    }
    setDrafts(next);
  }

  const computed = lines.map((line) => {
    const entries = drafts[line.line_id] ?? [];
    const required = num(line.line_tonnes) ?? 0;
    let awarded = 0;
    let total = 0;

    for (const entry of entries) {
      const tonnes = num(entry.tonnes) ?? 0;
      const quote = line.quotes.find((item) => item.supplier_id === entry.supplierId);
      awarded += tonnes;
      total += tonnes * (num(quote?.normalized_eur_t) ?? 0);
    }

    return { lineId: line.line_id, required, awarded, total };
  });

  const awardedTotal = computed.reduce((sum, row) => sum + row.total, 0);
  const fullyCovered = computed.every(
    (row) => row.required > 0 && Math.abs(row.required - row.awarded) <= 0.000001,
  );
  const targetTotal = num(comparison.target.total_eur) ?? 0;
  const savings = targetTotal - awardedTotal;

  function confirm() {
    if (!fullyCovered) {
      setFeedback("Completa il 100% delle quantità prima di confermare.");
      return;
    }
    if (reason.trim().length < 3) {
      setFeedback("Inserisci una motivazione dell'award.");
      return;
    }

    if (!window.confirm("Confermare definitivamente l'award? Verranno create le bozze PO e chiuse le trattative non selezionate.")) {
      return;
    }

    const allocations = lines.flatMap((line) =>
      (drafts[line.line_id] ?? []).map((entry) => ({
        lineId: line.line_id,
        supplierId: entry.supplierId,
        awardedTonnes: entry.tonnes,
      })),
    );

    setFeedback(null);
    startTransition(async () => {
      const result = await confirmRfqAward({ rfqId, reason, allocations });
      if (!result.ok) {
        setFeedback(result.error ?? "Award non riuscito.");
        return;
      }
      setFeedback("Award confermato. PO draft generati.");
      router.refresh();
    });
  }

  return (
    <section className="rounded-3xl border border-[#cddbd6] bg-[#f8faf9] p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#1a5144]">
            RFQH7 · Award &amp; Commercial Conversion
          </p>
          <h2 className="mt-1 text-xl font-semibold text-[#1d2824]">Decidi l&apos;award</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#66736e]">
            Puoi assegnare l&apos;intera RFQ a un supplier oppure dividere quantità e righe.
            La conferma congela la decisione e genera una bozza PO per ogni supplier premiato.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={prefillBestSingle} className="rounded-xl border border-[#b8d2c8] bg-white px-3 py-2 text-xs font-bold text-[#173f35]">
            Precompila best single
          </button>
          <button type="button" onClick={prefillBestPerLine} className="rounded-xl border border-[#b8d2c8] bg-white px-3 py-2 text-xs font-bold text-[#173f35]">
            Precompila best price/riga
          </button>
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {lines.map((line) => {
          const required = num(line.line_tonnes) ?? 0;
          const entries = drafts[line.line_id] ?? [];
          const awarded = entries.reduce((sum, item) => sum + (num(item.tonnes) ?? 0), 0);
          const candidates = candidatesFor(line.line_id);

          return (
            <article key={line.line_id} className="rounded-2xl border border-[#dce2df] bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase text-[#1a5144]">Riga {line.position}</p>
                  <p className="mt-1 text-sm font-semibold text-[#1d2824]">{line.description}</p>
                </div>
                <div className="text-right text-xs">
                  <p className="font-semibold text-[#173f35]">{number(awarded)}/{number(required)} t</p>
                  <p className="mt-1 text-[10px] text-[#718078]">Target {money(line.target_eur_t, 2)}/t</p>
                </div>
              </div>

              <div className="mt-3 space-y-2">
                {entries.map((entry) => {
                  const quote = line.quotes.find((item) => item.supplier_id === entry.supplierId);
                  const offered = num(quote?.offered_tonnes) ?? 0;
                  return (
                    <div key={entry.key} className="grid gap-2 rounded-xl bg-[#f8faf9] p-3 sm:grid-cols-[1fr_150px_auto]">
                      <select
                        value={entry.supplierId}
                        onChange={(event) =>
                          setDrafts((current) => ({
                            ...current,
                            [line.line_id]: entries.map((item) =>
                              item.key === entry.key ? { ...item, supplierId: event.target.value } : item,
                            ),
                          }))
                        }
                        className="h-10 rounded-lg border border-[#d9e0dd] bg-white px-3 text-xs"
                      >
                        <option value="">Seleziona supplier</option>
                        {candidates.map((candidate) => (
                          <option key={candidate.supplier_id} value={candidate.supplier_id}>
                            {candidateLabel(candidate)} · {money(candidate.normalized_eur_t, 2)}/t · max {number(candidate.offered_tonnes)} t
                          </option>
                        ))}
                      </select>
                      <input
                        value={entry.tonnes}
                        onChange={(event) =>
                          setDrafts((current) => ({
                            ...current,
                            [line.line_id]: entries.map((item) =>
                              item.key === entry.key ? { ...item, tonnes: event.target.value } : item,
                            ),
                          }))
                        }
                        inputMode="decimal"
                        placeholder="Tonnellate"
                        className="h-10 rounded-lg border border-[#d9e0dd] bg-white px-3 text-xs"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setDrafts((current) => ({
                            ...current,
                            [line.line_id]: entries.filter((item) => item.key !== entry.key),
                          }))
                        }
                        className="px-2 text-xs font-semibold text-[#8b5148]"
                      >
                        Rimuovi
                      </button>
                      {quote ? (
                        <p className="sm:col-span-3 text-[10px] text-[#718078]">
                          {money(quote.normalized_eur_t, 2)}/t · offerta {number(offered)} t · totale allocazione {money((num(entry.tonnes) ?? 0) * (num(quote.normalized_eur_t) ?? 0))}
                        </p>
                      ) : null}
                    </div>
                  );
                })}
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setDrafts((current) => ({
                      ...current,
                      [line.line_id]: [
                        ...entries,
                        { key: freshKey(), supplierId: "", tonnes: String(Math.max(0, required - awarded)) },
                      ],
                    }))
                  }
                  className="text-xs font-bold text-[#1a5144] underline underline-offset-4"
                >
                  + Aggiungi allocazione / split
                </button>
                {candidates.map((candidate) =>
                  candidate.is_full_line_coverage ? (
                    <button
                      key={candidate.supplier_id}
                      type="button"
                      onClick={() => setSingle(line.line_id, candidate.supplier_id, required)}
                      className="text-[10px] text-[#718078] underline underline-offset-4"
                    >
                      tutto a {candidateLabel(candidate)}
                    </button>
                  ) : null,
                )}
              </div>
            </article>
          );
        })}
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl bg-white p-4">
          <p className="text-[10px] uppercase text-[#718078]">Award stimato</p>
          <p className="mt-1 text-xl font-semibold text-[#173f35]">{money(awardedTotal)}</p>
        </div>
        <div className="rounded-2xl bg-white p-4">
          <p className="text-[10px] uppercase text-[#718078]">Target</p>
          <p className="mt-1 text-xl font-semibold text-[#1d2824]">{money(targetTotal)}</p>
        </div>
        <div className="rounded-2xl bg-white p-4">
          <p className="text-[10px] uppercase text-[#718078]">Saving stimato</p>
          <p className={"mt-1 text-xl font-semibold " + (savings >= 0 ? "text-[#17634c]" : "text-[#9a4f45]")}>
            {money(savings)}
          </p>
        </div>
      </div>

      <label className="mt-4 block text-xs font-semibold text-[#52615b]">
        Motivazione decisione · obbligatoria
        <textarea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          rows={3}
          maxLength={2000}
          placeholder="Es. miglior combinazione prezzo/copertura/lead time…"
          className="mt-1.5 w-full rounded-xl border border-[#cfd8d4] bg-white px-3 py-2.5 text-sm"
        />
      </label>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={confirm}
          disabled={!canExecute || !canAward || pending || !fullyCovered || reason.trim().length < 3}
          className="inline-flex min-h-11 items-center rounded-xl bg-[#173f35] px-5 text-sm font-bold text-white disabled:opacity-50"
        >
          {pending ? "Conferma…" : "Conferma award e crea PO draft"}
        </button>
        <span className="text-xs font-semibold text-[#66736e]">
          {!canExecute
            ? "Solo l'owner può confermare definitivamente l'award."
            : fullyCovered
              ? "Copertura 100% pronta."
              : "Completa il 100% delle quantità."}
        </span>
        {feedback ? <span className="text-xs font-semibold text-[#66736e]">{feedback}</span> : null}
      </div>

      <p className="mt-4 text-[10px] leading-4 text-[#718078]">
        La conferma è intenzionale e auditata. Non invia automaticamente ordini, email di award o PO:
        crea bozze procurement congelate e chiude le trattative non selezionate.
      </p>
    </section>
  );
}
