
"use client";

import { useMemo, useState } from "react";

import type {
  PriceListCatalogEntry,
  PriceListExplorerItem,
} from "@/lib/public-price-lists";

const PAGE_SIZE = 75;

function toNumber(value: number | string | null | undefined) {
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

function shapeLabel(value: string) {
  if (value === "circular") return "Tondi";
  if (value === "square") return "Quadri";
  if (value === "rectangular") return "Rettangolari";
  if (value === "other") return "Profili speciali";
  return value;
}

function finishLabel(value: string | null) {
  if (!value) return "Non indicata";
  if (value === "self_color") return "Neri";
  if (value === "pickled_oiled") return "Decapati";
  if (value === "sendzimir") return "Zincati Sendzimir";
  return value.replaceAll("_", " ");
}

function readinessLabel(status: string) {
  if (status === "unresolved_standard") return "Norma non risolta";
  if (status === "unsupported_special_shape") return "Profilo speciale";
  if (status === "no_compatible_weight_reference") return "Peso non disponibile";
  if (status === "pending_weight_resolution") return "Peso in verifica";
  return "Peso non disponibile";
}

function netPricePerMeter(
  row: PriceListExplorerItem,
  discountPct: number,
  formula: string | null,
) {
  const base = toNumber(row.base_eur_m);
  const extra = toNumber(row.fixed_extra_eur_m);
  if (base === null || extra === null || !row.price_per_m_ready) return null;
  if (formula !== "discounted_base_plus_fixed_extra") return null;
  return base * (1 - discountPct / 100) + extra;
}

function netPricePerTonne(
  row: PriceListExplorerItem,
  netEurM: number | null,
) {
  const weight = toNumber(row.resolved_weight_kg_m);
  if (!row.price_per_t_ready || weight === null || weight <= 0 || netEurM === null) {
    return null;
  }
  return (netEurM / weight) * 1000;
}

export function PublicPriceListExplorer({
  version,
  items,
}: {
  version: PriceListCatalogEntry;
  items: PriceListExplorerItem[];
}) {
  const [query, setQuery] = useState("");
  const [shape, setShape] = useState("all");
  const [grade, setGrade] = useState("all");
  const [finish, setFinish] = useState("all");
  const [discountInput, setDiscountInput] = useState("0");
  const [page, setPage] = useState(1);

  const discountPct = Math.min(
    100,
    Math.max(0, Number(discountInput.replace(",", ".")) || 0),
  );

  const shapeOptions = useMemo(
    () => [...new Set(items.map((row) => row.shape_code).filter(Boolean))].sort(),
    [items],
  );
  const gradeOptions = useMemo(
    () =>
      [...new Set(items.map((row) => row.grade_code).filter((value): value is string => Boolean(value)))].sort(),
    [items],
  );
  const finishOptions = useMemo(
    () =>
      [...new Set(items.map((row) => row.finish_code).filter((value): value is string => Boolean(value)))].sort(),
    [items],
  );

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("it");
    return items.filter((row) => {
      if (shape !== "all" && row.shape_code !== shape) return false;
      if (grade !== "all" && row.grade_code !== grade) return false;
      if (finish !== "all" && row.finish_code !== finish) return false;
      if (!normalizedQuery) return true;

      return [
        row.dimension_label,
        row.standard_code,
        row.standard_raw,
        row.grade_code,
        row.grade_raw,
        row.finish_raw,
        row.note_raw,
      ]
        .filter(Boolean)
        .some((value) =>
          String(value).toLocaleLowerCase("it").includes(normalizedQuery),
        );
    });
  }, [finish, grade, items, query, shape]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const visibleRows = filtered.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  );
  const readyCount = filtered.filter((row) => row.price_per_t_ready).length;

  function resetPage() {
    setPage(1);
  }

  return (
    <div className="space-y-4">
      <section className="sticky top-0 z-20 rounded-2xl border border-[#d4dfda] bg-white/95 p-4 shadow-[0_8px_30px_rgba(20,46,38,0.08)] backdrop-blur-xl">
        <div className="grid gap-4 xl:grid-cols-[1fr_auto] xl:items-end">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="text-xs font-semibold text-[#43524c]">
              Cerca misura
              <input
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  resetPage();
                }}
                placeholder="es. 80x80x3 o Ø 33,7"
                className="mt-1.5 h-10 w-full rounded-xl border border-[#d7dfdb] bg-white px-3 text-sm text-[#1d2824] outline-none transition focus:border-[#438d7a] focus:ring-2 focus:ring-[#d9e8e2]"
              />
            </label>

            <label className="text-xs font-semibold text-[#43524c]">
              Forma
              <select
                value={shape}
                onChange={(event) => {
                  setShape(event.target.value);
                  resetPage();
                }}
                className="mt-1.5 h-10 w-full rounded-xl border border-[#d7dfdb] bg-white px-3 text-sm text-[#1d2824] outline-none focus:border-[#438d7a]"
              >
                <option value="all">Tutte</option>
                {shapeOptions.map((value) => (
                  <option key={value} value={value}>
                    {shapeLabel(value)}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-xs font-semibold text-[#43524c]">
              Grado
              <select
                value={grade}
                onChange={(event) => {
                  setGrade(event.target.value);
                  resetPage();
                }}
                className="mt-1.5 h-10 w-full rounded-xl border border-[#d7dfdb] bg-white px-3 text-sm text-[#1d2824] outline-none focus:border-[#438d7a]"
              >
                <option value="all">Tutti</option>
                {gradeOptions.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-xs font-semibold text-[#43524c]">
              Finitura
              <select
                value={finish}
                onChange={(event) => {
                  setFinish(event.target.value);
                  resetPage();
                }}
                className="mt-1.5 h-10 w-full rounded-xl border border-[#d7dfdb] bg-white px-3 text-sm text-[#1d2824] outline-none focus:border-[#438d7a]"
              >
                <option value="all">Tutte</option>
                {finishOptions.map((value) => (
                  <option key={value} value={value}>
                    {finishLabel(value)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="block min-w-[190px] text-xs font-semibold text-[#173f35]">
            Sconto commerciale %
            <div className="mt-1.5 flex h-10 items-center overflow-hidden rounded-xl border border-[#9ebfb3] bg-[#edf5f2]">
              <input
                inputMode="decimal"
                value={discountInput}
                onChange={(event) => setDiscountInput(event.target.value)}
                className="h-full min-w-0 flex-1 bg-transparent px-3 text-right text-sm font-bold text-[#173f35] outline-none"
                aria-label="Sconto commerciale percentuale"
              />
              <span className="pr-3 text-sm font-bold text-[#173f35]">%</span>
            </div>
          </label>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[#e7ece9] pt-3 text-xs text-[#66736e]">
          <p>
            <strong className="text-[#1d2824]">{filtered.length}</strong> articoli ·{" "}
            <strong className="text-[#1d2824]">{readyCount}</strong> con €/t disponibile
          </p>
          <p>Sconto temporaneo · non viene salvato</p>
        </div>
      </section>

      {version.pricing_formula !== "discounted_base_plus_fixed_extra" ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          La formula commerciale di questa versione non è ancora supportata dal calcolo pubblico.
          Base ed Extra restano consultabili.
        </div>
      ) : null}

      <div className="hidden overflow-hidden rounded-2xl border border-[#dce2df] bg-white lg:block">
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-left text-sm">
            <thead className="bg-[#f6f8f7] text-[11px] font-bold uppercase tracking-[0.08em] text-[#66736e]">
              <tr>
                <th className="px-4 py-3">Articolo</th>
                <th className="px-3 py-3">Sp.</th>
                <th className="px-3 py-3">kg/m</th>
                <th className="px-3 py-3">Base €/m</th>
                <th className="px-3 py-3">Extra €/m</th>
                <th className="px-3 py-3">Netto €/m</th>
                <th className="px-4 py-3">Netto €/t</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#edf0ee]">
              {visibleRows.map((row) => {
                const netM = netPricePerMeter(row, discountPct, version.pricing_formula);
                const netT = netPricePerTonne(row, netM);
                return (
                  <tr key={row.item_id} className="align-top hover:bg-[#fafcfb]">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-[#1d2824]">{row.dimension_label}</p>
                      <p className="mt-1 text-[11px] text-[#7a8781]">
                        {[row.grade_code || row.grade_raw, row.finish_code ? finishLabel(row.finish_code) : row.finish_raw]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                      {row.note_raw ? (
                        <p className="mt-1 max-w-[320px] text-[10px] leading-4 text-[#8a9691]">
                          {row.note_raw}
                        </p>
                      ) : null}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 font-medium text-[#43524c]">
                      {formatNumber(toNumber(row.thickness_mm), 1)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-[#43524c]">
                      {row.price_per_t_ready ? formatNumber(toNumber(row.resolved_weight_kg_m), 3) : "—"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 tabular-nums text-[#43524c]">
                      {formatNumber(toNumber(row.base_eur_m), 4)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 tabular-nums text-[#43524c]">
                      {formatNumber(toNumber(row.fixed_extra_eur_m), 4)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 font-semibold tabular-nums text-[#173f35]">
                      {formatNumber(netM, 4)}
                    </td>
                    <td className="min-w-[155px] px-4 py-3">
                      {netT !== null ? (
                        <span className="font-bold tabular-nums text-[#173f35]">
                          {formatNumber(netT, 2)}
                        </span>
                      ) : (
                        <span
                          className="inline-flex rounded-full bg-[#f1f3f2] px-2 py-1 text-[10px] font-semibold text-[#6f7b76]"
                          title={row.price_per_t_status}
                        >
                          {readinessLabel(row.price_per_t_status)}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid gap-3 lg:hidden">
        {visibleRows.map((row) => {
          const netM = netPricePerMeter(row, discountPct, version.pricing_formula);
          const netT = netPricePerTonne(row, netM);
          return (
            <article key={row.item_id} className="rounded-2xl border border-[#dce2df] bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-[#1d2824]">
                    {row.dimension_label}
                  </h2>
                  <p className="mt-1 text-xs text-[#66736e]">
                    {[row.grade_code || row.grade_raw, row.finish_code ? finishLabel(row.finish_code) : row.finish_raw]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <span className="rounded-full bg-[#f3f6f4] px-2 py-1 text-[10px] font-semibold text-[#5f6d67]">
                  {shapeLabel(row.shape_code)}
                </span>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-xl bg-[#f7f9f8] p-3">
                  <p className="text-[#7a8781]">Base €/m</p>
                  <p className="mt-1 font-semibold tabular-nums text-[#1d2824]">
                    {formatNumber(toNumber(row.base_eur_m), 4)}
                  </p>
                </div>
                <div className="rounded-xl bg-[#f7f9f8] p-3">
                  <p className="text-[#7a8781]">Extra €/m</p>
                  <p className="mt-1 font-semibold tabular-nums text-[#1d2824]">
                    {formatNumber(toNumber(row.fixed_extra_eur_m), 4)}
                  </p>
                </div>
                <div className="rounded-xl bg-[#edf5f2] p-3">
                  <p className="text-[#527268]">Netto €/m</p>
                  <p className="mt-1 font-bold tabular-nums text-[#173f35]">
                    {formatNumber(netM, 4)}
                  </p>
                </div>
                <div className="rounded-xl bg-[#edf5f2] p-3">
                  <p className="text-[#527268]">Netto €/t</p>
                  {netT !== null ? (
                    <p className="mt-1 font-bold tabular-nums text-[#173f35]">
                      {formatNumber(netT, 2)}
                    </p>
                  ) : (
                    <p className="mt-1 text-[10px] font-semibold leading-4 text-[#66736e]">
                      {readinessLabel(row.price_per_t_status)}
                    </p>
                  )}
                </div>
              </div>

              <p className="mt-3 text-[11px] text-[#7a8781]">
                Sp. {formatNumber(toNumber(row.thickness_mm), 1)} mm
                {row.price_per_t_ready && row.resolved_weight_kg_m
                  ? " · " + formatNumber(toNumber(row.resolved_weight_kg_m), 3) + " kg/m"
                  : ""}
              </p>
            </article>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#cfd9d5] bg-[#f8faf9] p-8 text-center">
          <p className="text-sm font-semibold text-[#43524c]">Nessun articolo corrisponde ai filtri.</p>
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setShape("all");
              setGrade("all");
              setFinish("all");
              setPage(1);
            }}
            className="mt-3 text-sm font-semibold text-[#173f35] hover:underline"
          >
            Azzera filtri
          </button>
        </div>
      ) : null}

      {filtered.length > PAGE_SIZE ? (
        <nav
          className="flex items-center justify-between rounded-xl border border-[#dce2df] bg-white px-4 py-3 text-sm"
          aria-label="Paginazione listino"
        >
          <button
            type="button"
            disabled={safePage <= 1}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            className="font-semibold text-[#173f35] disabled:cursor-not-allowed disabled:text-[#a6b0ac]"
          >
            ← Precedenti
          </button>
          <span className="text-xs text-[#66736e]">
            Pagina {safePage} di {totalPages}
          </span>
          <button
            type="button"
            disabled={safePage >= totalPages}
            onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
            className="font-semibold text-[#173f35] disabled:cursor-not-allowed disabled:text-[#a6b0ac]"
          >
            Successivi →
          </button>
        </nav>
      ) : null}
    </div>
  );
}
