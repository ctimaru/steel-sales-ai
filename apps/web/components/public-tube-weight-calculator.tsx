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
type NormativeStandard = Exclude<StandardValue, "geometric">;

function standardCornerRadii(standard: NormativeStandard, thicknessMm: number) {
  if (standard === "en10210") {
    return {
      outerRadiusMm: 1.5 * thicknessMm,
      innerRadiusMm: 1.0 * thicknessMm,
    };
  }

  if (thicknessMm <= 6) {
    return {
      outerRadiusMm: 2.0 * thicknessMm,
      innerRadiusMm: 1.0 * thicknessMm,
    };
  }

  if (thicknessMm <= 10) {
    return {
      outerRadiusMm: 2.5 * thicknessMm,
      innerRadiusMm: 1.5 * thicknessMm,
    };
  }

  return {
    outerRadiusMm: 3.0 * thicknessMm,
    innerRadiusMm: 2.0 * thicknessMm,
  };
}

function standardRectangularAreaMm2(
  standard: NormativeStandard,
  widthMm: number,
  heightMm: number,
  thicknessMm: number,
) {
  const { outerRadiusMm, innerRadiusMm } = standardCornerRadii(standard, thicknessMm);
  return {
    areaMm2:
      2 * thicknessMm * (widthMm + heightMm - 2 * thicknessMm) -
      (4 - Math.PI) * (outerRadiusMm ** 2 - innerRadiusMm ** 2),
    outerRadiusMm,
    innerRadiusMm,
  };
}

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


function positiveDimension(value: string, fallback: number) {
  const parsed = parseNumber(value);
  return parsed != null && parsed > 0 ? parsed : fallback;
}

function ParametricShapeDiagram({
  family,
  outerDiameter,
  width,
  height,
  thickness,
  standard,
}: {
  family: TubeFamily;
  outerDiameter: string;
  width: string;
  height: string;
  thickness: string;
  standard: StandardValue;
}) {
  const d = positiveDimension(outerDiameter, 100);
  const b = positiveDimension(width, 100);
  const h = family === "square_tube" ? b : positiveDimension(height, 60);
  const t = positiveDimension(thickness, 5);

  const shapeCenterX = 132;
  const shapeCenterY = 86;
  const maxShape = 116;
  const minShape = 64;

  const ratio = b / h;
  const outerW =
    family === "rectangular_tube"
      ? ratio >= 1
        ? maxShape
        : Math.max(minShape, maxShape * ratio)
      : maxShape;
  const outerH =
    family === "rectangular_tube"
      ? ratio >= 1
        ? Math.max(minShape, maxShape / ratio)
        : maxShape
      : maxShape;

  const safeWallRatio =
    family === "round_tube"
      ? Math.min(0.44, t / d)
      : Math.min(0.44, t / Math.min(b, h));

  const innerScale = Math.max(0.12, 1 - 2 * safeWallRatio);
  const outerX = shapeCenterX - outerW / 2;
  const outerY = shapeCenterY - outerH / 2;
  const innerW = Math.max(14, outerW * (family === "rectangular_tube" ? Math.max(0.12, 1 - 2 * Math.min(0.44, t / b)) : innerScale));
  const innerH = Math.max(14, outerH * (family === "rectangular_tube" ? Math.max(0.12, 1 - 2 * Math.min(0.44, t / h)) : innerScale));
  const innerX = shapeCenterX - innerW / 2;
  const innerY = shapeCenterY - innerH / 2;
  const diagramRadii =
    family !== "round_tube" && standard !== "geometric"
      ? standardCornerRadii(standard, t)
      : null;
  const outerCornerRadiusPx = diagramRadii
    ? Math.min(18, Math.max(5, (diagramRadii.outerRadiusMm / Math.min(b, h)) * Math.min(outerW, outerH)))
    : 8;
  const innerCornerRadiusPx = diagramRadii
    ? Math.min(15, Math.max(3, (diagramRadii.innerRadiusMm / Math.max(1, Math.min(b, h) - 2 * t)) * Math.min(innerW, innerH)))
    : 5;

  const primaryDimension =
    family === "round_tube"
      ? `Ø ${formatNumber(d, 2)} mm`
      : `B ${formatNumber(b, 2)} mm`;
  const secondaryDimension =
    family === "rectangular_tube" ? `H ${formatNumber(h, 2)} mm` : null;
  const thicknessDimension = `t ${formatNumber(t, 2)} mm`;
  const accessibleLabel =
    family === "round_tube"
      ? `Sezione tubo tondo, diametro esterno ${formatNumber(d, 2)} millimetri e spessore ${formatNumber(t, 2)} millimetri`
      : family === "square_tube"
        ? `Sezione profilo quadro, lato ${formatNumber(b, 2)} millimetri e spessore ${formatNumber(t, 2)} millimetri`
        : `Sezione profilo rettangolare, base ${formatNumber(b, 2)} millimetri, altezza ${formatNumber(h, 2)} millimetri e spessore ${formatNumber(t, 2)} millimetri`;

  return (
    <figure className="rounded-3xl border border-[#d3e1dc] bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#1a5144]">Vista proporzionale</p>
          <p className="mt-1 text-xs leading-5 text-[#66736e]">
            Le quote seguono i valori inseriti e lo spessore viene rappresentato in proporzione.
          </p>
        </div>
        <span className="rounded-full bg-[#edf5f2] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-[#1a5144]">
          {standard === "geometric" ? "Libero" : standard === "en10210" ? "EN 10210" : "EN 10219"}
        </span>
      </div>

      <svg
        viewBox="0 0 264 210"
        role="img"
        aria-label={accessibleLabel}
        className="mx-auto mt-3 block h-auto w-full max-w-[30rem]"
      >
        <title>{accessibleLabel}</title>

        {family === "round_tube" ? (
          <>
            <circle
              cx={shapeCenterX}
              cy={shapeCenterY}
              r={outerW / 2}
              fill="#d9e8e2"
              stroke="#1a5144"
              strokeWidth="2.5"
            />
            <circle
              cx={shapeCenterX}
              cy={shapeCenterY}
              r={(outerW / 2) * innerScale}
              fill="#ffffff"
              stroke="#7aa99a"
              strokeWidth="1.5"
            />
          </>
        ) : (
          <>
            <rect
              x={outerX}
              y={outerY}
              width={outerW}
              height={outerH}
              rx={outerCornerRadiusPx}
              fill="#d9e8e2"
              stroke="#1a5144"
              strokeWidth="2.5"
            />
            <rect
              x={innerX}
              y={innerY}
              width={innerW}
              height={innerH}
              rx={innerCornerRadiusPx}
              fill="#ffffff"
              stroke="#7aa99a"
              strokeWidth="1.5"
            />
          </>
        )}

        <g fill="none" stroke="#5d6a65" strokeWidth="1.25">
          <line x1={shapeCenterX - outerW / 2} y1="164" x2={shapeCenterX + outerW / 2} y2="164" />
          <line x1={shapeCenterX - outerW / 2} y1="158" x2={shapeCenterX - outerW / 2} y2="170" />
          <line x1={shapeCenterX + outerW / 2} y1="158" x2={shapeCenterX + outerW / 2} y2="170" />
        </g>
        <text x={shapeCenterX} y="187" textAnchor="middle" fill="#334a42" fontSize="12" fontWeight="700">
          {primaryDimension}
        </text>

        {secondaryDimension ? (
          <>
            <g fill="none" stroke="#5d6a65" strokeWidth="1.25">
              <line x1="45" y1={shapeCenterY - outerH / 2} x2="45" y2={shapeCenterY + outerH / 2} />
              <line x1="39" y1={shapeCenterY - outerH / 2} x2="51" y2={shapeCenterY - outerH / 2} />
              <line x1="39" y1={shapeCenterY + outerH / 2} x2="51" y2={shapeCenterY + outerH / 2} />
            </g>
            <text
              x="22"
              y={shapeCenterY}
              textAnchor="middle"
              fill="#334a42"
              fontSize="12"
              fontWeight="700"
              transform={`rotate(-90 22 ${shapeCenterY})`}
            >
              {secondaryDimension}
            </text>
          </>
        ) : null}

        {family === "round_tube" ? (
          <>
            <line
              x1={shapeCenterX + (outerW / 2) * innerScale * 0.72}
              y1={shapeCenterY - (outerW / 2) * innerScale * 0.72}
              x2={shapeCenterX + (outerW / 2) * 0.72}
              y2={shapeCenterY - (outerW / 2) * 0.72}
              stroke="#b55f29"
              strokeWidth="3"
              strokeLinecap="round"
            />
            <text x="211" y="45" fill="#9a4e22" fontSize="11" fontWeight="800">
              {thicknessDimension}
            </text>
          </>
        ) : (
          <>
            <line
              x1={innerX + innerW}
              y1={shapeCenterY}
              x2={outerX + outerW}
              y2={shapeCenterY}
              stroke="#b55f29"
              strokeWidth="3"
              strokeLinecap="round"
            />
            <text x={Math.min(236, outerX + outerW + 8)} y={shapeCenterY + 4} fill="#9a4e22" fontSize="11" fontWeight="800">
              {thicknessDimension}
            </text>
          </>
        )}
      </svg>

      <figcaption className="grid gap-2 border-t border-[#e4ebe8] pt-3 text-xs sm:grid-cols-3">
        <span className="rounded-xl bg-[#f6f8f7] px-3 py-2 font-semibold text-[#405049]">{primaryDimension}</span>
        {secondaryDimension ? (
          <span className="rounded-xl bg-[#f6f8f7] px-3 py-2 font-semibold text-[#405049]">{secondaryDimension}</span>
        ) : (
          <span className="rounded-xl bg-[#f6f8f7] px-3 py-2 font-semibold text-[#405049]">
            {family === "round_tube" ? "Sezione circolare" : "Sezione quadrata"}
          </span>
        )}
        <span className="rounded-xl bg-[#fbf0e9] px-3 py-2 font-semibold text-[#8b4a25]">{thicknessDimension}</span>
      </figcaption>
    </figure>
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
  const [targetTonnes, setTargetTonnes] = useState("");
  const [density, setDensity] = useState(initialValues?.density ?? "7850");
  const [referenceQuery, setReferenceQuery] = useState("");

  const values = useMemo(() => {
    const d = parseNumber(outerDiameter);
    const b = parseNumber(width);
    const h = family === "square_tube" ? b : parseNumber(height);
    const t = parseNumber(thickness);
    const l = parseNumber(length);
    const qty = parseNumber(quantity);
    const targetT = parseNumber(targetTonnes);
    const rho = parseNumber(density);

    let error: string | null = null;
    if (t == null || t <= 0) error = "Inserisci uno spessore maggiore di zero.";
    if (l == null || l <= 0) error = "Inserisci una lunghezza maggiore di zero.";
    if (qty == null || qty <= 0) error = "Inserisci una quantità maggiore di zero.";
    if (standard === "geometric" && (rho == null || rho <= 0)) error = "Inserisci una densità valida.";

    let freeAreaMm2: number | null = null;
    if (!error && family === "round_tube") {
      if (d == null || d <= 0) error = "Inserisci un diametro esterno valido.";
      else if (t != null && 2 * t >= d) error = "Lo spessore deve essere inferiore a metà del diametro.";
      else if (t != null) freeAreaMm2 = Math.PI * t * (d - t);
    }

    if (!error && family === "square_tube") {
      if (b == null || b <= 0) error = "Inserisci il lato esterno.";
      else if (t != null && 2 * t >= b) error = "Lo spessore deve essere inferiore a metà del lato.";
      else if (t != null) freeAreaMm2 = b * b - (b - 2 * t) * (b - 2 * t);
    }

    if (!error && family === "rectangular_tube") {
      if (b == null || b <= 0 || h == null || h <= 0) error = "Inserisci base e altezza esterne.";
      else if (t != null && 2 * t >= Math.min(b, h)) error = "Lo spessore deve essere inferiore a metà del lato minore.";
      else if (t != null) freeAreaMm2 = b * h - (b - 2 * t) * (h - 2 * t);
    }

    let standardAreaMm2: number | null = null;
    let outerRadiusMm: number | null = null;
    let innerRadiusMm: number | null = null;

    if (!error && standard !== "geometric") {
      if (family === "round_tube") {
        standardAreaMm2 = freeAreaMm2;
      } else if (b != null && h != null && t != null) {
        const standardSection = standardRectangularAreaMm2(standard, b, h, t);
        standardAreaMm2 = standardSection.areaMm2;
        outerRadiusMm = standardSection.outerRadiusMm;
        innerRadiusMm = standardSection.innerRadiusMm;
      }
    }

    const areaMm2 = standard === "geometric" ? freeAreaMm2 : standardAreaMm2;
    const effectiveDensityKgM3 = standard === "geometric" ? rho : 7850;
    const geometricKgM =
      !error && areaMm2 != null && rho != null
        ? (areaMm2 * rho) / 1_000_000
        : null;
    const standardKgM =
      !error && areaMm2 != null
        ? (areaMm2 * 7850) / 1_000_000
        : null;
    const kgM = standard === "geometric" ? geometricKgM : standardKgM;
    const kgBar = kgM != null && l != null ? kgM * l : null;
    const totalKg = kgBar != null && qty != null ? kgBar * qty : null;
    const totalTonnes = totalKg != null ? totalKg / 1000 : null;
    const totalMeters = l != null && qty != null ? l * qty : null;

    const targetBarsExact = targetT != null && targetT > 0 && kgBar != null && kgBar > 0
      ? (targetT * 1000) / kgBar
      : null;
    const targetBars = targetBarsExact != null ? Math.ceil(targetBarsExact) : null;
    const targetMeters = targetBars != null && l != null ? targetBars * l : null;
    const targetActualKg = targetBars != null && kgBar != null ? targetBars * kgBar : null;
    const targetActualTonnes = targetActualKg != null ? targetActualKg / 1000 : null;

    const exactReference = !error && standard === "geometric"
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

    return {
      d, b, h, t, l, qty, targetT, rho, areaMm2, freeAreaMm2, standardAreaMm2,
      outerRadiusMm, innerRadiusMm, effectiveDensityKgM3, kgM, kgBar, totalKg, totalTonnes, totalMeters,
      targetBarsExact, targetBars, targetMeters, targetActualKg, targetActualTonnes,
      exactReference, deltaPercent, error,
    };
  }, [outerDiameter, width, height, thickness, length, quantity, targetTonnes, density, family, standard, references]);

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
                EN 10210 e EN 10219 cambiano realmente il calcolo: per quadri e rettangolari applichiamo i raggi di raccordo previsti dalla norma. Solo “Calcolo libero” usa geometria ideale e densità modificabile.
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
                        ? "group relative overflow-hidden rounded-3xl border border-[#173f35] bg-[#173f35] p-5 text-left text-white shadow-[0_14px_34px_rgba(23,63,53,0.18)] focus-visible:ring-4 focus-visible:ring-[#b8d2c8]"
                        : "group relative overflow-hidden rounded-3xl border border-[#d7e1dd] bg-white p-5 text-left text-[#173f35] hover:-translate-y-0.5 hover:border-[#8fb5a8] hover:shadow-md focus-visible:ring-4 focus-visible:ring-[#d9e8e2]"
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
              <div>
                <p className="school-kicker">3 · Misure</p>
                <h3 id="calculator-measures" className="mt-1 text-xl font-semibold text-[#1d2824]">
                  Inserisci le dimensioni
                </h3>
                <p className="mt-1 text-xs leading-5 text-[#66736e]">
                  La sezione qui sotto cambia insieme alle misure: controlli subito proporzioni, orientamento e spessore.
                </p>
              </div>

              <div className="mt-5">
                <ParametricShapeDiagram
                  family={family}
                  outerDiameter={outerDiameter}
                  width={width}
                  height={height}
                  thickness={thickness}
                  standard={standard}
                />
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
                    <div className="mt-1.5 grid grid-cols-[44px_1fr_44px] gap-2">
                      <button
                        type="button"
                        aria-label="Riduci di una barra"
                        onClick={() => {
                          const current = Math.max(1, Math.floor(parseNumber(quantity) ?? 1));
                          setQuantity(String(Math.max(1, current - 1)));
                        }}
                        className="school-secondary-action flex min-h-12 items-center justify-center px-0 py-0 text-lg"
                      >
                        −
                      </button>
                      <input
                        value={quantity}
                        onChange={(event) => setQuantity(event.target.value)}
                        inputMode="numeric"
                        className="w-full rounded-xl border border-[#cfd9d5] bg-white px-3 py-3 text-center text-base font-semibold text-[#1d2824] outline-none transition focus:border-[#438d7a] focus:ring-4 focus:ring-[#d9e8e2]"
                      />
                      <button
                        type="button"
                        aria-label="Aumenta di una barra"
                        onClick={() => {
                          const current = Math.max(0, Math.floor(parseNumber(quantity) ?? 0));
                          setQuantity(String(current + 1));
                        }}
                        className="school-secondary-action flex min-h-12 items-center justify-center px-0 py-0 text-lg"
                      >
                        +
                      </button>
                    </div>
                  </label>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-[#bed3cb] bg-[#edf5f2] p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-sm font-bold text-[#173f35]">Parti dalle tonnellate</p>
                    <p className="mt-1 text-xs leading-5 text-[#5d6a65]">
                      Inserisci il tonnellaggio che vuoi raggiungere: calcoliamo quante barre intere servono alla lunghezza selezionata.
                    </p>
                  </div>
                  <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-[#1a5144]">
                    Calcolo inverso
                  </span>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                  <label className="text-xs font-semibold text-[#52615b]">
                    Tonnellate target
                    <input
                      value={targetTonnes}
                      onChange={(event) => setTargetTonnes(event.target.value)}
                      inputMode="decimal"
                      placeholder="es. 25"
                      className={inputClass}
                    />
                  </label>

                  <button
                    type="button"
                    disabled={values.targetBars == null}
                    onClick={() => {
                      if (values.targetBars != null) setQuantity(String(values.targetBars));
                    }}
                    className="school-primary-action min-h-12 px-4 py-3 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Usa barre suggerite
                  </button>
                </div>

                <div className="mt-4 grid gap-2 sm:grid-cols-3">
                  <div className="rounded-xl bg-white px-3 py-3">
                    <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#66736e]">Barre necessarie</p>
                    <p className="metric-number mt-1 text-2xl font-semibold text-[#173f35]">
                      {values.targetBars == null ? "—" : formatNumber(values.targetBars, 0)}
                    </p>
                  </div>
                  <div className="rounded-xl bg-white px-3 py-3">
                    <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#66736e]">Metri totali</p>
                    <p className="metric-number mt-1 text-2xl font-semibold text-[#173f35]">
                      {values.targetMeters == null ? "—" : formatNumber(values.targetMeters, 1)}
                      <span className="ml-1 text-sm font-semibold text-[#66736e]">m</span>
                    </p>
                  </div>
                  <div className="rounded-xl bg-white px-3 py-3">
                    <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#66736e]">Tonnellate reali</p>
                    <p className="metric-number mt-1 text-2xl font-semibold text-[#173f35]">
                      {values.targetActualTonnes == null ? "—" : formatNumber(values.targetActualTonnes, 4)}
                      <span className="ml-1 text-sm font-semibold text-[#66736e]">t</span>
                    </p>
                  </div>
                </div>

                {values.targetBarsExact != null && values.targetBars != null ? (
                  <p className="mt-3 text-xs leading-5 text-[#5d6a65]">
                    Calcolo teorico: {formatNumber(values.targetBarsExact, 2)} barre. Per lavorare con barre intere arrotondiamo sempre per eccesso a {values.targetBars}.
                  </p>
                ) : null}
              </div>

              {standard === "geometric" ? (
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
                    <span className="mt-1 block font-normal text-[#66736e]">
                      Nel calcolo libero la densità è modificabile. Default acciaio: 7.850 kg/m³.
                    </span>
                  </label>
                </details>
              ) : (
                <div className="mt-4 rounded-2xl border border-[#d7e1dd] bg-white p-4">
                  <p className="text-sm font-bold text-[#334a42]">Massa secondo {currentStandard.label}</p>
                  <p className="mt-1 text-xs leading-5 text-[#66736e]">
                    Il calcolo usa la geometria di sezione e il coefficiente di massa della norma
                    (equivalente a 7.850 kg/m³). La densità non è modificabile in modalità normativa.
                  </p>
                </div>
              )}

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
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-white/60">
                    {standard === "geometric" ? "Peso al metro · calcolo libero" : `Massa lineare · ${currentStandard.label}`}
                  </p>
                  <p className="metric-number mt-2 text-5xl font-semibold tracking-[-0.05em] sm:text-6xl">
                    {values.kgM == null ? "—" : formatNumber(values.kgM, 3)}
                    <span className="ml-2 text-xl font-semibold tracking-normal text-white/70">kg/m</span>
                  </p>
                </div>
              </div>

              <div className="grid gap-px bg-white/10 sm:grid-cols-3">
                <div className="bg-[#16483d] p-5 sm:p-6">
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-white/60">Peso per barra · {length || "—"} m</p>
                  <p className="metric-number mt-2 text-3xl font-semibold">
                    {values.kgBar == null ? "—" : formatNumber(values.kgBar, 2)}
                    <span className="ml-1 text-base text-white/60">kg</span>
                  </p>
                </div>
                <div className="bg-[#16483d] p-5 sm:p-6">
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-white/60">Metri totali</p>
                  <p className="metric-number mt-2 text-3xl font-semibold">
                    {values.totalMeters == null ? "—" : formatNumber(values.totalMeters, 1)}
                    <span className="ml-1 text-base text-white/60">m</span>
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
                {standard === "geometric" ? (
                  <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold">Riferimento tecnico trovato</p>
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
                          Il risultato resta un calcolo teorico. Non viene trasformato in un riferimento normativo o in un peso verificato solo perché la geometria è matematicamente valida.
                        </p>
                      </>
                    )}
                  </div>
  
  
                ) : (
                  <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold">Metodo della norma applicato</p>
                      <span className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-semibold text-white">
                        {currentStandard.label}
                      </span>
                    </div>
                    {family === "round_tube" ? (
                      <p className="mt-3 text-xs leading-5 text-white/70">
                        Sezione circolare: il peso deriva dall’area della corona circolare e dal coefficiente
                        M = 0,785 × A, con A espresso in cm².
                      </p>
                    ) : (
                      <>
                        <div className="mt-3 grid grid-cols-2 gap-2">
                          <div className="rounded-xl bg-white/10 px-3 py-2">
                            <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-white/60">Raggio esterno rₒ</p>
                            <p className="metric-number mt-1 text-lg font-semibold">
                              {values.outerRadiusMm == null ? "—" : `${formatNumber(values.outerRadiusMm, 2)} mm`}
                            </p>
                          </div>
                          <div className="rounded-xl bg-white/10 px-3 py-2">
                            <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-white/60">Raggio interno rᵢ</p>
                            <p className="metric-number mt-1 text-lg font-semibold">
                              {values.innerRadiusMm == null ? "—" : `${formatNumber(values.innerRadiusMm, 2)} mm`}
                            </p>
                          </div>
                        </div>
                        <p className="mt-3 text-xs leading-5 text-white/70">
                          I raggi di calcolo previsti da {currentStandard.label} entrano nella sezione resistente e
                          quindi nella massa lineare. Per questo SHS/RHS EN 10210 ed EN 10219 possono avere kg/m diversi
                          a parità di dimensioni nominali.
                        </p>
                      </>
                    )}
                    <p className="mt-3 text-xs leading-5 text-white/60">
                      Questo valore alimenta anche peso per barra, tonnellaggio e calcolo inverso. È un calcolo delle
                      proprietà di sezione secondo la norma selezionata, non una certificazione del peso reale della fornitura.
                    </p>
                  </div>
                )}

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
