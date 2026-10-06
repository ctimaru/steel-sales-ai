"use client";

import { useMemo, useState } from "react";

type Numeric = number | string | null;

export type RfqComparisonSupplier = {
  supplier_id: string;
  supplier_name: string | null;
  supplier_email: string | null;
  quote_id: string;
  revision_no: number;
  quote_status: string;
  latest_quote_status: string;
  latest_revision_no: number;
  revision_in_progress: boolean;
  submitted_at: string | null;
  incoterm: string | null;
  payment_terms: string | null;
  validity_until: string | null;
  lead_time_days: number | null;
  effective_lead_time_days: number | null;
  delivery_date: string | null;
  moq_tonnes: Numeric;
  attachment_name: string | null;
  quoted_lines: number;
  unavailable_lines: number;
  total_lines: number;
  line_coverage_pct: Numeric;
  quoted_tonnes: Numeric;
  total_tonnes: Numeric;
  tonne_coverage_pct: Numeric;
  comparable_offer_eur: Numeric;
  comparable_target_eur: Numeric;
  weighted_eur_t: Numeric;
  comparable_delta_eur: Numeric;
  comparable_delta_pct: Numeric;
  full_request_total_eur: Numeric;
  full_delta_eur: Numeric;
  full_delta_pct: Numeric;
  full_price_rank: number | null;
  coverage_rank: number;
  lead_time_rank: number | null;
  is_best_full_price: boolean;
  is_best_coverage: boolean;
  is_best_lead_time: boolean;
};

export type RfqComparisonLineQuote = {
  supplier_id: string;
  supplier_name: string | null;
  quote_id: string;
  revision_no: number;
  revision_in_progress: boolean;
  response_status: "quoted" | "not_available";
  normalized_eur_t: Numeric;
  normalized_eur_m: Numeric;
  line_offer_total_eur: Numeric;
  delta_eur_t: Numeric;
  delta_pct: Numeric;
  offered_quantity: Numeric;
  offered_quantity_mode: string | null;
  moq_tonnes: Numeric;
  lead_time_days: number | null;
  delivery_date: string | null;
  line_price_rank: number | null;
  is_best_price: boolean;
};

export type RfqComparisonLine = {
  line_id: string;
  position: number;
  description: string;
  standard: string | null;
  grade: string | null;
  finish: string | null;
  quantity_mode: string;
  quantity: Numeric;
  weight_kg_m: Numeric;
  line_meters: Numeric;
  line_tonnes: Numeric;
  target_eur_t: Numeric;
  target_eur_m: Numeric;
  target_total_eur: Numeric;
  quoted_supplier_count: number;
  quotes: RfqComparisonLineQuote[];
};

export type RfqComparisonData = {
  rfq_id: string;
  target: {
    total_eur: Numeric;
    total_tonnes: Numeric;
    weighted_eur_t: Numeric;
  };
  summary: {
    supplier_count: number;
    comparable_supplier_count: number;
    declined_supplier_count: number;
    complete_offer_count: number;
  };
  split_benchmark: {
    covered_lines: number;
    total_lines: number;
    coverage_pct: Numeric;
    total_eur: Numeric;
    delta_eur: Numeric;
    delta_pct: Numeric;
  };
  suppliers: RfqComparisonSupplier[];
  lines: RfqComparisonLine[];
};

type SortMode = "coverage" | "total" | "delta" | "lead";

function num(value: Numeric) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function money(value: Numeric, digits = 0) {
  const parsed = num(value);
  if (parsed === null) return "—";
  return "€ " + parsed.toLocaleString("it-IT", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function number(value: Numeric, digits = 1) {
  const parsed = num(value);
  if (parsed === null) return "—";
  return parsed.toLocaleString("it-IT", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  });
}

function percent(value: Numeric, digits = 1) {
  const parsed = num(value);
  if (parsed === null) return "—";
  const sign = parsed > 0 ? "+" : "";
  return sign + parsed.toLocaleString("it-IT", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  }) + "%";
}

function deltaClass(value: Numeric) {
  const parsed = num(value);
  if (parsed === null) return "text-[#718078]";
  if (parsed < 0) return "text-[#1a654f]";
  if (parsed > 0) return "text-[#9a4f45]";
  return "text-[#52615b]";
}

function supplierLabel(supplier: RfqComparisonSupplier) {
  return supplier.supplier_name || supplier.supplier_email || "Fornitore";
}

export function RfqQuoteComparison({
  comparison,
}: {
  comparison: RfqComparisonData | null;
}) {
  const [sortMode, setSortMode] = useState<SortMode>("coverage");
  const [completeOnly, setCompleteOnly] = useState(false);

  const suppliers = comparison?.suppliers ?? [];
  const lines = comparison?.lines ?? [];

  const visibleSuppliers = useMemo(() => {
    const rows = suppliers.filter(
      (supplier) => !completeOnly || num(supplier.line_coverage_pct) === 100,
    );

    return [...rows].sort((a, b) => {
      if (sortMode === "total") {
        const av = num(a.full_request_total_eur);
        const bv = num(b.full_request_total_eur);
        if (av === null && bv === null) return supplierLabel(a).localeCompare(supplierLabel(b));
        if (av === null) return 1;
        if (bv === null) return -1;
        return av - bv;
      }

      if (sortMode === "delta") {
        const av = num(a.full_delta_pct);
        const bv = num(b.full_delta_pct);
        if (av === null && bv === null) return supplierLabel(a).localeCompare(supplierLabel(b));
        if (av === null) return 1;
        if (bv === null) return -1;
        return av - bv;
      }

      if (sortMode === "lead") {
        const av = a.effective_lead_time_days;
        const bv = b.effective_lead_time_days;
        if (av === null && bv === null) return supplierLabel(a).localeCompare(supplierLabel(b));
        if (av === null) return 1;
        if (bv === null) return -1;
        return av - bv;
      }

      const coverageDiff =
        (num(b.tonne_coverage_pct) ?? 0) - (num(a.tonne_coverage_pct) ?? 0);
      if (coverageDiff !== 0) return coverageDiff;
      const av = num(a.full_request_total_eur);
      const bv = num(b.full_request_total_eur);
      if (av !== null && bv !== null) return av - bv;
      if (av !== null) return -1;
      if (bv !== null) return 1;
      return supplierLabel(a).localeCompare(supplierLabel(b));
    });
  }, [completeOnly, sortMode, suppliers]);

  if (!comparison || suppliers.length === 0) {
    return (
      <section className="rounded-2xl border border-[#dce2df] bg-white p-5">
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#1a5144]">
          RFQH5 · Quote Comparison
        </p>
        <h2 className="mt-1 text-lg font-semibold text-[#1d2824]">
          In attesa di offerte confrontabili
        </h2>
        <p className="mt-2 text-sm leading-6 text-[#66736e]">
          Quando almeno un fornitore invia un&apos;offerta, qui compariranno copertura,
          prezzi normalizzati, delta dal target, tempi e benchmark split.
        </p>
      </section>
    );
  }

  const bestFull = suppliers.find((supplier) => supplier.is_best_full_price);
  const splitTotal = num(comparison.split_benchmark.total_eur);
  const bestFullTotal = num(bestFull?.full_request_total_eur ?? null);
  const splitVsSingle =
    splitTotal !== null && bestFullTotal !== null
      ? splitTotal - bestFullTotal
      : null;

  return (
    <section className="overflow-hidden rounded-3xl border border-[#cddbd6] bg-white">
      <div className="border-b border-[#e5ebe8] bg-[#f8faf9] px-5 py-5 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#1a5144]">
              RFQH5 · Quote Normalization & Comparison
            </p>
            <h2 className="mt-1 text-xl font-semibold text-[#1d2824]">
              Confronto offerte
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#66736e]">
              Tutti i prezzi sono normalizzati su €/t e €/m. Le evidenze qui sotto
              applicano regole dichiarate e non assegnano automaticamente l&apos;ordine.
            </p>
          </div>
          <span className="rounded-full bg-[#edf5f2] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-[#173f35]">
            {comparison.summary.comparable_supplier_count} offerte confrontabili
          </span>
        </div>

        <div className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-[#dce2df] bg-white p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#718078]">
              Target buyer
            </p>
            <p className="mt-1 text-xl font-semibold text-[#1d2824]">
              {money(comparison.target.total_eur)}
            </p>
            <p className="mt-1 text-xs text-[#718078]">
              {money(comparison.target.weighted_eur_t, 2)}/t medio ponderato
            </p>
          </div>

          <div className="rounded-2xl border border-[#dce2df] bg-white p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#718078]">
              Migliore offerta completa
            </p>
            <p className="mt-1 text-xl font-semibold text-[#173f35]">
              {bestFull ? money(bestFull.full_request_total_eur) : "—"}
            </p>
            <p className="mt-1 truncate text-xs text-[#718078]">
              {bestFull ? supplierLabel(bestFull) : "Nessuna copertura 100%"}
            </p>
          </div>

          <div className="rounded-2xl border border-[#dce2df] bg-white p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#718078]">
              Benchmark split
            </p>
            <p className="mt-1 text-xl font-semibold text-[#173f35]">
              {money(comparison.split_benchmark.total_eur)}
            </p>
            <p className="mt-1 text-xs text-[#718078]">
              {number(comparison.split_benchmark.coverage_pct, 0)}% righe coperte
              {splitVsSingle !== null
                ? " · " + money(splitVsSingle) + " vs best single"
                : ""}
            </p>
          </div>

          <div className="rounded-2xl border border-[#dce2df] bg-white p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#718078]">
              Copertura completa
            </p>
            <p className="mt-1 text-xl font-semibold text-[#1d2824]">
              {comparison.summary.complete_offer_count}
            </p>
            <p className="mt-1 text-xs text-[#718078]">
              su {comparison.summary.comparable_supplier_count} offerte ·{" "}
              {comparison.summary.declined_supplier_count} rifiuti
            </p>
          </div>
        </div>
      </div>

      <div className="border-b border-[#e5ebe8] px-5 py-4 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-wrap gap-3">
            <label className="text-xs font-semibold text-[#52615b]">
              Ordina per
              <select
                value={sortMode}
                onChange={(event) => setSortMode(event.target.value as SortMode)}
                className="ml-2 h-9 rounded-xl border border-[#cfd8d4] bg-white px-3 text-xs text-[#1d2824]"
              >
                <option value="coverage">Copertura</option>
                <option value="total">Totale completo</option>
                <option value="delta">Delta target</option>
                <option value="lead">Lead time</option>
              </select>
            </label>
            <label className="inline-flex min-h-9 items-center gap-2 rounded-xl border border-[#dce2df] bg-[#f8faf9] px-3 text-xs font-semibold text-[#52615b]">
              <input
                type="checkbox"
                checked={completeOnly}
                onChange={(event) => setCompleteOnly(event.target.checked)}
              />
              Solo offerte 100%
            </label>
          </div>
          <p className="text-[10px] leading-4 text-[#718078]">
            Prezzo: solo offerte complete · Copertura: % tonnellate · Lead time: max tra le righe quotate.
          </p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-[1040px] w-full border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-[#dce2df] bg-[#fbfcfb] text-[#66736e]">
              <th className="px-4 py-3">Fornitore</th>
              <th className="px-4 py-3 text-right">Copertura</th>
              <th className="px-4 py-3 text-right">Totale richiesta</th>
              <th className="px-4 py-3 text-right">Delta target</th>
              <th className="px-4 py-3 text-right">€/t medio</th>
              <th className="px-4 py-3 text-right">Lead time</th>
              <th className="px-4 py-3">Condizioni</th>
            </tr>
          </thead>
          <tbody>
            {visibleSuppliers.map((supplier) => (
              <tr key={supplier.supplier_id} className="border-b border-[#edf0ee] align-top">
                <td className="px-4 py-4">
                  <p className="font-semibold text-[#1d2824]">{supplierLabel(supplier)}</p>
                  <p className="mt-1 text-[10px] text-[#718078]">
                    rev. {supplier.revision_no}
                    {supplier.revision_in_progress ? " · nuova revisione in corso" : ""}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {supplier.is_best_full_price ? (
                      <span className="rounded-full bg-[#e9f5ef] px-2 py-0.5 text-[9px] font-bold text-[#14543f]">
                        Miglior totale completo
                      </span>
                    ) : null}
                    {supplier.is_best_coverage ? (
                      <span className="rounded-full bg-[#edf5f2] px-2 py-0.5 text-[9px] font-bold text-[#173f35]">
                        Miglior copertura
                      </span>
                    ) : null}
                    {supplier.is_best_lead_time ? (
                      <span className="rounded-full bg-[#f3f1ea] px-2 py-0.5 text-[9px] font-bold text-[#6d5d2f]">
                        Lead più breve
                      </span>
                    ) : null}
                  </div>
                </td>
                <td className="px-4 py-4 text-right">
                  <p className="font-semibold text-[#1d2824]">
                    {number(supplier.tonne_coverage_pct, 0)}%
                  </p>
                  <p className="mt-1 text-[10px] text-[#718078]">
                    {supplier.quoted_lines}/{supplier.total_lines} righe ·{" "}
                    {number(supplier.quoted_tonnes, 3)}/{number(supplier.total_tonnes, 3)} t
                  </p>
                </td>
                <td className="px-4 py-4 text-right">
                  <p className="font-semibold text-[#173f35]">
                    {supplier.full_request_total_eur !== null
                      ? money(supplier.full_request_total_eur)
                      : "Parziale"}
                  </p>
                  {supplier.full_request_total_eur === null ? (
                    <p className="mt-1 text-[10px] text-[#718078]">
                      {money(supplier.comparable_offer_eur)} sulle righe coperte
                    </p>
                  ) : null}
                </td>
                <td className={"px-4 py-4 text-right font-semibold " + deltaClass(
                  supplier.full_request_total_eur !== null
                    ? supplier.full_delta_pct
                    : supplier.comparable_delta_pct,
                )}>
                  {percent(
                    supplier.full_request_total_eur !== null
                      ? supplier.full_delta_pct
                      : supplier.comparable_delta_pct,
                  )}
                  <p className="mt-1 text-[10px] font-normal">
                    {money(
                      supplier.full_request_total_eur !== null
                        ? supplier.full_delta_eur
                        : supplier.comparable_delta_eur,
                    )}
                  </p>
                </td>
                <td className="px-4 py-4 text-right font-semibold text-[#1d2824]">
                  {money(supplier.weighted_eur_t, 2)}
                </td>
                <td className="px-4 py-4 text-right font-semibold text-[#1d2824]">
                  {supplier.effective_lead_time_days === null
                    ? "—"
                    : supplier.effective_lead_time_days + " gg"}
                </td>
                <td className="px-4 py-4 text-[#52615b]">
                  <p>{supplier.incoterm || "—"}</p>
                  <p className="mt-1 text-[10px] text-[#718078]">
                    {supplier.payment_terms || "Pagamento non indicato"}
                  </p>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="border-t border-[#e5ebe8] px-5 py-5 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#1a5144]">
              Matrice per riga
            </p>
            <p className="mt-1 text-sm text-[#66736e]">
              Il badge “miglior prezzo” confronta esclusivamente la stessa riga e non equivale a una decisione di award.
            </p>
          </div>
          <span className="text-xs text-[#718078]">
            Target interno buyer sempre visibile solo qui.
          </span>
        </div>

        <div className="mt-4 space-y-3">
          {lines.map((line) => (
            <article key={line.line_id} className="rounded-2xl border border-[#dce2df] bg-[#fbfcfb] p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#1a5144]">
                    Riga {line.position}
                  </p>
                  <p className="mt-1 font-semibold text-[#1d2824]">{line.description}</p>
                  <p className="mt-1 text-xs text-[#718078]">
                    {[line.standard, line.grade, line.finish].filter(Boolean).join(" · ")}
                    {" · "}{number(line.line_tonnes, 3)} t
                  </p>
                </div>
                <div className="rounded-xl bg-white px-3 py-2 text-right">
                  <p className="text-[9px] uppercase text-[#718078]">Target</p>
                  <p className="mt-1 text-sm font-semibold text-[#173f35]">
                    {money(line.target_eur_t, 2)}/t
                  </p>
                  <p className="text-[10px] text-[#718078]">
                    {money(line.target_eur_m, 4)}/m
                  </p>
                </div>
              </div>

              <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                {line.quotes.map((quote) => (
                  <div
                    key={quote.supplier_id}
                    className="rounded-xl border border-[#dce2df] bg-white p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-xs font-semibold text-[#1d2824]">
                          {quote.supplier_name || "Fornitore"}
                        </p>
                        {quote.revision_in_progress ? (
                          <p className="mt-0.5 text-[9px] text-[#8a6d2f]">
                            Revisione successiva in corso
                          </p>
                        ) : null}
                      </div>
                      {quote.is_best_price ? (
                        <span className="rounded-full bg-[#e9f5ef] px-2 py-0.5 text-[9px] font-bold text-[#14543f]">
                          Miglior prezzo
                        </span>
                      ) : null}
                    </div>

                    {quote.response_status === "quoted" ? (
                      <div className="mt-3 grid grid-cols-3 gap-2">
                        <div>
                          <p className="text-[9px] uppercase text-[#718078]">€/t</p>
                          <p className="mt-0.5 text-sm font-semibold text-[#173f35]">
                            {money(quote.normalized_eur_t, 2)}
                          </p>
                        </div>
                        <div>
                          <p className="text-[9px] uppercase text-[#718078]">€/m</p>
                          <p className="mt-0.5 text-sm font-semibold text-[#173f35]">
                            {money(quote.normalized_eur_m, 4)}
                          </p>
                        </div>
                        <div>
                          <p className="text-[9px] uppercase text-[#718078]">vs target</p>
                          <p className={"mt-0.5 text-sm font-semibold " + deltaClass(quote.delta_pct)}>
                            {percent(quote.delta_pct)}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <p className="mt-3 text-xs font-semibold text-[#8b5148]">
                        Non disponibile
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>

        <div className="mt-4 rounded-xl border border-[#dce2df] bg-[#f8faf9] px-4 py-3 text-xs leading-5 text-[#66736e]">
          <strong className="text-[#1d2824]">Regole del confronto:</strong>{" "}
          il totale fornitore viene classificato solo con copertura 100%; le offerte parziali
          mostrano solo valori sulle righe effettivamente quotate. Il benchmark split somma il
          miglior prezzo disponibile per ciascuna riga ed è un riferimento analitico, non un award.
        </div>
      </div>
    </section>
  );
}
