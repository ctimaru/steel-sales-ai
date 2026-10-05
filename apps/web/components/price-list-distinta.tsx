"use client";

import type { PriceListExplorerItem } from "@/lib/public-price-lists";
import {
  calculateDistintaLine,
  calculateDistintaTotals,
  distintaIssueLabel,
  weightedAverageStatusLabel,
  type DistintaQuantityMode,
} from "@/lib/distinta";

export type DistintaDraftLine = {
  item: PriceListExplorerItem;
  quantityMode: DistintaQuantityMode;
  quantityInput: string;
  barLengthInput: string;
  appliedDiscountPct: number | null;
  netEurM: number | null;
  netEurT: number | null;
  pricingIssue?: string | null;
};

function numberFromInput(value: string) {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function numberValue(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatNumber(value: number | null, digits: number) {
  if (value === null || !Number.isFinite(value)) return "—";
  return value.toLocaleString("it-IT", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function PriceListDistinta({
  lines,
  onQuantityModeChange,
  onQuantityChange,
  onBarLengthChange,
  onRemove,
  onClear,
  onClose,
  mobile = false,
}: {
  lines: DistintaDraftLine[];
  onQuantityModeChange: (itemId: string, mode: DistintaQuantityMode) => void;
  onQuantityChange: (itemId: string, value: string) => void;
  onBarLengthChange: (itemId: string, value: string) => void;
  onRemove: (itemId: string) => void;
  onClear: () => void;
  onClose?: () => void;
  mobile?: boolean;
}) {
  const calculatedLines = lines.map((line) => {
    const weightKgM = numberValue(line.item.resolved_weight_kg_m);
    const calculation = calculateDistintaLine({
      quantityMode: line.quantityMode,
      quantity: numberFromInput(line.quantityInput),
      barLengthM: numberFromInput(line.barLengthInput),
      weightKgM,
      netEurM: line.netEurM,
    });

    return {
      line,
      weightKgM,
      calculation,
      issue: distintaIssueLabel(calculation.issue),
    };
  });

  const totals = calculateDistintaTotals(
    calculatedLines.map(({ calculation }) => calculation),
  );
  const weightedAverageMessage = weightedAverageStatusLabel(
    totals.weightedAverageStatus,
    totals.lineCount,
    totals.weightedReadyLineCount,
  );

  return (
    <section
      className={[
        "overflow-hidden bg-white",
        mobile
          ? "max-h-[82vh] rounded-t-3xl border-x border-t border-[#d7dfdb] shadow-2xl"
          : "rounded-2xl border border-[#d7dfdb] shadow-[0_10px_35px_rgba(20,46,38,0.08)]",
      ].join(" ")}
      aria-label="Distinta articoli"
    >
      <header className="flex items-start justify-between gap-3 border-b border-[#e4e9e6] bg-[#f7f9f8] px-4 py-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#1a5144]">
            Distinta
          </p>
          <h2 className="mt-1 text-base font-semibold text-[#1d2824]">
            {lines.length === 0
              ? "Seleziona gli articoli"
              : lines.length + (lines.length === 1 ? " riga selezionata" : " righe selezionate")}
          </h2>
          <p className="mt-1 text-xs leading-5 text-[#718078]">
            Inserisci metri, barre oppure tonnellate. I prezzi seguono lo sconto attivo nel listino.
          </p>
        </div>
        <div className="flex items-center gap-1">
          {lines.length > 0 ? (
            <button
              type="button"
              onClick={onClear}
              className="rounded-lg px-2.5 py-2 text-xs font-semibold text-[#7a5149] hover:bg-rose-50"
            >
              Svuota
            </button>
          ) : null}
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-2.5 py-2 text-sm font-semibold text-[#52615b] hover:bg-[#edf1ef]"
              aria-label="Chiudi distinta"
            >
              ✕
            </button>
          ) : null}
        </div>
      </header>

      {lines.length === 0 ? (
        <div className="px-4 py-8 text-center">
          <p className="text-sm font-semibold text-[#43524c]">
            La distinta è vuota.
          </p>
          <p className="mx-auto mt-1 max-w-[260px] text-xs leading-5 text-[#7a8781]">
            Usa il pulsante “+ Distinta” accanto a una misura per iniziare il calcolo.
          </p>
        </div>
      ) : (
        <div className={mobile ? "max-h-[62vh] overflow-y-auto" : "max-h-[70vh] overflow-y-auto"}>
          <div className="divide-y divide-[#edf0ee]">
            {calculatedLines.map(({ line, weightKgM, calculation, issue }, index) => {
              return (
                <article key={line.item.item_id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-[#82908a]">
                        Riga {index + 1}
                      </p>
                      <h3 className="mt-1 truncate text-sm font-semibold text-[#1d2824]">
                        {line.item.dimension_label}
                      </h3>
                      <p className="mt-0.5 truncate text-[11px] text-[#718078]">
                        {[line.item.grade_code || line.item.grade_raw, line.item.finish_raw]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onRemove(line.item.item_id)}
                      className="shrink-0 rounded-lg px-2 py-1.5 text-xs font-semibold text-[#7a5149] hover:bg-rose-50"
                    >
                      Rimuovi
                    </button>
                  </div>

                  <div className="mt-3 grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2">
                    <label className="text-[10px] font-semibold uppercase tracking-wide text-[#66736e]">
                      Quantità
                      <input
                        inputMode="decimal"
                        value={line.quantityInput}
                        onChange={(event) =>
                          onQuantityChange(line.item.item_id, event.target.value)
                        }
                        placeholder={
                          line.quantityMode === "meters"
                            ? "metri"
                            : line.quantityMode === "bars"
                              ? "barre"
                              : "tonnellate"
                        }
                        className="mt-1 h-9 w-full rounded-lg border border-[#d7dfdb] bg-white px-2.5 text-sm font-semibold text-[#1d2824] outline-none focus:border-[#438d7a]"
                      />
                    </label>

                    <label className="text-[10px] font-semibold uppercase tracking-wide text-[#66736e]">
                      Unità
                      <select
                        value={line.quantityMode}
                        onChange={(event) =>
                          onQuantityModeChange(
                            line.item.item_id,
                            event.target.value as DistintaQuantityMode,
                          )
                        }
                        className="mt-1 h-9 w-full rounded-lg border border-[#d7dfdb] bg-white px-2 text-sm text-[#1d2824] outline-none focus:border-[#438d7a]"
                      >
                        <option value="meters">Metri</option>
                        <option value="bars">Barre / pezzi</option>
                        <option value="tonnes" disabled={!line.item.price_per_t_ready || !weightKgM}>
                          Tonnellate
                        </option>
                      </select>
                    </label>
                  </div>

                  {line.quantityMode === "bars" ? (
                    <label className="mt-2 block text-[10px] font-semibold uppercase tracking-wide text-[#66736e]">
                      Lunghezza barra
                      <div className="mt-1 grid grid-cols-[1fr_auto_auto] gap-1.5">
                        <div className="flex h-9 items-center overflow-hidden rounded-lg border border-[#d7dfdb] bg-white">
                          <input
                            inputMode="decimal"
                            value={line.barLengthInput}
                            onChange={(event) =>
                              onBarLengthChange(line.item.item_id, event.target.value)
                            }
                            className="h-full min-w-0 flex-1 px-2.5 text-sm font-semibold text-[#1d2824] outline-none"
                          />
                          <span className="pr-2.5 text-xs text-[#718078]">m</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => onBarLengthChange(line.item.item_id, "6")}
                          className="rounded-lg border border-[#d7dfdb] px-2.5 text-xs font-semibold text-[#52615b] hover:bg-[#f4f7f5]"
                        >
                          6 m
                        </button>
                        <button
                          type="button"
                          onClick={() => onBarLengthChange(line.item.item_id, "12")}
                          className="rounded-lg border border-[#d7dfdb] px-2.5 text-xs font-semibold text-[#52615b] hover:bg-[#f4f7f5]"
                        >
                          12 m
                        </button>
                      </div>
                    </label>
                  ) : null}

                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-lg bg-[#f7f9f8] p-2.5">
                      <p className="text-[10px] text-[#7a8781]">Metri</p>
                      <p className="mt-0.5 font-semibold tabular-nums text-[#1d2824]">
                        {formatNumber(calculation.meters, 2)}
                      </p>
                    </div>
                    <div className="rounded-lg bg-[#f7f9f8] p-2.5">
                      <p className="text-[10px] text-[#7a8781]">Tonnellate</p>
                      <p className="mt-0.5 font-semibold tabular-nums text-[#1d2824]">
                        {formatNumber(calculation.tonnes, 3)}
                      </p>
                    </div>
                    <div className="rounded-lg bg-[#edf5f2] p-2.5">
                      <p className="text-[10px] text-[#527268]">Netto €/m</p>
                      <p className="mt-0.5 font-bold tabular-nums text-[#173f35]">
                        {formatNumber(line.netEurM, 4)}
                      </p>
                    </div>
                    <div className="rounded-lg bg-[#edf5f2] p-2.5">
                      <p className="text-[10px] text-[#527268]">Totale riga</p>
                      <p className="mt-0.5 font-bold tabular-nums text-[#173f35]">
                        {calculation.lineTotalEur === null
                          ? "—"
                          : "€ " + formatNumber(calculation.lineTotalEur, 2)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[10px] text-[#7a8781]">
                    <span>
                      Sconto {formatNumber(line.appliedDiscountPct, 2)}%
                      {weightKgM ? " · " + formatNumber(weightKgM, 3) + " kg/m" : ""}
                    </span>
                    {line.netEurT !== null ? (
                      <span className="font-semibold text-[#52615b]">
                        {formatNumber(line.netEurT, 2)} €/t
                      </span>
                    ) : null}
                  </div>

                  {issue ? (
                    <p className="mt-2 rounded-lg bg-amber-50 px-2.5 py-2 text-[10px] font-medium leading-4 text-amber-900">
                      {issue}
                    </p>
                  ) : null}
                </article>
              );
            })}
          </div>
        </div>
      )}

      {lines.length > 0 ? (
        <footer className="border-t border-[#d9e3de] bg-[#f6faf8] p-4">
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-[#dfe8e4] bg-white p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[#718078]">
                Metri {totals.metersComplete ? "totali" : "calcolati"}
              </p>
              <p className="mt-1 text-base font-bold tabular-nums text-[#1d2824]">
                {formatNumber(totals.totalMeters, 2)}
              </p>
            </div>
            <div className="rounded-xl border border-[#dfe8e4] bg-white p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[#718078]">
                Tonnellate {totals.tonnesComplete ? "totali" : "note"}
              </p>
              <p className="mt-1 text-base font-bold tabular-nums text-[#1d2824]">
                {formatNumber(totals.totalTonnes, 3)}
              </p>
            </div>
            <div className="rounded-xl border border-[#cfe0d9] bg-white p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[#527268]">
                {totals.valueComplete ? "Valore totale" : "Valore calcolato"}
              </p>
              <p className="mt-1 text-base font-bold tabular-nums text-[#173f35]">
                € {formatNumber(totals.totalValueEur, 2)}
              </p>
            </div>
            <div
              className={[
                "rounded-xl border p-3",
                totals.weightedAverageStatus === "ready"
                  ? "border-[#9ebfb3] bg-[#eaf4f0]"
                  : "border-[#dfe5e2] bg-[#f0f3f1]",
              ].join(" ")}
            >
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[#527268]">
                €/t medio ponderato
              </p>
              <p className="mt-1 text-base font-bold tabular-nums text-[#173f35]">
                {totals.weightedAverageEurT === null
                  ? "—"
                  : formatNumber(totals.weightedAverageEurT, 2)}
              </p>
            </div>
          </div>

          <p
            className={[
              "mt-2 text-[10px] leading-4",
              totals.weightedAverageStatus === "ready"
                ? "text-[#527268]"
                : "text-[#7a6a55]",
            ].join(" ")}
          >
            {weightedAverageMessage}
          </p>

          {!totals.valueComplete ? (
            <p className="mt-1 text-[10px] leading-4 text-[#7a8781]">
              Il valore mostrato include soltanto le righe con quantità e prezzo calcolabili.
            </p>
          ) : null}

          {!totals.tonnesComplete ? (
            <p className="mt-1 text-[10px] leading-4 text-[#7a8781]">
              Le tonnellate mostrate includono soltanto le righe con kg/m disponibile.
            </p>
          ) : null}
        </footer>
      ) : null}
    </section>
  );
}
