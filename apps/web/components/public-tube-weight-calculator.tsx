"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { calculatorRfqFromValues, enqueueCalculatorRfq, type CalculatorRfqItem } from "@/lib/calculator-rfq-handoff";
import { tubeCalculatorText, type TubeCalculatorLocale } from "@/lib/tube-calculator-locale";
import { CalculatorInstallGuide } from "@/components/calculator-install-guide";
import { calculateTubeSection, standardCornerRadii } from "@/lib/international-tube-mass";
import { referenceEvidence, relatedTubeReferences, sourceMethodLabel, sourceStandardLabel } from "@/lib/tube-reference-evidence";
import { trackProductEvent } from "@/lib/product-analytics-events.client";
import { trackInternationalRfq } from "@/lib/international-rfq-analytics.client";
import type { PublicTubeDimensionSummary } from "@/lib/public-knowledge";

type TubeFamily = PublicTubeDimensionSummary["product_family"];

export type PublicTubeCalculatorInitialValues = {
  standard?: "en10219" | "en10210" | "geometric";
  family?: TubeFamily;
  outerDiameter?: string;
  width?: string;
  height?: string;
  thickness?: string;
  length?: string;
  quantity?: string;
  targetTonnes?: string;
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

const standardThicknessAssist: Record<
  NormativeStandard,
  { preferred: string; options: readonly string[] }
> = {
  en10210: {
    preferred: "6,3",
    options: ["4", "5", "5,6", "6", "6,3", "7,1", "8", "10"],
  },
  en10219: {
    preferred: "6",
    options: ["3", "4", "5", "6", "6,3", "8", "10"],
  },
};

function preferredThicknessForStandard(standard: StandardValue) {
  return standard === "geometric" ? "6,3" : standardThicknessAssist[standard].preferred;
}

type StoredTubeCalculation = {
  key: string;
  savedAt: string;
  standard: StandardValue;
  family: TubeFamily;
  outerDiameter: string;
  width: string;
  height: string;
  thickness: string;
  length: string;
  quantity: string;
  targetTonnes: string;
  density: string;
  kgM: number;
  kgBar: number;
  totalMeters: number;
  totalTonnes: number;
};

const WC4_RECENTS_KEY = "sss.weightCalculator.recents.v1";
const WC4_FAVORITES_KEY = "sss.weightCalculator.favorites.v1";
const WC4_SAVED_TOOL_KEY = "sss.weightCalculator.savedTool.v1";
const WC4_MAX_RECENTS = 6;
const WC4_MAX_FAVORITES = 8;

function readStoredCalculations(key: string) {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as StoredTubeCalculation[]) : [];
  } catch {
    return [];
  }
}

function writeStoredCalculations(key: string, calculations: StoredTubeCalculation[]) {
  try {
    window.localStorage.setItem(key, JSON.stringify(calculations));
  } catch {
    // Retention is optional: calculator functionality must survive blocked storage.
  }
}

function writeSavedCalculator(calculation: StoredTubeCalculation | null) {
  try {
    if (calculation) {
      window.localStorage.setItem(WC4_SAVED_TOOL_KEY, JSON.stringify(calculation));
    } else {
      window.localStorage.removeItem(WC4_SAVED_TOOL_KEY);
    }
  } catch {
    // A blocked storage layer must never break the calculator.
  }
}

async function copyTextToClipboard(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  document.body.removeChild(textarea);
  if (!copied) throw new Error("Clipboard copy failed");
}

const lengthPresets = ["6", "8", "10", "12"] as const;

function parseNumber(value: string) {
  const normalized = value.trim().replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatNumber(value: number, digits = 3, locale: TubeCalculatorLocale = "it") {
  return new Intl.NumberFormat(({it:"it-IT",en:"en-GB",de:"de-DE",fr:"fr-FR",es:"es-ES"} as const)[locale], {
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
  locale = "it",
}: {
  family: TubeFamily;
  outerDiameter: string;
  width: string;
  height: string;
  thickness: string;
  standard: StandardValue;
  locale?: TubeCalculatorLocale;
}) {
  const formatDiagramNumber = (value: number, digits = 3) => formatNumber(value, digits, locale);
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
      ? `Ø ${formatDiagramNumber(d, 2)} mm`
      : `B ${formatDiagramNumber(b, 2)} mm`;
  const secondaryDimension =
    family === "rectangular_tube" ? `H ${formatDiagramNumber(h, 2)} mm` : null;
  const thicknessDimension = `t ${formatDiagramNumber(t, 2)} mm`;
  const i18n = (key:string) => tubeCalculatorText(key,locale);
  const accessibleLabel =
    family === "round_tube"
      ? `${i18n("Sezione tubo tondo")}, ${i18n("diametro esterno")} ${formatDiagramNumber(d, 2)} ${i18n("millimetri")}, ${i18n("spessore")} ${formatDiagramNumber(t, 2)} ${i18n("millimetri")}`
      : family === "square_tube"
        ? `${i18n("Sezione profilo quadro")}, ${i18n("lato")} ${formatDiagramNumber(b, 2)} ${i18n("millimetri")}, ${i18n("spessore")} ${formatDiagramNumber(t, 2)} ${i18n("millimetri")}`
        : `${i18n("Sezione profilo rettangolare")}, ${i18n("base")} ${formatDiagramNumber(b, 2)} ${i18n("millimetri")}, ${i18n("altezza")} ${formatDiagramNumber(h, 2)} ${i18n("millimetri")}, ${i18n("spessore")} ${formatDiagramNumber(t, 2)} ${i18n("millimetri")}`;

  return (
    <figure className="rounded-2xl border border-[#d3e1dc] bg-white p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#1a5144]">{i18n("Vista proporzionale")}</p>
          <p className="sr-only">{i18n("Le quote seguono i valori inseriti e lo spessore viene rappresentato in proporzione.")}</p>
        </div>
        <span className="rounded-full bg-[#edf5f2] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-[#1a5144]">
          {standard === "geometric" ? i18n("Libero") : standard === "en10210" ? "EN 10210" : "EN 10219"}
        </span>
      </div>

      <svg
        viewBox="0 0 264 210"
        role="img"
        aria-label={accessibleLabel}
        className="mx-auto mt-2 block h-auto w-full max-w-[13rem] lg:max-w-[15rem]"
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

      <figcaption className="mt-1 grid grid-cols-3 gap-1 border-t border-[#e4ebe8] pt-2 text-[10px]">
        <span className="rounded-lg bg-[#f6f8f7] px-2 py-1.5 font-semibold text-[#405049]">{primaryDimension}</span>
        {secondaryDimension ? (
          <span className="rounded-lg bg-[#f6f8f7] px-2 py-1.5 font-semibold text-[#405049]">{secondaryDimension}</span>
        ) : (
          <span className="rounded-lg bg-[#f6f8f7] px-2 py-1.5 font-semibold text-[#405049]">
            {family === "round_tube" ? i18n("Sezione circolare") : i18n("Sezione quadrata")}
          </span>
        )}
        <span className="rounded-lg bg-[#fbf0e9] px-2 py-1.5 font-semibold text-[#8b4a25]">{thicknessDimension}</span>
      </figcaption>
    </figure>
  );
}

export function PublicTubeWeightCalculator({
  references,
  initialValues,
  locale = "it",
  onAddToDistinta,
  canAddToDistinta = true,
}: {
  references: PublicTubeDimensionSummary[];
  initialValues?: PublicTubeCalculatorInitialValues;
  locale?: TubeCalculatorLocale;
  /** In-place RFQ bill composer; does not queue or navigate. */
  onAddToDistinta?: (item: CalculatorRfqItem) => boolean;
  canAddToDistinta?: boolean;
}) {
  const t = (text: string) => tubeCalculatorText(text, locale);
  const formatOutput = (value: number, digits = 3) => formatNumber(value, digits, locale);
  const initialStandard = initialValues?.standard ?? "en10219";
  const [standard, setStandard] = useState<StandardValue>(initialStandard);
  const [family, setFamily] = useState<TubeFamily>(initialValues?.family ?? "round_tube");
  const [outerDiameter, setOuterDiameter] = useState(initialValues?.outerDiameter ?? "168,3");
  const [width, setWidth] = useState(initialValues?.width ?? "100");
  const [height, setHeight] = useState(initialValues?.height ?? "60");
  const [thickness, setThickness] = useState(
    initialValues?.thickness ?? preferredThicknessForStandard(initialStandard),
  );
  const [thicknessTouched, setThicknessTouched] = useState(Boolean(initialValues?.thickness));
  const [length, setLength] = useState(initialValues?.length ?? "12");
  const [quantity, setQuantity] = useState(initialValues?.quantity ?? "1");
  const [targetTonnes, setTargetTonnes] = useState(initialValues?.targetTonnes ?? "");
  const [density, setDensity] = useState(initialValues?.density ?? "7850");
  // These stateful device conveniences remain available in the collapsed panel
  // BELOW the calculator, independently of the removed language controls.
  const [referenceQuery, setReferenceQuery] = useState("");
  const [recentCalculations, setRecentCalculations] = useState<StoredTubeCalculation[]>([]);
  const [favoriteCalculations, setFavoriteCalculations] = useState<StoredTubeCalculation[]>([]);
  const [calculatorSaved, setCalculatorSaved] = useState(false);
  const [retentionReady, setRetentionReady] = useState(false);
  const [actionFeedback, setActionFeedback] = useState("");
  const calculationInteractedRef = useRef(false);
  const lastTrackedCalculationKeyRef = useRef<string | null>(null);

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

    // One mathematical source of truth for the IT/EN calculator and EN RFQ.
    // Keep localized validation messages and bar/target UX in this component.
    const section = !error && t != null
      ? calculateTubeSection({
          shape: family === "round_tube" ? "round" : family === "square_tube" ? "square" : "rectangular",
          standard,
          outerDiameterMm: d ?? undefined,
          widthMm: b ?? undefined,
          heightMm: h ?? undefined,
          thicknessMm: t,
          densityKgM3: rho ?? undefined,
        })
      : null;
    if (section && !section.ok) {
      if (family === "round_tube") {
        error = d == null || d <= 0 ? "Inserisci un diametro esterno valido."
          : t != null && 2 * t >= d ? "Lo spessore deve essere inferiore a metà del diametro."
          : section.error;
      } else if (family === "square_tube") {
        error = b == null || b <= 0 ? "Inserisci il lato esterno."
          : t != null && 2 * t >= b ? "Lo spessore deve essere inferiore a metà del lato."
          : section.error;
      } else {
        error = b == null || b <= 0 || h == null || h <= 0 ? "Inserisci base e altezza esterne."
          : t != null && 2 * t >= Math.min(b, h) ? "Lo spessore deve essere inferiore a metà del lato minore."
          : section.error;
      }
    }
    const validSection = section?.ok ? section : null;
    const freeAreaMm2 = validSection?.freeAreaMm2 ?? null;
    const standardAreaMm2 = validSection?.standardAreaMm2 ?? null;
    const outerRadiusMm = validSection?.outerRadiusMm ?? null;
    const innerRadiusMm = validSection?.innerRadiusMm ?? null;
    const areaMm2 = validSection?.areaMm2 ?? null;
    const effectiveDensityKgM3 = validSection?.densityKgM3 ?? (standard === "geometric" ? rho : 7850);
    const kgM = validSection?.weightKgM ?? null;
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

  const currentSnapshot = useMemo<StoredTubeCalculation | null>(() => {
    if (
      values.error ||
      values.kgM == null ||
      values.kgBar == null ||
      values.totalMeters == null ||
      values.totalTonnes == null
    ) {
      return null;
    }

    const key = [
      standard,
      family,
      outerDiameter.trim(),
      width.trim(),
      height.trim(),
      thickness.trim(),
      length.trim(),
      quantity.trim(),
      targetTonnes.trim(),
      standard === "geometric" ? density.trim() : "7850",
    ].join("|");

    return {
      key,
      savedAt: new Date().toISOString(),
      standard,
      family,
      outerDiameter,
      width,
      height,
      thickness,
      length,
      quantity,
      targetTonnes,
      density,
      kgM: values.kgM,
      kgBar: values.kgBar,
      totalMeters: values.totalMeters,
      totalTonnes: values.totalTonnes,
    };
  }, [
    values.error,
    values.kgM,
    values.kgBar,
    values.totalMeters,
    values.totalTonnes,
    standard,
    family,
    outerDiameter,
    width,
    height,
    thickness,
    length,
    quantity,
    targetTonnes,
    density,
  ]);

  function restoreCalculation(calculation: StoredTubeCalculation) {
    setStandard(calculation.standard);
    setFamily(calculation.family);
    setOuterDiameter(calculation.outerDiameter);
    setWidth(calculation.width);
    setHeight(calculation.height);
    setThickness(calculation.thickness);
    setThicknessTouched(true);
    setLength(calculation.length);
    setQuantity(calculation.quantity);
    setTargetTonnes(calculation.targetTonnes);
    setDensity(calculation.density);
    setActionFeedback("Calcolo ripristinato.");
  }

  function handleStandardChange(nextStandard: StandardValue) {
    setStandard(nextStandard);
    if (nextStandard !== "geometric" && !thicknessTouched) {
      setThickness(preferredThicknessForStandard(nextStandard));
    }
  }

  function handlePrimaryDimensionChange(
    setter: (nextValue: string) => void,
    nextValue: string,
  ) {
    setter(nextValue);
    if (
      standard !== "geometric" &&
      !thicknessTouched &&
      (parseNumber(nextValue) ?? 0) > 0
    ) {
      setThickness(preferredThicknessForStandard(standard));
    }
  }

  function applyCommercialThickness(nextThickness: string) {
    setThickness(nextThickness);
    setThicknessTouched(true);
  }

  function calculationDimensionLabel(calculation: StoredTubeCalculation) {
    if (calculation.family === "round_tube") {
      return `Ø ${calculation.outerDiameter} × ${calculation.thickness} mm`;
    }
    if (calculation.family === "square_tube") {
      return `${calculation.width} × ${calculation.width} × ${calculation.thickness} mm`;
    }
    return `${calculation.width} × ${calculation.height} × ${calculation.thickness} mm`;
  }

  function calculationStandardLabel(calculation: StoredTubeCalculation) {
    return t(standardOptions.find((option) => option.value === calculation.standard)?.label ?? calculation.standard);
  }

  function resultText(calculation: StoredTubeCalculation) {
    return [
      `Smart Steel Sales · ${calculationStandardLabel(calculation)}`,
      calculationDimensionLabel(calculation),
      `${formatOutput(calculation.kgM, 3)} kg/m`,
      `${formatOutput(calculation.kgBar, 2)} ${t("kg/barra")} · ${calculation.length} m`,
      `${calculation.quantity} ${t("barre")} · ${formatOutput(calculation.totalMeters, 1)} m · ${formatOutput(calculation.totalTonnes, 4)} t`,
    ].join("\n");
  }

  function shareUrl(calculation: StoredTubeCalculation) {
    const params = new URLSearchParams();
    params.set("standard", calculation.standard);
    params.set("family", calculation.family);
    if (calculation.family === "round_tube") {
      params.set("od", calculation.outerDiameter);
    } else {
      params.set("width", calculation.width);
      if (calculation.family === "rectangular_tube") params.set("height", calculation.height);
    }
    params.set("thickness", calculation.thickness);
    params.set("length", calculation.length);
    params.set("quantity", calculation.quantity);
    if (calculation.targetTonnes.trim()) params.set("target", calculation.targetTonnes);
    if (calculation.standard === "geometric") params.set("density", calculation.density);
    return `${window.location.origin}${window.location.pathname}?${params.toString()}#calcolatore-pesi`;
  }

  function saveFavorites(next: StoredTubeCalculation[]) {
    setFavoriteCalculations(next);
    writeStoredCalculations(WC4_FAVORITES_KEY, next);
  }

  useEffect(() => {
    const recents = readStoredCalculations(WC4_RECENTS_KEY).slice(0, WC4_MAX_RECENTS);
    const favorites = readStoredCalculations(WC4_FAVORITES_KEY).slice(0, WC4_MAX_FAVORITES);
    setRecentCalculations(recents);
    setFavoriteCalculations(favorites);

    try {
      const savedRaw = window.localStorage.getItem(WC4_SAVED_TOOL_KEY);
      if (savedRaw) {
        const saved = JSON.parse(savedRaw) as StoredTubeCalculation;
        setCalculatorSaved(true);
        const params = new URLSearchParams(window.location.search);
        const hasSharedState = [
          "standard", "family", "od", "width", "height", "thickness", "length", "quantity", "density", "target",
        ].some((key) => params.has(key));
        if (!hasSharedState && saved?.key) restoreCalculation(saved);
      }
    } catch {
      // Ignore invalid/blocked local retention state.
    }

    setRetentionReady(true);
  }, []);

  useEffect(() => {
    if (!retentionReady || !currentSnapshot) return;

    const timeout = window.setTimeout(() => {
      setRecentCalculations((current) => {
        const next = [
          { ...currentSnapshot, savedAt: new Date().toISOString() },
          ...current.filter((item) => item.key !== currentSnapshot.key),
        ].slice(0, WC4_MAX_RECENTS);
        writeStoredCalculations(WC4_RECENTS_KEY, next);
        return next;
      });
    }, 800);

    return () => window.clearTimeout(timeout);
  }, [retentionReady, currentSnapshot]);

  useEffect(() => {
    if (
      !retentionReady ||
      !currentSnapshot ||
      !calculationInteractedRef.current ||
      lastTrackedCalculationKeyRef.current === currentSnapshot.key
    ) {
      return;
    }

    const timeout = window.setTimeout(() => {
      trackProductEvent("weight_calculation", {
        standard: currentSnapshot.standard,
        family: currentSnapshot.family,
      });
      lastTrackedCalculationKeyRef.current = currentSnapshot.key;
    }, 1200);

    return () => window.clearTimeout(timeout);
  }, [retentionReady, currentSnapshot]);

  const currentIsFavorite =
    currentSnapshot != null && favoriteCalculations.some((item) => item.key === currentSnapshot.key);

  useEffect(() => {
    if (!retentionReady || !calculatorSaved || !currentSnapshot) return;
    writeSavedCalculator({ ...currentSnapshot, savedAt: new Date().toISOString() });
  }, [retentionReady, calculatorSaved, currentSnapshot]);

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
  // Only matching, explicitly documented product standards are comparable.
  const contextualReferences = relatedTubeReferences(references, {
    family, outerDiameter: values.d, width: values.b, height: values.h,
    thickness: values.t, standard,
  });
  const currentFamily = familyOptions.find((option) => option.value === family) ?? familyOptions[0];
  const currentStandard = standardOptions.find((option) => option.value === standard) ?? standardOptions[0];
  const standardAssist =
    standard === "geometric" ? null : standardThicknessAssist[standard];
  const primaryDimensionValue =
    family === "round_tube" ? parseNumber(outerDiameter) : parseNumber(width);
  const canShowStandardAssist =
    standardAssist != null && primaryDimensionValue != null && primaryDimensionValue > 0;

  function commercialSuggestionLabel(candidateThickness: string) {
    if (family === "round_tube") {
      return `Ø ${outerDiameter} × ${candidateThickness}`;
    }
    if (family === "square_tube") {
      return `${width} × ${width} × ${candidateThickness}`;
    }
    const parsedHeight = parseNumber(height);
    return parsedHeight != null && parsedHeight > 0
      ? `${width} × ${height} × ${candidateThickness}`
      : `B ${width} × t ${candidateThickness}`;
  }

  const inputClass =
    "mt-1 min-h-11 w-full rounded-xl border border-[#cfd9d5] bg-white px-3 py-2 text-sm font-semibold text-[#1d2824] outline-none transition focus:border-[#438d7a] focus:ring-4 focus:ring-[#d9e8e2]";

  return (
    <div
      className="space-y-5"
      onChangeCapture={() => {
        calculationInteractedRef.current = true;
      }}
    >
      <section
        id="calcolatore-pesi"
        className="flex scroll-mt-20 flex-col overflow-hidden rounded-[1.6rem] border border-[#cddbd6] bg-white shadow-[0_18px_60px_rgba(11,47,39,0.08)]"
      >
        <header className="flex flex-col items-stretch gap-2 border-b border-[#dce7e3] bg-[linear-gradient(135deg,#f7fbf9_0%,#ffffff_62%,#edf5f2_100%)] px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:px-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="school-eyebrow hidden sm:inline-flex">{t("Calcolatore pesi")}</span>
              <span className="school-badge">{t("Gratis")}</span>
              <span className="school-badge hidden sm:inline-flex">{t("Live")}</span>
            </div>
            {onAddToDistinta || locale === "de" || locale === "fr" || locale === "es" ? <h2 className="mt-1 text-lg font-semibold text-[#15372f]">{t("Peso tubo acciaio")}</h2> : <h1 className="mt-1 break-words text-lg font-semibold tracking-[-0.025em] text-[#15372f] sm:text-xl">{t("Peso tubo acciaio")}</h1>}
          </div>

        </header>


        <div className={onAddToDistinta ? "grid min-w-0 grid-cols-1" : "grid min-w-0 grid-cols-1 lg:grid-cols-[minmax(0,1.08fr)_minmax(330px,0.92fr)]"}>
          <div className="min-w-0 border-b border-[#dce7e3] p-3 sm:p-4 lg:border-b-0 lg:border-r">
            <div className="grid gap-3 lg:grid-rows-[auto_auto_1fr_auto]">
              <section aria-labelledby="calculator-standard">
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <h2 id="calculator-standard" className="text-[10px] font-extrabold uppercase tracking-[0.13em] text-[#52615b]">
                    {t("Norma")}
                  </h2>
                  <span className="text-xs font-semibold text-[#52615b]">
                    {t(standard === "geometric" ? "Geometria libera" : "Massa da norma")}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {standardOptions.map((option) => {
                    const selected = standard === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => handleStandardChange(option.value)}
                        className={
                          selected
                            ? "school-selected-control min-h-11 rounded-xl px-1.5 py-2 text-center text-[11px] font-bold leading-tight shadow-sm sm:px-2 sm:text-xs"
                            : "min-h-11 rounded-xl border border-[#d7e1dd] bg-[#f8faf9] px-1.5 py-2 text-center text-[11px] font-bold leading-tight text-[#334a42] hover:border-[#8fb5a8] hover:bg-[#f1f7f4]"
                        }
                      >
                        {t(option.label)}
                        <span className="sr-only"> — {t(option.description)}</span>
                      </button>
                    );
                  })}
                </div>
              </section>

              <section aria-labelledby="calculator-shape">
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <h2 id="calculator-shape" className="text-[10px] font-extrabold uppercase tracking-[0.13em] text-[#52615b]">
                    {t("Sagoma")}
                  </h2>
                  <span className="text-xs font-semibold text-[#52615b]">{t(currentFamily.description)}</span>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
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
                            ? "group flex min-h-14 items-center justify-center min-w-0 flex-col gap-1 rounded-xl border border-[#173f35] bg-[#173f35] px-1 py-2 text-white shadow-sm sm:flex-row sm:px-2 focus-visible:ring-4 focus-visible:ring-[#b8d2c8]"
                            : "group flex min-h-14 items-center justify-center min-w-0 flex-col gap-1 rounded-xl border border-[#d7e1dd] bg-white px-1 py-2 text-[#173f35] sm:flex-row sm:px-2 hover:-translate-y-0.5 hover:border-[#8fb5a8] focus-visible:ring-4 focus-visible:ring-[#d9e8e2]"
                        }
                      >
                        <ShapeGraphic family={option.value} className={selected ? "h-9 w-10 text-white" : "h-9 w-10 text-[#1a5144]"} />
                        <span className="text-[11px] font-bold leading-tight sm:text-xs">{t(option.short)}</span>
                      </button>
                    );
                  })}
                </div>
              </section>

              <section
                aria-labelledby="calculator-measures"
                className="grid min-h-0 gap-3 lg:grid-cols-[minmax(0,1fr)_220px] lg:items-center"
              >
                <div className="min-w-0">
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <h2 id="calculator-measures" className="text-[10px] font-extrabold uppercase tracking-[0.13em] text-[#52615b]">
                      {t("Misure")}
                    </h2>
                    <span className="text-xs text-[#52615b]">mm</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {family === "round_tube" ? (
                      <label className="text-[10px] font-bold text-[#52615b]">
                        {t("Diametro D")}
                        <input
                          value={outerDiameter}
                          onChange={(event) => handlePrimaryDimensionChange(setOuterDiameter, event.target.value)}
                          inputMode="decimal"
                          className={inputClass}
                        />
                      </label>
                    ) : (
                      <label className="text-[10px] font-bold text-[#52615b]">
                        {t(family === "square_tube" ? "Lato B" : "Base B")}
                        <input
                          value={width}
                          onChange={(event) => handlePrimaryDimensionChange(setWidth, event.target.value)}
                          inputMode="decimal"
                          className={inputClass}
                        />
                      </label>
                    )}

                    {family === "rectangular_tube" ? (
                      <label className="text-[10px] font-bold text-[#52615b]">
                        {t("Altezza H")}
                        <input
                          value={height}
                          onChange={(event) => setHeight(event.target.value)}
                          inputMode="decimal"
                          className={inputClass}
                        />
                      </label>
                    ) : null}

                    <label className="text-[10px] font-bold text-[#52615b]">
                      {t("Spessore t")}
                      <input
                        value={thickness}
                        onChange={(event) => {
                          setThickness(event.target.value);
                          setThicknessTouched(true);
                        }}
                        inputMode="decimal"
                        className={inputClass}
                      />
                    </label>

                    {standard === "geometric" ? (
                      <label className="text-[10px] font-bold text-[#52615b]">
                        {t("Densità kg/m³")}
                        <input
                          value={density}
                          onChange={(event) => setDensity(event.target.value)}
                          inputMode="decimal"
                          className={inputClass}
                        />
                        <span className="sr-only">{t("Nel calcolo libero la densità è modificabile. Default acciaio: 7.850 kg/m³.")}</span>
                      </label>
                    ) : null}
                  </div>

                  {canShowStandardAssist && standardAssist ? (
                    <div className="mt-2 flex min-w-0 items-center gap-2 rounded-xl border border-[#d4e0db] bg-[#f6f8f7] px-2 py-1.5">
                      <div className="shrink-0">
                        <p className="text-[11px] font-extrabold uppercase tracking-[0.1em] text-[#1a5144]">
                          {t("Spessori suggeriti")} · {currentStandard.label}
                        </p>
                        <p className="text-[11px] text-[#66736e]">
                          {t("preferito")} {standardAssist.preferred} mm
                        </p>
                      </div>
                      <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto pb-0.5">
                        {standardAssist.options.map((candidate) => {
                          const selected = near(parseNumber(thickness), parseNumber(candidate));
                          const preferred = candidate === standardAssist.preferred;
                          return (
                            <button
                              key={candidate}
                              type="button"
                              aria-pressed={selected}
                              aria-label={`${commercialSuggestionLabel(candidate)} mm${preferred ? `, ${t("spessore commerciale preferito")}` : ""}`}
                              onClick={() => applyCommercialThickness(candidate)}
                              className={
                                selected
                                  ? "school-selected-control min-h-11 shrink-0 rounded-lg px-3 py-2 text-xs font-bold"
                                  : preferred
                                    ? "min-h-11 shrink-0 rounded-lg border border-[#8fb5a8] bg-white px-3 py-2 text-xs font-bold text-[#173f35]"
                                    : "min-h-11 shrink-0 rounded-lg border border-[#d7e1dd] bg-white px-3 py-2 text-xs font-semibold text-[#52615b] hover:border-[#8fb5a8]"
                              }
                            >
                              {commercialSuggestionLabel(candidate)}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}

                  <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-[1.35fr_0.85fr]">
                    <div>
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <span className="text-[10px] font-bold text-[#52615b]">{t("Lunghezza barra")}</span>
                        <span className="text-xs text-[#52615b]">m</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {lengthPresets.map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            aria-pressed={length === preset}
                             onClick={() => setLength(preset)}
                            className={
                              length === preset
                                ? "school-selected-control min-h-11 min-w-11 flex-1 rounded-xl px-2 py-2.5 text-xs font-bold"
                                : "school-secondary-action min-h-11 min-w-11 flex-1 px-2 py-2.5 text-xs"
                            }
                          >
                            {preset}
                          </button>
                        ))}
                        <input
                          value={length}
                          onChange={(event) => setLength(event.target.value)}
                          inputMode="decimal"
                          aria-label={t("Lunghezza barra personalizzata")}
                          className="min-h-11 min-w-14 flex-1 rounded-xl border border-[#cfd9d5] bg-white px-2 text-center text-sm font-bold text-[#1d2824] outline-none focus:border-[#438d7a]"
                        />
                      </div>
                    </div>

                    <div className="text-xs font-bold text-[#52615b]">
                      <label htmlFor="tube-calculator-quantity">{t("Numero barre")}</label>
                      <div className="mt-1 grid grid-cols-[44px_minmax(0,1fr)_44px] gap-1">
                        <button
                          type="button"
                          aria-label={t("Riduci di una barra")}
                          onClick={() => {
                            const current = Math.max(1, Math.floor(parseNumber(quantity) ?? 1));
                            setQuantity(String(Math.max(1, current - 1)));
                          }}
                          className="school-secondary-action min-h-11 px-0 py-0 text-base"
                        >
                          −
                        </button>
                        <input
                          id="tube-calculator-quantity"
                          aria-label={t("Numero barre")}
                          value={quantity}
                          onChange={(event) => setQuantity(event.target.value)}
                          inputMode="numeric"
                          className="min-h-11 min-w-0 rounded-xl border border-[#cfd9d5] bg-white px-2 text-center text-sm font-bold text-[#1d2824] outline-none focus:border-[#438d7a]"
                        />
                        <button
                          type="button"
                          aria-label={t("Aumenta di una barra")}
                          onClick={() => {
                            const current = Math.max(0, Math.floor(parseNumber(quantity) ?? 0));
                            setQuantity(String(current + 1));
                          }}
                          className="school-secondary-action min-h-11 px-0 py-0 text-base"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 rounded-xl border border-[#bed3cb] bg-[#edf5f2] p-2.5">
                    <div className="grid grid-cols-1 items-end gap-2 sm:grid-cols-[1fr_auto]">
                      <label className="text-[10px] font-bold text-[#52615b]">
                        {t("Parti dalle tonnellate · Tonnellate target")}
                        <input
                          value={targetTonnes}
                          onChange={(event) => setTargetTonnes(event.target.value)}
                          inputMode="decimal"
                          placeholder={t("es. 25")}
                          className={inputClass}
                        />
                      </label>
                      <button
                        type="button"
                        disabled={values.targetBars == null}
                        onClick={() => {
                          if (values.targetBars != null) setQuantity(String(values.targetBars));
                        }}
                        className="school-primary-action min-h-11 w-full px-3 py-2 text-xs disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                      >
                        {t("Usa barre suggerite")}
                      </button>
                    </div>
                    <p className="sr-only">
                      {t("Barre necessarie")}: {values.targetBars ?? "—"}. {t("Tonnellate reali")}: {values.targetActualTonnes ?? "—"}.
                      {t("Per lavorare con barre intere arrotondiamo sempre per eccesso.")}
                    </p>
                  </div>

                  {values.error ? (
                    <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-800">
                      {t(values.error)}
                    </p>
                  ) : null}
                </div>

                <div className="hidden lg:block">
                  <ParametricShapeDiagram
                    family={family}
                    outerDiameter={outerDiameter}
                    width={width}
                    height={height}
                    thickness={thickness}
                    standard={standard}
                    locale={locale}
                  />
                </div>
              </section>

              <div className="hidden text-xs text-[#66736e] lg:flex lg:items-center lg:justify-between">
                <span>{t("Il risultato si aggiorna mentre scrivi.")}</span>
                <span>{t(standard === "geometric" ? "Densità modificabile" : "La densità non è modificabile in modalità normativa.")}</span>
              </div>
            </div>
          </div>

          <aside
            className="tube-calculator-result flex min-w-0 flex-col bg-[#123d34] text-white"
          >
            <div className="shrink-0 border-b border-white/10 px-3 py-3 sm:px-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/85">
                    {standard === "geometric" ? t("Peso al metro · calcolo libero") : `${t("Massa lineare")} · ${currentStandard.label}`}
                  </p>
                  <p aria-live="polite" aria-atomic="true" className="metric-number mt-1 break-words text-4xl font-semibold tracking-[-0.05em] sm:text-5xl">
                    {values.kgM == null ? "—" : formatOutput(values.kgM, 3)}
                    <span className="ml-1 text-base font-semibold tracking-normal text-white/85">kg/m</span>
                  </p>
                </div>
                <span className="rounded-full border border-white/15 bg-white/10 px-2 py-1 text-[10px] font-bold">
                  {t(currentFamily.short)}
                </span>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                <div className="rounded-xl bg-white/8 p-2">
                  <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-white/85">{t("Peso per barra")}</p>
                  <p className="metric-number mt-1 text-lg font-semibold">
                    {values.kgBar == null ? "—" : formatOutput(values.kgBar, 2)}
                    <span className="ml-1 text-[10px] text-white/85">kg</span>
                  </p>
                </div>
                <div className="rounded-xl bg-white/8 p-2">
                  <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-white/85">{t("Metri totali")}</p>
                  <p className="metric-number mt-1 text-lg font-semibold">
                    {values.totalMeters == null ? "—" : formatOutput(values.totalMeters, 1)}
                    <span className="ml-1 text-[10px] text-white/85">m</span>
                  </p>
                </div>
                <div className="col-span-2 min-w-0 rounded-xl bg-white/8 p-2 sm:col-span-1">
                  <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-white/85">{t("Peso totale")}</p>
                  <p className="metric-number mt-1 text-lg font-semibold">
                    {values.totalTonnes == null ? "—" : formatOutput(values.totalTonnes, 4)}
                    <span className="ml-1 text-[10px] text-white/85">t</span>
                  </p>
                </div>
              </div>

              {values.targetBars != null ? (
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white/10 px-3 py-2 text-xs">
                  <span>{t("Barre necessarie")} <strong>{values.targetBars}</strong></span>
                  <span>{t("Tonnellate reali")} <strong>{values.targetActualTonnes == null ? "—" : formatOutput(values.targetActualTonnes, 4)} t</strong></span>
                </div>
              ) : null}
            </div>

            <div className="min-w-0 flex-1 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:p-4 sm:pb-[calc(1rem+env(safe-area-inset-bottom))]">
              {!onAddToDistinta ? <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                <button
                  type="button"
                  disabled={!currentSnapshot}
                  onClick={async () => {
                    if (!currentSnapshot) return;
                    try {
                      await copyTextToClipboard(resultText(currentSnapshot));
                      setActionFeedback("Risultato copiato.");
                    } catch {
                      setActionFeedback(t("Copia non riuscita: controlla i permessi degli appunti."));
                    }
                  }}
                  className="tube-calculator-copy-action min-h-11 rounded-xl border border-white/30 bg-white/10 px-2 py-2 text-xs font-bold text-white hover:bg-white/15 disabled:opacity-40 sm:text-xs"
                >
                  {t("Copia risultato")}
                </button>
                <button
                  type="button"
                  disabled={!currentSnapshot}
                  onClick={async () => {
                    if (!currentSnapshot) return;
                    try {
                      await copyTextToClipboard(shareUrl(currentSnapshot));
                      setActionFeedback("Link condivisibile copiato.");
                    } catch {
                      setActionFeedback(t("Copia non riuscita: controlla i permessi degli appunti."));
                    }
                  }}
                  className="min-h-11 rounded-xl border border-white/30 bg-white/10 px-2 py-2 text-xs font-bold text-white hover:bg-white/15 disabled:opacity-40"
                >
                  {t("Copia link")}
                </button>
                <button
                  type="button"
                  disabled={!currentSnapshot}
                  aria-pressed={currentIsFavorite}
                  onClick={() => {
                    if (!currentSnapshot) return;
                    if (currentIsFavorite) {
                      saveFavorites(favoriteCalculations.filter((item) => item.key !== currentSnapshot.key));
                      setActionFeedback("Rimosso dai preferiti.");
                    } else {
                      const next = [
                        { ...currentSnapshot, savedAt: new Date().toISOString() },
                        ...favoriteCalculations.filter((item) => item.key !== currentSnapshot.key),
                      ].slice(0, WC4_MAX_FAVORITES);
                      saveFavorites(next);
                      setActionFeedback("Calcolo aggiunto ai preferiti.");
                    }
                  }}
                  className={
                    currentIsFavorite
                      ? "tube-calculator-favourite-selected col-span-2 min-h-11 rounded-xl border border-white bg-white px-2 py-2 text-xs font-bold sm:col-span-1 text-[#123d34] sm:text-xs"
                      : "col-span-2 min-h-11 rounded-xl border border-white/30 bg-white/10 px-2 py-2 text-xs font-bold text-white hover:bg-white/15 disabled:opacity-40 sm:col-span-1"
                  }
                >
                  {t(currentIsFavorite ? "Preferito ★" : "Aggiungi ai preferiti ☆")}
                </button>
              </div> : null}

              <button
                type="button"
                disabled={!currentSnapshot || (Boolean(onAddToDistinta) && !canAddToDistinta)}
                onClick={() => {
                  if (!currentSnapshot) return;
                  const item = calculatorRfqFromValues(currentSnapshot,
                    typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : "calc-"+Date.now()+"-"+Math.random().toString(36).slice(2));
                  if (onAddToDistinta) {
                    if (!item || !onAddToDistinta(item)) {
                      setActionFeedback("Impossibile aggiungere la riga: controlla la quantità o lo spazio disponibile.");
                    } else {
                      setActionFeedback("Articolo aggiunto ✓ · puoi continuare con un’altra misura.");
                    }
                    return;
                  }
                  if (!item || !enqueueCalculatorRfq(window.sessionStorage, item)) {
                    setActionFeedback(t("Impossibile trasferire l'articolo. Verifica lo spazio di sessione del browser e riprova."));
                    return;
                  }
                  // CALC-INT3E.7: preserve the existing consent-gated EN/DE/FR/ES
                  // handoff event after successful enqueue (never send RFQ content).
                  if (locale !== "it") trackInternationalRfq("handoff",locale,{system:"eu",standard});
                  // The queue stays in this tab only: no calculator data in URLs or requests.
                  window.location.assign(locale === "it" ? "/distinta" : `/${locale}/distinta`);
                }}
                className="tube-calculator-rfq-link mt-2 inline-flex min-h-12 w-full items-center justify-center rounded-xl border border-[#c3e5d5] bg-[#e3f4eb] px-4 py-3 text-center text-sm font-bold leading-snug text-[#123b34] hover:bg-[#ccebdc] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm"
              >
                {t(onAddToDistinta ? "＋ Aggiungi alla distinta" : "Aggiungi questa misura alla distinta →")}
              </button>
              <p className="mt-1 text-[11px] leading-4 text-white/85">
                {t(onAddToDistinta ? "Il peso è teorico: la riga appare subito a fianco, senza inviare una RFQ." : "Gratuito · nessun login richiesto. Il grado acciaio resta da confermare.")}
              </p>
              <p aria-live="polite" className="mt-2 min-h-4 text-xs font-semibold text-white/85">
                {t(actionFeedback)}
              </p>

              <details className="mt-2 rounded-xl border border-white/10 bg-white/5">
                <summary className="flex min-h-11 cursor-pointer items-center px-3 py-2 text-xs font-bold">
                  {t("Metodo e provenienza")}
                </summary>
                <div className="border-t border-white/10 px-3 py-2 text-xs leading-5 text-white/85">
                  {standard === "geometric" ? (
                    <>
                      <p className="font-semibold text-white">{t("Riferimento tecnico trovato")}</p>
                      {values.exactReference ? (
                        <>
                          <p className="mt-1">{formatOutput(values.exactReference.weight_kg_m, 3)} kg/m · {sourceMethodLabel(referenceEvidence(values.exactReference).declaredMethod, locale === "it" ? "it" : "en")}</p>
                          <p className="mt-1">{t("Norma del documento")}: {sourceStandardLabel(referenceEvidence(values.exactReference).standard, locale === "it" ? "it" : "en")} · {t("confronto geometrico, non equivalenza di prodotto")}</p>
                          {values.deltaPercent != null ? <p>{t("Scostamento rispetto al calcolo geometrico:")} {formatOutput(values.deltaPercent, 2)}%.</p> : null}
                          {values.exactReference.source_url ? (
                            <a href={values.exactReference.source_url} target="_blank" rel="noreferrer" className="mt-1 inline-flex underline">
                              {values.exactReference.source_provider ?? t("Fonte")} ↗
                            </a>
                          ) : null}
                        </>
                      ) : (
                        <>
                          <p className="mt-1 font-semibold text-white">{t("Nessun peso pubblicato per questa geometria")}</p>
                          <p>{t("Il risultato resta un calcolo teorico. Non viene trasformato in un riferimento normativo o in un peso verificato solo perché la geometria è matematicamente valida.")}</p>
                        </>
                      )}
                    </>
                  ) : (
                    <>
                      <p className="font-semibold text-white">{t("Metodo della norma applicato")} · {currentStandard.label}</p>
                      {family !== "round_tube" ? (
                        <p className="mt-1">
                          rₒ {values.outerRadiusMm == null ? "—" : formatOutput(values.outerRadiusMm, 2)} mm · rᵢ {values.innerRadiusMm == null ? "—" : formatOutput(values.innerRadiusMm, 2)} mm
                        </p>
                      ) : null}
                      <p className="mt-1">
                        {t("Questo valore alimenta anche peso per barra, tonnellaggio e calcolo inverso.")}
                      </p>
                    </>
                  )}
                  <p className="mt-1">{t("Area sezione:")} {values.areaMm2 == null ? "—" : `${formatOutput(values.areaMm2, 2)} mm²`}</p>
                </div>
              </details>

              <details className="mt-2 rounded-xl border border-white/10 bg-white/5">
                <summary className="flex min-h-11 cursor-pointer items-center px-3 py-2 text-xs font-bold">
                  {t("Ultimi calcoli e preferiti")}
                </summary>
                <div className="grid gap-3 border-t border-white/10 p-2.5 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                  <div>
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-white/85">{t("Ultimi calcoli")}</p>
                      {recentCalculations.length ? (
                        <button
                          type="button"
                          onClick={() => {
                            setRecentCalculations([]);
                            window.localStorage.removeItem(WC4_RECENTS_KEY);
                            setActionFeedback("Cronologia locale svuotata.");
                          }}
                          className="text-[10px] font-bold underline"
                        >
                          {t("Svuota")}
                        </button>
                      ) : null}
                    </div>
                    <div className="mt-1.5 space-y-1">
                      {recentCalculations.length ? recentCalculations.slice(0, 4).map((calculation) => (
                        <button
                          type="button"
                          key={`${calculation.key}-${calculation.savedAt}`}
                          onClick={() => restoreCalculation(calculation)}
                          className="block min-h-11 w-full rounded-lg bg-white/8 px-2 py-2 text-left text-xs hover:bg-white/12"
                        >
                          <span className="block truncate font-bold">{calculationStandardLabel(calculation)} · {calculationDimensionLabel(calculation)}</span>
                          <span className="text-white/85">{formatOutput(calculation.kgM, 3)} kg/m · {t("Ripristina")}</span>
                        </button>
                      )) : (
                        <p className="text-[10px] text-white/85">{t("Nessun calcolo recente.")}</p>
                      )}
                    </div>
                  </div>

                  <div>
                    <p className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-white/85">{t("Preferiti")}</p>
                    <div className="mt-1.5 space-y-1">
                      {favoriteCalculations.length ? favoriteCalculations.slice(0, 4).map((calculation) => (
                        <div key={calculation.key} className="flex items-center gap-1 rounded-lg bg-white/8 p-1">
                          <button
                            type="button"
                            onClick={() => restoreCalculation(calculation)}
                            className="min-h-11 min-w-0 flex-1 px-1.5 py-2 text-left text-xs"
                          >
                            <span className="block truncate font-bold">{calculationStandardLabel(calculation)} · {calculationDimensionLabel(calculation)}</span>
                          </button>
                          <button
                            type="button"
                            aria-label={`${t("Rimuovi")} ${calculationDimensionLabel(calculation)} ${t("dai preferiti")}`}
                            onClick={() => saveFavorites(favoriteCalculations.filter((item) => item.key !== calculation.key))}
                            className="min-h-11 min-w-11 rounded-md px-2 py-2 text-xs font-bold hover:bg-white/10"
                          >
                            ×
                          </button>
                        </div>
                      )) : (
                        <p className="text-[10px] text-white/85">{t("Aggiungi ai preferiti le misure che usi più spesso.")}</p>
                      )}
                    </div>
                  </div>
                </div>
              </details>

              <p className="sr-only">{t("Nessuna misura o quantità viene inviata al backend per questa funzione.")}</p>
            </div>
          </aside>
        </div>
      </section>

      {/* Secondary device conveniences: OUTSIDE the calculator controls and result. */}
      {!onAddToDistinta ? (
        <details className="rounded-xl border border-[#dce5e0] bg-[#f8faf8] text-[#123b34]">
          <summary className="flex min-h-11 cursor-pointer items-center justify-between px-4 py-2 text-xs font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#237858]">
            {t("Opzioni del dispositivo")}
            <span aria-hidden="true">⌄</span>
          </summary>
          <div className="flex flex-wrap items-center gap-2 border-t border-[#dce5e0] px-4 py-3">
            <CalculatorInstallGuide locale={locale} />
            <button
              type="button"
              disabled={!currentSnapshot}
              onClick={() => {
                if (!currentSnapshot) return;
                if (calculatorSaved) {
                  writeSavedCalculator(null);
                  setCalculatorSaved(false);
                  setActionFeedback("Salvataggio del calcolatore rimosso.");
                  return;
                }
                writeSavedCalculator(currentSnapshot);
                setCalculatorSaved(true);
                setActionFeedback("Calcolatore salvato su questo dispositivo.");
              }}
              className={calculatorSaved
                ? "school-selected-control rounded-xl px-3 py-2.5 min-h-11 text-xs font-bold disabled:opacity-50"
                : "school-secondary-action px-3 py-2.5 min-h-11 text-xs disabled:opacity-50"}
            >
              {t(calculatorSaved ? "Calcolatore salvato ✓" : "Salva il Calcolatore")}
            </button>
          </div>
        </details>
      ) : null}

      {!onAddToDistinta && (locale === "it" || locale === "en" || references.length > 0) ? <section aria-labelledby="tube-reference-heading" className="rounded-2xl border border-[#dce2df] bg-white p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-wide text-[#52615b]">{t("Riferimenti di fonte")}</p>
            <h2 id="tube-reference-heading" className="mt-1 text-lg font-semibold text-[#1d2824]">
              {familyCount} {t("riferimenti disponibili")} · {t(currentFamily.label)}
            </h2>
            <p className="mt-1 text-xs leading-5 text-[#52615b]">
              {t("Pubblicato non significa verificato. La norma di prodotto della fonte può essere diversa da quella del calcolo.")}
            </p>
          </div>
          <span className="rounded-full border border-[#cbded4] bg-[#eff7f2] px-3 py-1.5 text-xs font-semibold text-[#1d5748]">
            {standard === "geometric" ? t("Calcolo libero") : currentStandard.label}
          </span>
        </div>

        {contextualReferences.length > 0 ? (
          <div className="mt-4">
            <p className="text-xs font-semibold text-[#1d5748]">
              {t("Misure vicine con la stessa norma dichiarata")}
            </p>
            <ul className="mt-2 grid gap-2 sm:grid-cols-3">
              {contextualReferences.map((reference) => (
                <li key={reference.reference_id}>
                  <Link href={"/knowledge/tubes/" + reference.dimension_slug} className="flex min-h-14 flex-col justify-center rounded-xl border border-[#cbded4] bg-[#f7faf8] px-3 py-2 text-xs text-[#123b34] hover:border-[#719c87] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1f6b5a]">
                    <span className="font-semibold">{referenceLabel(reference)}</span>
                    <span className="mt-1 text-[#40594e]">{formatOutput(reference.weight_kg_m, 3)} kg/m · {sourceMethodLabel(referenceEvidence(reference).declaredMethod, locale === "it" ? "it" : "en")}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="mt-3 rounded-lg bg-[#f5f8f6] px-3 py-2 text-xs leading-5 text-[#52615b]">
            {standard === "geometric"
              ? (locale === "it" ? "Il calcolo libero è una stima geometrica: non implica equivalenza a uno specifico prodotto di catalogo." : "Geometric mode is an estimate, not an equivalent published product.")
              : (locale === "it" ? "Nessun riferimento comparabile documentato per norma e dimensioni selezionate. Le altre fonti restano consultabili separatamente." : "No documented same-standard reference near these dimensions. Other source records can be explored separately.")}
          </p>
        )}

        <details className="mt-4 rounded-xl border border-[#dce7e1] bg-[#fafcfb]" data-testid="tube-reference-catalogue">
          <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-3 px-3 py-3 text-sm font-semibold text-[#123b34] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1f6b5a]">
            {t("Esplora riferimenti e fonti")}
            <span aria-hidden="true" className="text-lg">⌄</span>
          </summary>
          <div className="border-t border-[#dce7e1] px-3 pb-3 pt-3">
            <p className="max-w-3xl text-xs leading-5 text-[#52615b]">
              {locale === "it"
                ? "Le fonti EN 10216-2/P265GH descrivono tubi per pressione, non attestano conformità strutturale EN 10219 o EN 10210. «Classificato verificato» indica il metodo registrato, non una nuova verifica indipendente."
                : "EN 10216-2/P265GH sources describe pressure-purpose tubes, not EN 10219/10210 structural conformity. 'Marked verified' reflects the stored method, not a new independent verification."}
            </p>
            <label className="mt-3 block text-xs font-semibold text-[#52615b]">
              {t("Cerca dimensione, peso o fonte")}
              <input value={referenceQuery} onChange={(event) => setReferenceQuery(event.target.value)}
                placeholder={t("Cerca 168,3 × 6,3...")}
                className="mt-1 block h-11 w-full rounded-xl border border-[#cbdcd3] bg-white px-3 text-base text-[#1d2824] outline-none focus:border-[#438d7a] focus:ring-2 focus:ring-[#d4eae0] sm:max-w-sm"
              />
            </label>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[630px] text-left text-xs">
                <thead className="school-table-head border-b border-[#dce2df]"><tr>
                  <th className="px-2 py-3">{t("Dimensione")}</th>
                  <th className="px-2 py-3">kg/m</th>
                  <th className="px-2 py-3">{t("Norma fonte")}</th>
                  <th className="px-2 py-3">{t("Metodo e provenienza")}</th>
                </tr></thead>
                <tbody className="divide-y divide-[#e5ede8]">
                  {familyReferences.map((reference) => {
                    const evidence = referenceEvidence(reference);
                    return (
                      <tr key={reference.reference_id} className="school-table-row">
                        <td className="px-2 py-2.5 font-medium">
                          <Link href={`/knowledge/tubes/${reference.dimension_slug}`} className="text-[#234e42] underline underline-offset-2 hover:text-[#123b34]">{referenceLabel(reference)}</Link>
                        </td>
                        <td className="whitespace-nowrap px-2 py-2.5 text-[#344e43]">{formatOutput(reference.weight_kg_m, 3)}</td>
                        <td className="px-2 py-2.5 text-[#344e43]">
                          <span>{sourceStandardLabel(evidence.standard, locale === "it" ? "it" : "en")}</span>
                          {evidence.grade ? <span className="block text-[11px] text-[#52615b]">{evidence.grade}</span> : null}
                          {standard !== "geometric" && evidence.standard !== standard ? (
                            <span className="block text-[11px] font-semibold text-[#895400]">{t("Non equivalente alla norma scelta")}</span>
                          ) : null}
                        </td>
                        <td className="px-2 py-2.5 text-[#344e43]">
                          <span>{sourceMethodLabel(evidence.declaredMethod, locale === "it" ? "it" : "en")}</span>
                          {reference.source_url ? (
                            <a href={reference.source_url} target="_blank" rel="noopener noreferrer" className="mt-0.5 block min-h-6 text-[#1d5748] underline underline-offset-2">
                              {reference.source_provider ?? t("Fonte")} ↗
                            </a>
                          ) : <span className="block">{reference.source_provider ?? "—"}</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {!familyReferences.length ? <p className="mt-3 text-xs text-[#52615b]">{t("Nessun riferimento corrispondente.")}</p> : null}
            {familyCount > familyReferences.length ? (
              <p className="mt-3 text-xs text-[#52615b]">
                {t("Mostrati i primi")} {familyReferences.length} {t("riferimenti corrispondenti. Usa la ricerca per restringere la lista.")}
              </p>
            ) : null}
          </div>
        </details>
      </section> : null}
    </div>
  );
}
