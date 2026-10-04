"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import type { PublicTubeDimensionSummary } from "@/lib/public-knowledge";

type TubeFamily = PublicTubeDimensionSummary["product_family"];

export type PublicTubeCalculatorInitialValues = {
  family?: TubeFamily;
  outerDiameter?: string;
  width?: string;
  height?: string;
  thickness?: string;
  length?: string;
  quantity?: string;
  density?: string;
};

const familyOptions: Array<{
  value: TubeFamily;
  label: string;
  short: string;
  description: string;
}> = [
  {
    value: "round_tube",
    label: "Tubo tondo",
    short: "Tondo",
    description: "Diametro esterno + spessore",
  },
  {
    value: "square_tube",
    label: "Profilo quadro",
    short: "Quadro",
    description: "Lato esterno + spessore",
  },
  {
    value: "rectangular_tube",
    label: "Profilo rettangolare",
    short: "Rettangolare",
    description: "Base + altezza + spessore",
  },
];

const standardOptions = [
  {
    value: "en10219",
    label: "EN 10219",
    description: "Profilati cavi formati a freddo",
  },
  {
    value: "en10210",
    label: "EN 10210",
    description: "Profilati cavi finiti a caldo",
  },
  {
    value: "geometric",
    label: "Calcolo libero",
    description: "Solo geometria e densità",
  },
] as const;

type StandardValue = (typeof standardOptions)[number]["value"];

const lengthPresets = ["6", "8", "10", "12"] as const;

function parseNumber(value: string) {
  const normalized = value.trim().replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatNumber(value: number, digits = 3) {
  return new Intl.NumberFormat("it-IT", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  }).format(value);
}

function near(a: number | null, b: number | null, tolerance = 0.005) {
  if (a == null || b == null) return a === b;
  return Math.abs(a - b) <= tolerance;
}

function referenceLabel(reference: PublicTubeDimensionSummary) {
  if (reference.product_family === "round_tube") {
    return `Ø ${formatNumber(reference.outer_diameter_mm ?? 0)} × ${formatNumber(reference.thickness_mm)} mm`;
  }
  if (reference.product_family === "square_tube") {
    return `${formatNumber(reference.width_mm ?? 0)} × ${formatNumber(reference.width_mm ?? 0)} × ${formatNumber(reference.thickness_mm)} mm`;
  }
  return `${formatNumber(reference.width_mm ?? 0)} × ${formatNumber(reference.height_mm ?? 0)} × ${formatNumber(reference.thickness_mm)} mm`;
}

function ShapeGraphic({
  family,
  className = "",
}: {
  family: TubeFamily;
  className?: string;
}) {
  if (family === "round_tube") {
    return (
      <svg
        viewBox="0 0 120 120"
        aria-hidden="true"
        className={className}
        fill="none"
        stroke="currentColor"
      >
        <circle cx="60" cy="60" r="38" strokeWidth="9" />
        <circle cx="60" cy="60" r="20" strokeWidth="2" opacity="0.22" />
      </svg>
    );
  }

  if (family === "square_tube") {
    return (
      <svg
        viewBox="0 0 120 120"
        aria-hidden="true"
        className={className}
        fill="none"
        stroke="currentColor"
      >
        <rect x="25" y="25" width="70" height="70" rx="7" strokeWidth="9" />
        <rect x="43" y="43" width="34" height="34" rx="3" strokeWidth="2" opacity="0.22" />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 140 110"
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
    >
      <rect x="20" y="25" width="100" height="60" rx="7" strokeWidth="9" />
      <rect x="40" y="43" width="60" height="24" rx="3" strokeWidth="2" opacity="0.22" />
    </svg>
  );
}

export function PublicTubeWeightCalculator({
  references,
  initialValues,
}: {
  references: PublicTubeDimensionSummary[];
  initialValues?: PublicTubeCalculatorInitialValues;
}) {
  const [standard, setStandard] = useState<StandardValue>("en10219");
  const [family, setFamily] = useState<TubeFamily>(initialValues?.family ?? "round_tube");
  const [outerDiameter, setOuterDiameter] = useState(initialValues?.outerDiameter ?? "168,3");
  const [width, setWidth] = useState(initialValues?.width ?? "100");
  const [height, setHeight] = useState(initialValues?.height ?? "60");
  const [thickness, setThickness] = useState(initialValues?.thickness ?? "6,3");
  const [length, setLength] = useState(initialValues?.length ?? "12");
  const [quantity, setQuantity] = useState(initialValues?.quantity ?? "1");
  const [density, setDensity] = useState(initialValues?.density ?? "7850");
  const [referenceQuery, setReferenceQuery] = useState("");

  const values = useMemo(() => {
    const d = parseNumber(outerDiameter);
    const b = parseNumber(width);
    const h = family === "square_tube" ? b : parseNumber(height);
    const t = parseNumber(thickness);
    const l = parseNumber(length);
    const qty = parseNumber(quantity);
    const rho = parseNumber(density);

    let error: string | null = null;
    if (t == null || t <= 0) error = "Inserisci uno spessore maggiore di zero.";
    if (l == null || l <= 0) error = "Inserisci una lunghezza maggiore di zero.";
    if (qty == null || qty <= 0) error = "Inserisci una quantità maggiore di zero.";
    if (rho == null || rho <= 0) error = "Inserisci una densità valida.";

    let areaMm2: number | null = null;
    if (!error && family === "round_tube") {
      if (d == null || d <= 0) error = "Inserisci un diametro esterno valido.";
      else if (t != null && 2 * t >= d) error = "Lo spessore deve essere inferiore a metà del diametro.";
      else if (t != null) areaMm2 = Math.PI * t * (d - t);
    }

    if (!error && family === "square_tube") {
      if (b == null || b <= 0) error = "Inserisci il lato esterno.";
      else if (t != null && 2 * t >= b) error = "Lo spessore deve essere inferiore a metà del lato.";
      else if (t != null) areaMm2 = b * b - (b - 2 * t) * (b - 2 * t);
    }

    if (!error && family === "rectangular_tube") {
      if (b == null || b <= 0 || h == null || h <= 0) error = "Inserisci base e altezza esterne.";
      else if (t != null && 2 * t >= Math.min(b, h)) error = "Lo spessore deve essere inferiore a metà del lato minore.";
      else if (t != null) areaMm2 = b * h - (b - 2 * t) * (h - 2 * t);
    }

    const kgM = !error && areaMm2 != null && rho != null ? (areaMm2 * rho) / 1_000_000 : null;
    const kgBar = kgM != null && l != null ? kgM * l : null;
    const totalKg = kgBar != null && qty != null ? kgBar * qty : null;
    const totalTonnes = totalKg != null ? totalKg / 1000 : null;

    const exactReference = !error
      ? references.find((reference) => {
          if (reference.product_family !== family || t == null || !near(reference.thickness_mm, t)) return false;
          if (family === "round_tube") return d != null && near(reference.outer_diameter_mm, d);
          if (family === "square_tube") return b != null && near(reference.width_mm, b) && near(reference.height_mm, b);
          return b != null && h != null && near(reference.width_mm, b) && near(reference.height_mm, h);
        }) ?? null
      : null;

    const deltaPercent =
      exactReference && kgM && kgM !== 0
        ? ((exactReference.weight_kg_m - kgM) / kgM) * 100
        : null;

    return { d, b, h, t, l, qty, rho, areaMm2, kgM, kgBar, totalKg, totalTonnes, exactReference, deltaPercent, error };
  }, [outerDiameter, width, height, thickness, length, quantity, density, family, references]);

  const familyReferences = useMemo(() => {
    const q = referenceQuery.trim().toLowerCase().replace(",", ".");
    return references
      .filter((reference) => reference.product_family === family)
      .filter((reference) => {
        if (!q) return true;
        return [
          referenceLabel(reference),
          String(reference.weight_kg_m),
          reference.source_provider ?? "",
        ].some((value) => value.toLowerCase().replace(",", ".").includes(q));
      })
      .slice(0, 18);
  }, [references, family, referenceQuery]);

  const familyCount = references.filter((reference) => reference.product_family === family).length;
  const currentFamily = familyOptions.find((option) => option.value === family) ?? familyOptions[0];
  const currentStandard = standardOptions.find((option) => option.value === standard) ?? standardOptions[0];

  const inputClass =
    "mt-1.5 w-full rounded-xl border border-[#cfd9d5] bg-white px-3 py-3 text-base font-semibold text-[#1d2824] outline-none transition focus:border-[#438d7a] focus:ring-4 focus:ring-[#d9e8e2]";

  return (
    <div className="space-y-6">
      <section
        id="calcolatore-pesi"
        className="overflow-hidden rounded-[2rem] border border-[#cddbd6] bg-white shadow-[0_18px_60px_rgba(11,47,39,0.08)]"
      >
        <div className="border-b border-[#dce7e3] bg-[linear-gradient(135deg,#f7fbf9_0%,#ffffff_55%,#edf5f2_100%)] p-5 sm:p-7 lg:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="flex flex-wrap items-center gap-2">
                <span className="school-eyebrow">Calcolatore pesi</span>
                <span className="school-badge">Gratis</span>
                <span className="school-badge">Risultato live</span>
              </div>
              <h2 className="mt-4 text-3xl font-semibold tracking-[-0.03em] text-[#15372f] sm:text-4xl">
                Scegli il tubo. Inserisci la misura. Hai subito il peso.
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-[#5d6a65] sm:text-base">
                Parti dalla norma e dalla sagoma che stai cercando. Il calcolo si aggiorna mentre scrivi:
                kg/m, peso della barra e tonnellaggio totale senza passare da Excel.
              </p>
            </div>

            <div className="grid grid-cols-4 gap-1 rounded-2xl border border-[#d7e4df] bg-white/90 p-1.5 text-center shadow-sm">
              {["Norma", "Sagoma", "Misure", "Peso"].map((step, index) => (
                <div
                  key={step}
                  className="rounded-xl px-2 py-2 text-[10px] font-bold uppercase tracking-[0.08em] text-[#496159]"
                >
                  <span className="block text-sm text-[#173f35]">{index + 1}</span>
                  {step}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-8 p-5 sm:p-7 lg:p-8">
          <section aria-labelledby="calculator-standard">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="school-kicker">1 · Norma di partenza</p>
                <h3 id="calculator-standard" className="mt-1 text-xl font-semibold text-[#1d2824]">
                  In quale contesto stai lavorando?
                </h3>
              </div>
              <p className="max-w-xl text-xs leading-5 text-[#66736e]">
                La norma orienta il percorso e i riferimenti. Il risultato teorico resta calcolato dalla geometria e dalla densità impostata.
              </p>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {standardOptions.map((option) => {
                const selected = standard === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setStandard(option.value)}
                    className={
                      selected
                        ? "school-selected-control min-h-20 rounded-2xl px-4 py-3 text-left shadow-sm"
                        : "rounded-2xl border border-[#d7e1dd] bg-[#f8faf9] px-4 py-3 text-left text-[#1d2824] hover:border-[#8fb5a8] hover:bg-[#f1f7f4]"
                    }
                  >
                    <span className="block text-base font-bold">{option.label}</span>
                    <span className={selected ? "mt-1 block text-xs text-white/80" : "mt-1 block text-xs text-[#66736e]"}>
                      {option.description}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <section aria-labelledby="calculator-shape">
            <p className="school-kicker">2 · Sagoma</p>
            <h3 id="calculator-shape" className="mt-1 text-xl font-semibold text-[#1d2824]">
              Che profilo stai cercando?
            </h3>

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {familyOptions.map((option) => {
                const selected = family === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setFamily(option.value)}
                    className={
                      selected
                        ? "group relative overflow-hidden rounded-3xl border border-[#173f35] bg-[#173f35] p-5 text-left text-white shadow-[0_14px_34px_rgba(23,63,53,0.18)]"
                        : "group relative overflow-hidden rounded-3xl border border-[#d7e1dd] bg-white p-5 text-left text-[#173f35] hover:-translate-y-0.5 hover:border-[#8fb5a8] hover:shadow-md"
                    }
                  >
                    <div className="flex items-center justify-between gap-4">
                      <ShapeGraphic
                        family={option.value}
                        className={selected ? "h-24 w-28 text-white" : "h-24 w-28 text-[#1a5144]"}
                      />
                      <span
                        className={
                          selected
                            ? "rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-white"
                            : "rounded-full bg-[#edf5f2] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-[#1a5144]"
                        }
                      >
                        {selected ? "Selezionato" : "Scegli"}
                      </span>
                    </div>
                    <span className="mt-3 block text-lg font-bold">{option.label}</span>
                    <span className={selected ? "mt-1 block text-xs text-white/75" : "mt-1 block text-xs text-[#66736e]"}>
                      {option.description}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <div className="grid gap-6 xl:grid-cols-[1.02fr_0.98fr]">
            <section
              aria-labelledby="calculator-measures"
              className="rounded-3xl border border-[#d7e1dd] bg-[#f7f9f8] p-5 sm:p-6"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="school-kicker">3 · Misure</p>
                  <h3 id="calculator-measures" className="mt-1 text-xl font-semibold text-[#1d2824]">
                    Inserisci le dimensioni
                  </h3>
                </div>
                <div className="hidden rounded-2xl border border-[#d9e8e2] bg-white p-2 sm:block">
                  <ShapeGraphic family={family} className="h-16 w-20 text-[#1a5144]" />
                </div>
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                {family === "round_tube" ? (
                  <label className="text-xs font-semibold text-[#52615b]">
                    Diametro esterno D (mm)
                    <input
                      value={outerDiameter}
                      onChange={(event) => setOuterDiameter(event.target.value)}
                      inputMode="decimal"
                      className={inputClass}
                    />
                  </label>
                ) : (
                  <label className="text-xs font-semibold text-[#52615b]">
                    {family === "square_tube" ? "Lato esterno (mm)" : "Base esterna B (mm)"}
                    <input
                      value={width}
                      onChange={(event) => setWidth(event.target.value)}
                      inputMode="decimal"
                      className={inputClass}
                    />
                  </label>
                )}

                {family === "rectangular_tube" ? (
                  <label className="text-xs font-semibold text-[#52615b]">
                    Altezza esterna H (mm)
                    <input
                      value={height}
                      onChange={(event) => setHeight(event.target.value)}
                      inputMode="decimal"
                      className={inputClass}
                    />
                  </label>
                ) : null}

                <label className="text-xs font-semibold text-[#52615b]">
                  Spessore t (mm)
                  <input
                    value={thickness}
                    onChange={(event) => setThickness(event.target.value)}
                    inputMode="decimal"
                    className={inputClass}
                  />
                </label>
              </div>

              <div className="mt-6 rounded-2xl border border-[#d4e0db] bg-white p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-bold text-[#1d2824]">Lunghezza barra</p>
                    <p className="text-xs text-[#66736e]">12 m è il valore standard iniziale, sempre modificabile.</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {lengthPresets.map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setLength(preset)}
                        className={
                          length === preset
                            ? "school-selected-control rounded-xl px-3 py-2.5 text-sm font-bold"
                            : "school-secondary-action px-3 py-2.5"
                        }
                      >
                        {preset} m
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <label className="text-xs font-semibold text-[#52615b]">
                    Lunghezza personalizzata (m)
                    <input
                      value={length}
                      onChange={(event) => setLength(event.target.value)}
                      inputMode="decimal"
                      className={inputClass}
                    />
                  </label>

                  <label className="text-xs font-semibold text-[#52615b]">
                    Numero barre
                    <input
                      value={quantity}
                      onChange={(event) => setQuantity(event.target.value)}
                      inputMode="numeric"
                      className={inputClass}
                    />
                  </label>
                </div>
              </div>

              <details className="mt-4 rounded-2xl border border-[#d7e1dd] bg-white p-4">
                <summary className="cursor-pointer text-sm font-bold text-[#334a42]">
                  Impostazioni avanzate
                </summary>
                <label className="mt-4 block text-xs font-semibold text-[#52615b]">
                  Densità (kg/m³)
                  <input
                    value={density}
                    onChange={(event) => setDensity(event.target.value)}
                    inputMode="decimal"
                    className={inputClass}
                  />
                  <span className="mt-1 block font-normal text-[#66736e]">Default acciaio: 7.850 kg/m³.</span>
                </label>
              </details>

              {values.error ? (
                <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
                  {values.error}
                </p>
              ) : null}
            </section>

            <aside
              aria-live="polite"
              className="overflow-hidden rounded-3xl border border-[#173f35] bg-[#123d34] text-white shadow-[0_20px_50px_rgba(18,61,52,0.18)]"
            >
              <div className="border-b border-white/10 p-5 sm:p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-white/60">4 · Risultato live</p>
                    <h3 className="mt-1 text-xl font-semibold">Il numero che ti serve subito</h3>
                  </div>
                  <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold">
                    {currentStandard.label} · {currentFamily.short}
                  </span>
                </div>

                <div className="mt-8">
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-white/60">Peso al metro</p>
                  <p className="metric-number mt-2 text-5xl font-semibold tracking-[-0.05em] sm:text-6xl">
                    {values.kgM == null ? "—" : formatNumber(values.kgM, 3)}
                    <span className="ml-2 text-xl font-semibold tracking-normal text-white/70">kg/m</span>
                  </p>
                </div>
              </div>

              <div className="grid gap-px bg-white/10 sm:grid-cols-2">
                <div className="bg-[#16483d] p-5 sm:p-6">
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-white/60">Peso per barra · {length || "—"} m</p>
                  <p className="metric-number mt-2 text-3xl font-semibold">
                    {values.kgBar == null ? "—" : formatNumber(values.kgBar, 2)}
                    <span className="ml-1 text-base text-white/60">kg</span>
                  </p>
                </div>
                <div className="bg-[#16483d] p-5 sm:p-6">
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-white/60">
                    Peso totale · {quantity || "—"} barre
                  </p>
                  <p className="metric-number mt-2 text-3xl font-semibold">
                    {values.totalTonnes == null ? "—" : formatNumber(values.totalTonnes, 4)}
                    <span className="ml-1 text-base text-white/60">t</span>
                  </p>
                </div>
              </div>

              <div className="p-5 sm:p-6">
                <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold">Riferimento tecnico</p>
                    {values.exactReference ? (
                      <span className="rounded-full bg-white/12 px-2.5 py-1 text-[10px] font-semibold text-white">
                        {values.exactReference.weight_method === "published" ? "Peso pubblicato" : "Verificato"}
                      </span>
                    ) : null}
                  </div>

                  {values.exactReference ? (
                    <>
                      <p className="metric-number mt-3 text-2xl font-semibold">
                        {formatNumber(values.exactReference.weight_kg_m, 3)} kg/m
                      </p>
                      {values.deltaPercent != null ? (
                        <p className="mt-1 text-xs text-white/60">
                          Scostamento rispetto al calcolo geometrico: {formatNumber(values.deltaPercent, 2)}%.
                        </p>
                      ) : null}
                      <p className="mt-3 text-xs leading-5 text-white/60">
                        Fonte: {values.exactReference.source_provider ?? values.exactReference.source_name ?? "fonte tecnica verificata"}.
                        Il peso pubblicato resta separato dal risultato matematico.
                      </p>
                      {values.exactReference.source_url ? (
                        <a
                          href={values.exactReference.source_url}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-3 inline-flex text-xs font-bold text-white underline decoration-white/35 underline-offset-4"
                        >
                          Apri fonte ↗
                        </a>
                      ) : null}
                    </>
                  ) : (
                    <>
                      <p className="mt-2 text-sm font-semibold text-white">Nessun peso pubblicato per questa geometria</p>
                      <p className="mt-2 text-xs leading-5 text-white/60">
                        Il risultato resta un calcolo teorico. Non viene trasformato automaticamente in un valore normativo o verificato.
                      </p>
                    </>
                  )}
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-white/60">
                  <span>Area sezione: {values.areaMm2 == null ? "—" : `${formatNumber(values.areaMm2, 2)} mm²`}</span>
                  <span>Totale: {values.totalKg == null ? "—" : `${formatNumber(values.totalKg, 1)} kg`}</span>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-[#dce2df] bg-white p-5 sm:p-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#66736e]">Dimensioni di riferimento</p>
            <h2 className="mt-1 text-xl font-semibold text-[#1d2824]">
              {familyCount} pesi verificati per {currentFamily.label.toLowerCase()}
            </h2>
            <p className="mt-1 text-sm text-[#66736e]">
              Cerca una misura per confrontare il calcolo con valori già presenti nel catalogo tecnico.
            </p>
          </div>
          <input
            value={referenceQuery}
            onChange={(event) => setReferenceQuery(event.target.value)}
            placeholder="Cerca 168,3 × 6,3..."
            aria-label="Cerca dimensione di riferimento"
            className="h-11 w-full rounded-xl border border-[#dce2df] px-3 text-base outline-none focus:border-[#b8d2c8] focus:ring-4 focus:ring-[#e1ece8] sm:max-w-xs"
          />
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="school-table-head border-b border-[#dce2df] text-xs uppercase tracking-wide">
              <tr>
                <th className="px-2 py-3 font-semibold">Dimensione</th>
                <th className="px-2 py-3 font-semibold">Peso</th>
                <th className="px-2 py-3 font-semibold">Metodo</th>
                <th className="px-2 py-3 font-semibold">Fonte</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#edf1f6]">
              {familyReferences.map((reference) => (
                <tr key={reference.reference_id} className="school-table-row">
                  <td className="px-2 py-3 font-medium">
                    <Link
                      href={`/knowledge/tubes/${reference.dimension_slug}`}
                      className="text-[#2f4059] underline decoration-[#c7d8f5] underline-offset-4 hover:text-[#1a5144]"
                    >
                      {referenceLabel(reference)}
                    </Link>
                  </td>
                  <td className="px-2 py-3 text-[#40516a]">{formatNumber(reference.weight_kg_m, 3)} kg/m</td>
                  <td className="px-2 py-3 text-[#66736e]">
                    {reference.weight_method === "published" ? "Pubblicato" : "Verificato"}
                  </td>
                  <td className="px-2 py-3 text-[#66736e]">
                    {reference.source_url ? (
                      <a href={reference.source_url} target="_blank" rel="noreferrer" className="school-inline-link">
                        {reference.source_provider ?? "Fonte"} ↗
                      </a>
                    ) : reference.source_provider ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {familyCount > familyReferences.length ? (
          <p className="mt-3 text-xs text-[#66736e]">
            Mostrati i primi {familyReferences.length} riferimenti corrispondenti. Usa la ricerca per restringere la lista.
          </p>
        ) : null}
      </section>
    </div>
  );
}
