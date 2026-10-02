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

const familyOptions: Array<{ value: TubeFamily; label: string; short: string }> = [
  { value: "round_tube", label: "Tubo tondo", short: "Tondo" },
  { value: "square_tube", label: "Profilo quadro", short: "Quadro" },
  { value: "rectangular_tube", label: "Profilo rettangolare", short: "Rettangolare" },
];

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

export function PublicTubeWeightCalculator({
  references,
  initialValues,
}: {
  references: PublicTubeDimensionSummary[];
  initialValues?: PublicTubeCalculatorInitialValues;
}) {
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

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-3xl border border-[#dce2df] bg-white shadow-[0_1px_2px_rgba(30,43,69,0.025),0_12px_36px_rgba(30,43,69,0.035)]">
        <div className="border-b border-[#e7ece9] p-5 sm:p-7">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#1a5144]">Calcolatore peso tubo</p>
          <h2 className="mt-2 text-2xl font-semibold text-[#1d2824] sm:text-3xl">
            Da dimensioni a kg/m, peso barra e tonnellate
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#66736e]">
            Calcolo geometrico immediato con densità modificabile. Se la stessa geometria esiste nel catalogo
            tecnico verificato, mostriamo anche il peso di riferimento pubblicato senza confonderlo con il calcolo.
          </p>
        </div>

        <div className="grid gap-0 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="border-b border-[#e7ece9] p-5 sm:p-7 lg:border-b-0 lg:border-r">
            <div className="grid grid-cols-3 gap-2">
              {familyOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setFamily(option.value)}
                  className={
                    family === option.value
                      ? "rounded-xl bg-[#1a5144] px-3 py-2.5 text-sm font-semibold text-white"
                      : "rounded-xl border border-[#dce2df] bg-white px-3 py-2.5 text-sm font-semibold text-[#5d6a65] hover:border-[#b8d2c8]"
                  }
                >
                  <span className="hidden sm:inline">{option.label}</span>
                  <span className="sm:hidden">{option.short}</span>
                </button>
              ))}
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {family === "round_tube" ? (
                <label className="text-xs font-semibold text-[#5d6a65]">
                  Diametro esterno D (mm)
                  <input
                    value={outerDiameter}
                    onChange={(event) => setOuterDiameter(event.target.value)}
                    inputMode="decimal"
                    className="mt-1.5 w-full rounded-xl border border-[#dce2df] px-3 py-2.5 text-sm text-[#1d2824] outline-none focus:border-[#b8d2c8] focus:ring-4 focus:ring-[#e1ece8]"
                  />
                </label>
              ) : (
                <label className="text-xs font-semibold text-[#5d6a65]">
                  {family === "square_tube" ? "Lato esterno (mm)" : "Base esterna B (mm)"}
                  <input
                    value={width}
                    onChange={(event) => setWidth(event.target.value)}
                    inputMode="decimal"
                    className="mt-1.5 w-full rounded-xl border border-[#dce2df] px-3 py-2.5 text-sm text-[#1d2824] outline-none focus:border-[#b8d2c8] focus:ring-4 focus:ring-[#e1ece8]"
                  />
                </label>
              )}

              {family === "rectangular_tube" ? (
                <label className="text-xs font-semibold text-[#5d6a65]">
                  Altezza esterna H (mm)
                  <input
                    value={height}
                    onChange={(event) => setHeight(event.target.value)}
                    inputMode="decimal"
                    className="mt-1.5 w-full rounded-xl border border-[#dce2df] px-3 py-2.5 text-sm text-[#1d2824] outline-none focus:border-[#b8d2c8] focus:ring-4 focus:ring-[#e1ece8]"
                  />
                </label>
              ) : null}

              <label className="text-xs font-semibold text-[#5d6a65]">
                Spessore t (mm)
                <input
                  value={thickness}
                  onChange={(event) => setThickness(event.target.value)}
                  inputMode="decimal"
                  className="mt-1.5 w-full rounded-xl border border-[#dce2df] px-3 py-2.5 text-sm text-[#1d2824] outline-none focus:border-[#b8d2c8] focus:ring-4 focus:ring-[#e1ece8]"
                />
              </label>

              <label className="text-xs font-semibold text-[#5d6a65]">
                Lunghezza barra (m)
                <input
                  value={length}
                  onChange={(event) => setLength(event.target.value)}
                  inputMode="decimal"
                  className="mt-1.5 w-full rounded-xl border border-[#dce2df] px-3 py-2.5 text-sm text-[#1d2824] outline-none focus:border-[#b8d2c8] focus:ring-4 focus:ring-[#e1ece8]"
                />
              </label>

              <label className="text-xs font-semibold text-[#5d6a65]">
                Quantità barre
                <input
                  value={quantity}
                  onChange={(event) => setQuantity(event.target.value)}
                  inputMode="decimal"
                  className="mt-1.5 w-full rounded-xl border border-[#dce2df] px-3 py-2.5 text-sm text-[#1d2824] outline-none focus:border-[#b8d2c8] focus:ring-4 focus:ring-[#e1ece8]"
                />
              </label>

              <label className="text-xs font-semibold text-[#5d6a65]">
                Densità (kg/m³)
                <input
                  value={density}
                  onChange={(event) => setDensity(event.target.value)}
                  inputMode="decimal"
                  className="mt-1.5 w-full rounded-xl border border-[#dce2df] px-3 py-2.5 text-sm text-[#1d2824] outline-none focus:border-[#b8d2c8] focus:ring-4 focus:ring-[#e1ece8]"
                />
                <span className="mt-1 block font-normal text-[#66736e]">Default di calcolo: 7.850 kg/m³.</span>
              </label>
            </div>

            {values.error ? (
              <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
                {values.error}
              </p>
            ) : null}
          </div>

          <div className="bg-[#f6f8f7] p-5 sm:p-7">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#66736e]">Risultato teorico</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {[
                ["Area sezione", values.areaMm2 == null ? "—" : `${formatNumber(values.areaMm2, 2)} mm²`],
                ["Peso al metro", values.kgM == null ? "—" : `${formatNumber(values.kgM, 3)} kg/m`],
                ["Peso per barra", values.kgBar == null ? "—" : `${formatNumber(values.kgBar, 2)} kg`],
                ["Peso totale", values.totalTonnes == null ? "—" : `${formatNumber(values.totalTonnes, 4)} t`],
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl border border-[#dfe8f4] bg-white p-4">
                  <p className="text-xs font-semibold text-[#7e8da1]">{label}</p>
                  <p className="mt-1 text-xl font-semibold text-[#1d2824]">{value}</p>
                </div>
              ))}
            </div>

            <div className="mt-5 rounded-2xl border border-[#dce2df] bg-white p-4">
              {values.exactReference ? (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-[#1d2824]">Riferimento tecnico trovato</p>
                    <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-700">
                      {values.exactReference.weight_method === "published" ? "Peso pubblicato" : "Riferimento verificato"}
                    </span>
                  </div>
                  <p className="mt-3 text-2xl font-semibold text-[#1d2824]">
                    {formatNumber(values.exactReference.weight_kg_m, 3)} kg/m
                  </p>
                  {values.deltaPercent != null ? (
                    <p className="mt-1 text-xs text-[#66736e]">
                      Scostamento rispetto al calcolo geometrico: {formatNumber(values.deltaPercent, 2)}%.
                    </p>
                  ) : null}
                  <p className="mt-3 text-xs leading-5 text-[#66736e]">
                    Fonte: {values.exactReference.source_provider ?? values.exactReference.source_name ?? "fonte tecnica verificata"}.
                    Il valore pubblicato resta separato dal risultato matematico.
                  </p>
                  {values.exactReference.source_url ? (
                    <a
                      href={values.exactReference.source_url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-3 inline-flex text-xs font-semibold text-[#1a5144]"
                    >
                      Apri fonte ↗
                    </a>
                  ) : null}
                </>
              ) : (
                <>
                  <p className="text-sm font-semibold text-[#1d2824]">Nessun peso pubblicato per questa geometria</p>
                  <p className="mt-2 text-xs leading-5 text-[#66736e]">
                    Il risultato sopra resta un calcolo teorico. Non viene trasformato in un riferimento normativo
                    o in un peso verificato solo perché la geometria è matematicamente valida.
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-[#dce2df] bg-white p-5 sm:p-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#66736e]">Dimensioni di riferimento</p>
            <h2 className="mt-1 text-xl font-semibold text-[#1d2824]">
              {familyCount} pesi verificati per {familyOptions.find((item) => item.value === family)?.label.toLowerCase()}
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
            className="h-10 w-full rounded-xl border border-[#dce2df] px-3 text-sm outline-none focus:border-[#b8d2c8] focus:ring-4 focus:ring-[#e1ece8] sm:max-w-xs"
          />
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-[#e7ece9] text-xs uppercase tracking-wide text-[#7e8da1]">
              <tr>
                <th className="px-2 py-3 font-semibold">Dimensione</th>
                <th className="px-2 py-3 font-semibold">Peso</th>
                <th className="px-2 py-3 font-semibold">Metodo</th>
                <th className="px-2 py-3 font-semibold">Fonte</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#edf1f6]">
              {familyReferences.map((reference) => (
                <tr key={reference.reference_id}>
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
                      <a href={reference.source_url} target="_blank" rel="noreferrer" className="font-semibold text-[#1a5144]">
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
