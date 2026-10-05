
"use client";

import { useEffect, useMemo, useState, useTransition } from "react";

import { savePricingSession } from "@/app/(public)/listini/[versionId]/actions";

import {
  PriceListDistinta,
  type DistintaDraftLine,
} from "@/components/price-list-distinta";
import type { DistintaQuantityMode } from "@/lib/distinta";

import type {
  PriceListCatalogEntry,
  PriceListExplorerItem,
} from "@/lib/public-price-lists";
import type {
  EffectiveDiscount,
  PrivatePricingContext,
} from "@/lib/private-pricing";
import {
  reverseDiscountStatusLabel,
  solveDiscountForTargetEurT,
  type ReverseDiscountResult,
} from "@/lib/reverse-pricing";

const PAGE_SIZE = 75;

type PricingMode = "manual" | "saved" | "target";

type RowPricing = {
  appliedDiscountPct: number | null;
  netEurM: number | null;
  netEurT: number | null;
  reverse: ReverseDiscountResult | null;
  pricingIssue: string | null;
};

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

function resolveRowPricing({
  row,
  pricingMode,
  manualDiscountPct,
  savedDiscount,
  targetEurT,
  formula,
}: {
  row: PriceListExplorerItem;
  pricingMode: PricingMode;
  manualDiscountPct: number;
  savedDiscount: EffectiveDiscount | null;
  targetEurT: number;
  formula: string | null;
}): RowPricing {
  if (pricingMode === "target") {
    const reverse = solveDiscountForTargetEurT({
      formula,
      targetEurT,
      baseEurM: toNumber(row.base_eur_m),
      fixedExtraEurM: toNumber(row.fixed_extra_eur_m),
      weightKgM: toNumber(row.resolved_weight_kg_m),
      pricePerTReady: row.price_per_t_ready,
    });

    if (reverse.status !== "ready" || reverse.discountPct === null) {
      return {
        appliedDiscountPct: null,
        netEurM: null,
        netEurT: null,
        reverse,
        pricingIssue: reverseDiscountStatusLabel(reverse.status),
      };
    }

    const netEurM = netPricePerMeter(row, reverse.discountPct, formula);
    return {
      appliedDiscountPct: reverse.discountPct,
      netEurM,
      netEurT: netPricePerTonne(row, netEurM),
      reverse,
      pricingIssue: null,
    };
  }

  const appliedDiscountPct =
    pricingMode === "manual"
      ? manualDiscountPct
      : Number(savedDiscount?.discount_pct ?? 0);
  const netEurM = netPricePerMeter(row, appliedDiscountPct, formula);

  return {
    appliedDiscountPct,
    netEurM,
    netEurT: netPricePerTonne(row, netEurM),
    reverse: null,
    pricingIssue: null,
  };
}

export function PublicPriceListExplorer({
  version,
  items,
  privatePricing,
}: {
  version: PriceListCatalogEntry;
  items: PriceListExplorerItem[];
  privatePricing?: PrivatePricingContext;
}) {
  const [query, setQuery] = useState("");
  const [shape, setShape] = useState("all");
  const [grade, setGrade] = useState("all");
  const [finish, setFinish] = useState("all");
  const [discountInput, setDiscountInput] = useState("0");
  const [targetInput, setTargetInput] = useState("");
  const [pricingMode, setPricingMode] = useState<PricingMode>(
    privatePricing?.effectiveDiscounts.length ? "saved" : "manual",
  );
  const [page, setPage] = useState(1);
  const [distinta, setDistinta] = useState<
    Array<{
      itemId: string;
      quantityMode: DistintaQuantityMode;
      quantityInput: string;
      barLengthInput: string;
    }>
  >([]);
  const [mobileDistintaOpen, setMobileDistintaOpen] = useState(false);
  const [mobileControlsOpen, setMobileControlsOpen] = useState(false);
  const [savePending, startSaveTransition] = useTransition();
  const [savedSessionId, setSavedSessionId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const manualDiscountPct = Math.min(
    100,
    Math.max(0, Number(discountInput.replace(",", ".")) || 0),
  );
  const parsedTargetEurT = Number(targetInput.replace(",", "."));
  const targetEurT = Number.isFinite(parsedTargetEurT) ? parsedTargetEurT : 0;

  useEffect(() => {
    if (!mobileDistintaOpen) return;

    const previousOverflow = document.body.style.overflow;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileDistintaOpen(false);
    };

    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [mobileDistintaOpen]);

  const effectiveDiscountByItem = useMemo(
    () =>
      new Map(
        (privatePricing?.effectiveDiscounts ?? []).map((discount) => [
          discount.price_list_item_id,
          discount,
        ]),
      ),
    [privatePricing?.effectiveDiscounts],
  );

  const savedCoverage = effectiveDiscountByItem.size;

  function effectiveDiscountForRow(row: PriceListExplorerItem): EffectiveDiscount | null {
    return effectiveDiscountByItem.get(row.item_id) ?? null;
  }

  function pricingForRow(row: PriceListExplorerItem) {
    return resolveRowPricing({
      row,
      pricingMode,
      manualDiscountPct,
      savedDiscount: effectiveDiscountForRow(row),
      targetEurT,
      formula: version.pricing_formula,
    });
  }

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

  const itemById = useMemo(
    () => new Map(items.map((item) => [item.item_id, item])),
    [items],
  );

  const distintaLines = useMemo<DistintaDraftLine[]>(
    () =>
      distinta.flatMap((draft) => {
        const item = itemById.get(draft.itemId);
        if (!item) return [];

        const rowPricing = resolveRowPricing({
          row: item,
          pricingMode,
          manualDiscountPct,
          savedDiscount: effectiveDiscountByItem.get(item.item_id) ?? null,
          targetEurT,
          formula: version.pricing_formula,
        });

        return [
          {
            item,
            quantityMode: draft.quantityMode,
            quantityInput: draft.quantityInput,
            barLengthInput: draft.barLengthInput,
            appliedDiscountPct: rowPricing.appliedDiscountPct,
            netEurM: rowPricing.netEurM,
            netEurT: rowPricing.netEurT,
            pricingIssue: rowPricing.pricingIssue,
          },
        ];
      }),
    [
      distinta,
      effectiveDiscountByItem,
      itemById,
      manualDiscountPct,
      pricingMode,
      targetEurT,
      version.pricing_formula,
    ],
  );

  const selectedItemIds = useMemo(
    () => new Set(distinta.map((line) => line.itemId)),
    [distinta],
  );

  function addToDistinta(itemId: string) {
    setDistinta((current) => {
      if (current.some((line) => line.itemId === itemId)) return current;
      return [
        ...current,
        {
          itemId,
          quantityMode: "meters",
          quantityInput: "",
          barLengthInput: "6",
        },
      ];
    });
  }

  function removeFromDistinta(itemId: string) {
    setDistinta((current) => current.filter((line) => line.itemId !== itemId));
  }

  function updateDistintaLine(
    itemId: string,
    patch: Partial<{
      quantityMode: DistintaQuantityMode;
      quantityInput: string;
      barLengthInput: string;
    }>,
  ) {
    setDistinta((current) =>
      current.map((line) =>
        line.itemId === itemId ? { ...line, ...patch } : line,
      ),
    );
  }

  function saveCurrentDistinta() {
    setSaveError(null);
    setSavedSessionId(null);

    startSaveTransition(async () => {
      const result = await savePricingSession({
        versionId: version.version_id,
        pricingMode,
        manualDiscountPct:
          pricingMode === "manual" ? manualDiscountPct : null,
        targetEurT: pricingMode === "target" ? targetEurT : null,
        lines: distinta.map((line) => ({
          itemId: line.itemId,
          quantityMode: line.quantityMode,
          quantity: Number(line.quantityInput.replace(",", ".")),
          barLengthM:
            line.quantityMode === "bars"
              ? Number(line.barLengthInput.replace(",", "."))
              : null,
        })),
      });

      if (!result.ok || !result.sessionId) {
        setSaveError(result.error ?? "Non è stato possibile salvare la distinta.");
        return;
      }

      setSavedSessionId(result.sessionId);
    });
  }

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
  const activeFilterCount =
    Number(shape !== "all") +
    Number(grade !== "all") +
    Number(finish !== "all") +
    Number(query.trim().length > 0);

  function resetPage() {
    setPage(1);
  }

  return (
    <div className="space-y-4">
      <section className="relative z-20 rounded-2xl border border-[#d4dfda] bg-white/95 p-3 shadow-[0_8px_30px_rgba(20,46,38,0.08)] backdrop-blur-xl sm:p-4 lg:sticky lg:top-0">
        <button
          type="button"
          onClick={() => setMobileControlsOpen((current) => !current)}
          className="flex min-h-11 w-full items-center justify-between rounded-xl border border-[#d7dfdb] bg-[#f7f9f8] px-3 text-left lg:hidden"
          aria-expanded={mobileControlsOpen}
          aria-controls="mobile-listini-controls"
        >
          <span>
            <span className="block text-xs font-bold text-[#173f35]">Filtri e prezzo</span>
            <span className="mt-0.5 block text-[10px] text-[#718078]">
              {activeFilterCount > 0
                ? activeFilterCount + " filtri attivi"
                : "Ricerca, forma, grado, finitura e modalità prezzo"}
            </span>
          </span>
          <span className="text-sm font-bold text-[#52615b]" aria-hidden="true">
            {mobileControlsOpen ? "−" : "+"}
          </span>
        </button>

        <div
          id="mobile-listini-controls"
          className={[
            "mt-3 lg:mt-0",
            mobileControlsOpen ? "block" : "hidden lg:block",
          ].join(" ")}
        >
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

          <div className="min-w-0 xl:min-w-[280px]">
            <div className="mb-2 flex rounded-xl border border-[#d7dfdb] bg-[#f6f8f7] p-1 text-xs font-semibold">
              {privatePricing?.authenticated && privatePricing.effectiveDiscounts.length > 0 ? (
                <button
                  type="button"
                  onClick={() => setPricingMode("saved")}
                  className={[
                    "flex-1 rounded-lg px-2.5 py-2 transition",
                    pricingMode === "saved"
                      ? "bg-white text-[#173f35] shadow-sm"
                      : "text-[#66736e]",
                  ].join(" ")}
                >
                  Profili
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => setPricingMode("manual")}
                className={[
                  "flex-1 rounded-lg px-2.5 py-2 transition",
                  pricingMode === "manual"
                    ? "bg-white text-[#173f35] shadow-sm"
                    : "text-[#66736e]",
                ].join(" ")}
              >
                Manuale
              </button>
              <button
                type="button"
                onClick={() => setPricingMode("target")}
                className={[
                  "flex-1 rounded-lg px-2.5 py-2 transition",
                  pricingMode === "target"
                    ? "bg-white text-[#173f35] shadow-sm"
                    : "text-[#66736e]",
                ].join(" ")}
              >
                Target €/t
              </button>
            </div>

            {pricingMode === "manual" ? (
              <label className="block text-xs font-semibold text-[#173f35]">
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
            ) : pricingMode === "target" ? (
              <label className="block text-xs font-semibold text-[#173f35]">
                Target netto €/t
                <div className="mt-1.5 flex h-10 items-center overflow-hidden rounded-xl border border-[#9ebfb3] bg-[#edf5f2]">
                  <input
                    inputMode="decimal"
                    value={targetInput}
                    onChange={(event) => setTargetInput(event.target.value)}
                    placeholder="es. 950"
                    className="h-full min-w-0 flex-1 bg-transparent px-3 text-right text-sm font-bold text-[#173f35] outline-none"
                    aria-label="Target netto euro per tonnellata"
                  />
                  <span className="pr-3 text-sm font-bold text-[#173f35]">€/t</span>
                </div>
              </label>
            ) : (
              <div className="rounded-xl border border-[#9ebfb3] bg-[#edf5f2] px-3 py-2.5 text-xs text-[#173f35]">
                <strong>{savedCoverage}</strong> articoli coperti dai profili privati
              </div>
            )}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[#e7ece9] pt-3 text-xs text-[#66736e]">
          <p>
            <strong className="text-[#1d2824]">{filtered.length}</strong> articoli ·{" "}
            <strong className="text-[#1d2824]">{readyCount}</strong> con €/t disponibile
          </p>
          <p>
            {pricingMode === "saved"
              ? "Prezzi privati · profili salvati applicati per precedenza"
              : pricingMode === "target"
                ? "Reverse pricing · calcolo dello sconto richiesto per ogni articolo"
                : "Sconto temporaneo · non viene salvato"}
          </p>
        </div>
        </div>

        <div className="mt-3 flex items-center justify-between gap-3 text-xs text-[#66736e] lg:hidden">
          <p className="truncate">
            <strong className="text-[#1d2824]">{filtered.length}</strong> articoli ·{" "}
            <strong className="text-[#1d2824]">{readyCount}</strong> €/t
          </p>
          <button
            type="button"
            onClick={() => setMobileControlsOpen(true)}
            className="shrink-0 font-semibold text-[#173f35]"
          >
            Modifica filtri
          </button>
        </div>
      </section>

      {version.pricing_formula !== "discounted_base_plus_fixed_extra" ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          La formula commerciale di questa versione non è ancora supportata dal calcolo pubblico.
          Base ed Extra restano consultabili.
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-4">
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
                <th className="px-3 py-3">Sconto</th>
                <th className="px-3 py-3">Netto €/m</th>
                <th className="px-4 py-3">Netto €/t</th>
                <th className="px-4 py-3 text-right">Distinta</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#edf0ee]">
              {visibleRows.map((row) => {
                const rowPricing = pricingForRow(row);
                const appliedDiscountPct = rowPricing.appliedDiscountPct;
                const savedDiscount = effectiveDiscountForRow(row);
                const netM = rowPricing.netEurM;
                const netT = rowPricing.netEurT;
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
                    <td className="whitespace-nowrap px-3 py-3">
                      <span className="font-semibold tabular-nums text-[#43524c]">
                        {appliedDiscountPct === null
                          ? "—"
                          : formatNumber(appliedDiscountPct, 2) + "%"}
                      </span>
                      {pricingMode === "saved" && savedDiscount ? (
                        <p className="mt-1 text-[9px] font-semibold uppercase tracking-wide text-[#7a8781]">
                          {savedDiscount.scope_type.replaceAll("_", " ")}
                        </p>
                      ) : null}
                      {pricingMode === "target" && rowPricing.reverse?.status === "ready" ? (
                        <p className="mt-1 text-[9px] font-semibold uppercase tracking-wide text-[#1a5144]">
                          target {formatNumber(targetEurT, 2)} €/t
                        </p>
                      ) : null}
                      {pricingMode === "target" && rowPricing.pricingIssue ? (
                        <p className="mt-1 max-w-[150px] whitespace-normal text-[9px] font-medium leading-3 text-[#8a6a52]">
                          {rowPricing.pricingIssue}
                        </p>
                      ) : null}
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
                          {pricingMode === "target" && rowPricing.pricingIssue
                            ? rowPricing.pricingIssue
                            : readinessLabel(row.price_per_t_status)}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() =>
                          selectedItemIds.has(row.item_id)
                            ? removeFromDistinta(row.item_id)
                            : addToDistinta(row.item_id)
                        }
                        className={[
                          "whitespace-nowrap rounded-lg px-3 py-2 text-xs font-semibold transition",
                          selectedItemIds.has(row.item_id)
                            ? "border border-[#b9cec6] bg-[#edf5f2] text-[#173f35]"
                            : "border border-[#d7dfdb] bg-white text-[#52615b] hover:border-[#9ebfb3] hover:text-[#173f35]",
                        ].join(" ")}
                      >
                        {selectedItemIds.has(row.item_id) ? "✓ In distinta" : "+ Distinta"}
                      </button>
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
          const rowPricing = pricingForRow(row);
          const appliedDiscountPct = rowPricing.appliedDiscountPct;
          const savedDiscount = effectiveDiscountForRow(row);
          const netM = rowPricing.netEurM;
          const netT = rowPricing.netEurT;
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
                <div className="rounded-xl bg-[#f7f9f8] p-3">
                  <p className="text-[#7a8781]">Sconto</p>
                  <p className="mt-1 font-semibold tabular-nums text-[#1d2824]">
                    {appliedDiscountPct === null
                      ? "—"
                      : formatNumber(appliedDiscountPct, 2) + "%"}
                  </p>
                  {pricingMode === "saved" && savedDiscount ? (
                    <p className="mt-1 text-[9px] font-semibold uppercase tracking-wide text-[#7a8781]">
                      {savedDiscount.scope_type.replaceAll("_", " ")}
                    </p>
                  ) : null}
                  {pricingMode === "target" && rowPricing.reverse?.status === "ready" ? (
                    <p className="mt-1 text-[9px] font-semibold uppercase tracking-wide text-[#1a5144]">
                      target {formatNumber(targetEurT, 2)} €/t
                    </p>
                  ) : null}
                  {pricingMode === "target" && rowPricing.pricingIssue ? (
                    <p className="mt-1 text-[9px] font-medium leading-3 text-[#8a6a52]">
                      {rowPricing.pricingIssue}
                    </p>
                  ) : null}
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
                      {pricingMode === "target" && rowPricing.pricingIssue
                        ? rowPricing.pricingIssue
                        : readinessLabel(row.price_per_t_status)}
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between gap-3 border-t border-[#edf0ee] pt-3">
                <p className="text-[11px] text-[#7a8781]">
                  Sp. {formatNumber(toNumber(row.thickness_mm), 1)} mm
                  {row.price_per_t_ready && row.resolved_weight_kg_m
                    ? " · " + formatNumber(toNumber(row.resolved_weight_kg_m), 3) + " kg/m"
                    : ""}
                </p>
                <button
                  type="button"
                  onClick={() =>
                    selectedItemIds.has(row.item_id)
                      ? removeFromDistinta(row.item_id)
                      : addToDistinta(row.item_id)
                  }
                  className={[
                    "shrink-0 rounded-lg px-3 py-2 text-xs font-semibold",
                    selectedItemIds.has(row.item_id)
                      ? "border border-[#b9cec6] bg-[#edf5f2] text-[#173f35]"
                      : "border border-[#d7dfdb] bg-white text-[#52615b]",
                  ].join(" ")}
                >
                  {selectedItemIds.has(row.item_id) ? "✓ In distinta" : "+ Distinta"}
                </button>
              </div>
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

        <aside className="hidden xl:block">
          <div className="sticky top-[150px]">
            <PriceListDistinta
              lines={distintaLines}
              onQuantityModeChange={(itemId, quantityMode) =>
                updateDistintaLine(itemId, { quantityMode })
              }
              onQuantityChange={(itemId, quantityInput) =>
                updateDistintaLine(itemId, { quantityInput })
              }
              onBarLengthChange={(itemId, barLengthInput) =>
                updateDistintaLine(itemId, { barLengthInput })
              }
              onRemove={removeFromDistinta}
              onClear={() => setDistinta([])}
              exportContext={{
                title: "Distinta commerciale",
                listName: version.list_name,
                versionCode: version.manufacturer_version_code,
                sourceDate: version.source_date,
                currencyCode: version.currency_code,
              }}
              authenticated={privatePricing?.authenticated ?? false}
              canSave={privatePricing?.canWrite ?? false}
              onSave={saveCurrentDistinta}
              savePending={savePending}
              savedSessionId={savedSessionId}
              saveError={saveError}
            />
          </div>
        </aside>
      </div>

      {distinta.length > 0 ? (
        <button
          type="button"
          onClick={() => setMobileDistintaOpen(true)}
          className="fixed right-4 z-40 inline-flex min-h-12 items-center gap-2 rounded-2xl bg-[#173f35] px-4 text-sm font-semibold text-white shadow-xl xl:hidden"
          style={{ bottom: "calc(1rem + env(safe-area-inset-bottom))" }}
          aria-label={"Apri distinta con " + distinta.length + " righe"}
        >
          Distinta
          <span className="rounded-full bg-white/15 px-2 py-0.5 text-xs">
            {distinta.length}
          </span>
        </button>
      ) : null}

      {mobileDistintaOpen ? (
        <div
          className="fixed inset-0 z-50 xl:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Distinta articoli"
        >
          <button
            type="button"
            aria-label="Chiudi distinta"
            onClick={() => setMobileDistintaOpen(false)}
            className="absolute inset-0 bg-black/35"
          />
          <div
            className="absolute inset-x-0 bottom-0"
            style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
          >
            <PriceListDistinta
              mobile
              lines={distintaLines}
              onQuantityModeChange={(itemId, quantityMode) =>
                updateDistintaLine(itemId, { quantityMode })
              }
              onQuantityChange={(itemId, quantityInput) =>
                updateDistintaLine(itemId, { quantityInput })
              }
              onBarLengthChange={(itemId, barLengthInput) =>
                updateDistintaLine(itemId, { barLengthInput })
              }
              onRemove={removeFromDistinta}
              onClear={() => setDistinta([])}
              onClose={() => setMobileDistintaOpen(false)}
              exportContext={{
                title: "Distinta commerciale",
                listName: version.list_name,
                versionCode: version.manufacturer_version_code,
                sourceDate: version.source_date,
                currencyCode: version.currency_code,
              }}
              authenticated={privatePricing?.authenticated ?? false}
              canSave={privatePricing?.canWrite ?? false}
              onSave={saveCurrentDistinta}
              savePending={savePending}
              savedSessionId={savedSessionId}
              saveError={saveError}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
