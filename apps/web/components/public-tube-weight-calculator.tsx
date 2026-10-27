"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { calculatorRfqFromValues, enqueueCalculatorRfq, type CalculatorRfqItem } from "@/lib/calculator-rfq-handoff";
import { tubeCalculatorText, type TubeCalculatorLocale } from "@/lib/tube-calculator-locale";
import { CalculatorInstallGuide } from "@/components/calculator-install-guide";
import { CalculatorCommercialPricing } from "@/components/calculator-commercial-pricing";
import { CalculatorDimensionDiscovery } from "@/components/calculator-dimension-discovery";
import styles from "./calculator-dense-cockpit.module.css";
import cinematic from "./calculator-cinematic.module.css";
import { calculatorCinematicCopy } from "@/lib/calculator-cinematic-copy";
import {
  dimensionNumber, dimensionsFromPublicReferences, type CalculatorDimension,
} from "@/lib/calculator-dimension-discovery";
import { localizedInlineBill } from "@/lib/calculator-inline-distinta-copy";
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
  discoveryOptions,
  initialValues,
  locale = "it",
  onAddToDistinta,
  canAddToDistinta = true,
  inlinePublicDistinta = false,
  inlineBillCount = 0,
  onOpenInlineBill,
  inlineBill,
  onChooseBuyerTarget,
}: {
  references: PublicTubeDimensionSummary[];
  discoveryOptions?: CalculatorDimension[];
  initialValues?: PublicTubeCalculatorInitialValues;
  locale?: TubeCalculatorLocale;
  /** In-place RFQ bill composer; does not queue or navigate. */
  onAddToDistinta?: (item: CalculatorRfqItem) => boolean;
  canAddToDistinta?: boolean;
  /** Keep the public calculator layout when adding to the in-place bill. */
  inlinePublicDistinta?: boolean;
  inlineBillCount?: number;
  onOpenInlineBill?: () => void;
  /** Mount the same-page bill immediately AFTER the tool, BEFORE secondary references. */
  inlineBill?: ReactNode;
  onChooseBuyerTarget?: (value: { basis: "tonne" | "metre"; raw: string; weightKgM: number }) => void;
}) {
  const inEmbeddedBuilder = Boolean(onAddToDistinta) && !inlinePublicDistinta;
  const t = (text: string) => tubeCalculatorText(text, locale);
  const inlineCopy = localizedInlineBill(locale);
  const cine = calculatorCinematicCopy[locale];
  const commercialLabels = {
    it: {heading:"Obiettivo della richiesta",tonnes:"Tonnellate",price:"Prezzo €",metres:"Modifica barre e lunghezza a sinistra."},
    en: {heading:"Request target",tonnes:"Tonnes",price:"Price €",metres:"Edit bars and length on the left."},
    de: {heading:"Anfrageziel",tonnes:"Tonnen",price:"Preis €",metres:"Stäbe und Länge links anpassen."},
    fr: {heading:"Objectif de la demande",tonnes:"Tonnes",price:"Prix €",metres:"Modifiez les barres et la longueur à gauche."},
    es: {heading:"Objetivo de la solicitud",tonnes:"Toneladas",price:"Precio €",metres:"Modifica las barras y la longitud a la izquierda."},
  }[locale];
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
  const [commercialQuantity, setCommercialQuantity] = useState<{ mode: "metres" | "tonnes"; raw: string } | null>(
    initialValues?.targetTonnes?.trim() ? { mode: "tonnes", raw: initialValues.targetTonnes } : null,
  );
  const [commercialPriceUnit, setCommercialPriceUnit] = useState<"metres" | "tonnes">("tonnes");
  const [commercialPrice, setCommercialPrice] = useState("");
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

  // A commercial target does not silently change bar counts or the RFQ bill.
  const commercialWeight = !values.error && values.kgM != null && values.kgM > 0 ? values.kgM : null;
  const commercialTargetNumber = commercialQuantity ? parseNumber(commercialQuantity.raw) : null;
  const commercialMetres = commercialQuantity
    ? commercialWeight == null || commercialTargetNumber == null || commercialTargetNumber < 0 ? null
      : commercialQuantity.mode === "metres" ? commercialTargetNumber : commercialTargetNumber * 1000 / commercialWeight
    : values.totalMeters;
  const commercialTonnes = commercialQuantity
    ? commercialWeight == null || commercialTargetNumber == null || commercialTargetNumber < 0 ? null
      : commercialQuantity.mode === "tonnes" ? commercialTargetNumber : commercialTargetNumber * commercialWeight / 1000
    : !values.error ? values.totalTonnes : null;
  const commercialParsedPrice = commercialPrice.trim() ? parseNumber(commercialPrice) : null;
  const commercialTotal = commercialParsedPrice != null && commercialParsedPrice >= 0
    ? (commercialPriceUnit === "metres" ? commercialMetres : commercialTonnes) == null
      ? null : commercialParsedPrice * (commercialPriceUnit === "metres" ? commercialMetres! : commercialTonnes!)
    : null;
  const commercialNumber = (value: number | null, decimals: number) =>
    value == null || !Number.isFinite(value) ? "" : String(Number(value.toFixed(decimals))).replace(".", ",");
  const commercialShownMetres = commercialQuantity?.mode === "metres"
    ? commercialQuantity.raw : commercialNumber(commercialMetres, 3);
  const commercialShownTonnes = commercialQuantity?.mode === "tonnes"
    ? commercialQuantity.raw : commercialNumber(commercialTonnes, 6);

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

  const availableDimensions = useMemo(
    () => discoveryOptions ?? dimensionsFromPublicReferences(references),
    [discoveryOptions,references]
  );
  // Selecting a documented geometry never silently changes the chosen EN
  // calculation method, commercial grade, quantity or RFQ draft.
  function applyDiscoveredDimension(item:CalculatorDimension) {
    setFamily(item.family);
    if(item.family==="round_tube")setOuterDiameter(dimensionNumber(item.primaryMm));
    else {
      setWidth(dimensionNumber(item.primaryMm));
      if(item.family==="rectangular_tube")setHeight(dimensionNumber(item.secondaryMm));
    }
    setThickness(dimensionNumber(item.thicknessMm));
    setThicknessTouched(true);
    setActionFeedback("");
  }

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
  const inputClass =
    "mt-1 min-h-11 w-full rounded-lg border border-[#cfd9d5] bg-white px-2.5 py-1.5 text-sm font-semibold tabular-nums text-[#1d2824] outline-none transition-colors hover:border-[#8eb5a6] focus-visible:border-[#24745d] focus-visible:ring-2 focus-visible:ring-[#b5ddcd] sm:min-h-10";
  // Preserve all reference/source HTML and device conveniences for people and
  // crawlers, but make them opt-in on the Italian public inline-bill experience.
  // Native <details> is not SEO cloaking: the content is equally available to
  // visitors, and is not fetched separately for bots.
  const secondaryTools = (
    <>
      {/* Secondary device conveniences: OUTSIDE the calculator controls and result. */}
      {/* CALC-INT4.4D.2: these PWA / local save controls are temporarily
          absent on the public Italian calculator-first experience.
          Other localized calculators keep their existing functionality. */}
      {!inEmbeddedBuilder && !inlinePublicDistinta ? (
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

      {!inEmbeddedBuilder && (locale === "it" || locale === "en" || references.length > 0) ? <section aria-labelledby="tube-reference-heading" className="rounded-2xl border border-[#dce2df] bg-white p-4 sm:p-5">
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
    </>
  );

  async function copyCurrentResult() {
    if (!currentSnapshot) return;
    try {
      await copyTextToClipboard(resultText(currentSnapshot));
      setActionFeedback(t("Risultato copiato."));
    } catch {
      setActionFeedback(t("Copia non riuscita: controlla i permessi degli appunti."));
    }
  }
  const sectionDiagram = (
    <div data-cockpit-preview className={styles.preview}>
      <div className="min-w-0">
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
    </div>
  );
  const sectionNumber = (value: number | null) => values.error || value == null ? "—" : formatOutput(value, 2);
  const sectionFacts = [
    {key:"outer", label:family === "round_tube" ? t("Diametro D") : family === "square_tube" ? t("Lato B") : cine.outerSize,
      value:values.error ? "—" : family === "round_tube" ? sectionNumber(values.d) : family === "square_tube" ? sectionNumber(values.b) : `${sectionNumber(values.b)} × ${sectionNumber(values.h)}`, unit:"mm"},
    {key:"wall", label:t("Spessore t"), value:sectionNumber(values.t), unit:"mm"},
    ...(family === "round_tube" ? [{key:"inner", label:cine.innerDiameter,
      value:sectionNumber(values.d == null || values.t == null ? null : values.d - 2 * values.t), unit:"mm"}] : []),
    {key:"area", label:cine.area, value:sectionNumber(values.areaMm2), unit:"mm²"},
  ];

  return (
    <div
      className={inEmbeddedBuilder ? "space-y-3" : `space-y-3 ${cinematic.shell}`}
      inert={!retentionReady}
      aria-busy={!retentionReady}
      onChangeCapture={(event) => {
        // Commercial rate edits are ephemeral: do not count them as a change
        // to geometry or emit a weight-calculation engagement signal.
        if ((event.target as HTMLElement).closest("[data-commercial-price]")) return;
        calculationInteractedRef.current = true;
      }}
    >
      <section
        id="calcolatore-pesi"
        data-calculator-ready={retentionReady ? "true" : "false"}
        data-calc-cine1a={inEmbeddedBuilder ? undefined : "true"}
        className={`flex scroll-mt-20 flex-col overflow-hidden rounded-xl border border-[#cddbd6] bg-white shadow-[0_8px_28px_rgba(11,47,39,0.05)] ${inEmbeddedBuilder ? "" : cinematic.root}`}
      >
        <header data-cockpit-header className={styles.header}>
          <div className="min-w-0">
            {!inEmbeddedBuilder ? <p className={cinematic.eyebrow}>{cine.eyebrow}</p> : null}
            <div className="flex items-center gap-2">
              {inEmbeddedBuilder || locale === "de" || locale === "fr" || locale === "es" ? <h2 className="text-sm font-bold text-[#15372f] sm:text-base">{t("Peso tubo acciaio")}</h2> : <h1 className="text-sm font-bold text-[#15372f] sm:text-base">{t("Peso tubo acciaio")}</h1>}
              <span className="school-badge hidden lg:inline-flex">{t("Gratis")}</span>
            </div>
            {!inEmbeddedBuilder ? <p className={cinematic.description}>{cine.description}</p> : null}
          </div>
          {inlinePublicDistinta && inlineBillCount > 0 ? (
            <button type="button" className={styles.cartShortcut} onClick={onOpenInlineBill} aria-haspopup="dialog">
              {inlineCopy.seeBill} · {inlineBillCount} ↗
            </button>
          ) : null}
        </header>
        <div data-cockpit-toolbar className={styles.toolbar}>
          <CalculatorDimensionDiscovery items={availableDimensions} locale={locale}
            compact onChoose={applyDiscoveredDimension} />
          <div data-cockpit-controls className={styles.toolbarControls}>
              <div className="flex min-w-0 flex-wrap items-end gap-2.5">
                <label className="min-w-[150px] flex-1 text-[10px] font-bold uppercase tracking-wide text-[#52615b] sm:max-w-[210px]">{!inEmbeddedBuilder ? <span aria-hidden="true" className={cinematic.step}>1</span> : null}{t("Norma")}
                  <select aria-label={t("Norma")} value={standard} onChange={(event) => handleStandardChange(event.target.value as StandardValue)} className="mt-1 h-11 sm:h-10 w-full rounded-lg border border-[#cfdfd6] bg-white px-2.5 text-xs font-semibold text-[#173f34]">
                    {standardOptions.map((option) => <option key={option.value} value={option.value}>{t(option.label)}</option>)}
                  </select>
                </label>
                <div role="group" aria-label={t("Sagoma")} className="min-w-0 flex-[2]">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-white/85">{!inEmbeddedBuilder ? <span aria-hidden="true" className={cinematic.step}>2</span> : null}{t("Sagoma")}</p>
                  <div className="mt-1 grid grid-cols-3 gap-1.5" data-calc-shape-buttons>
                    {familyOptions.map((option) => (
                      <button key={option.value} type="button" aria-pressed={family === option.value}
                        onClick={() => setFamily(option.value as TubeFamily)}
                        className="flex min-h-11 min-w-0 items-center justify-center gap-1 rounded-lg border border-[#356b53] bg-[#0b3023] px-1.5 py-2 text-[11px] font-semibold text-[#d8f9e8] transition-colors hover:bg-[#18503a] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#75f4bd] aria-pressed:border-[#65f0b4] aria-pressed:bg-[#216c4b] aria-pressed:text-white">
                        <svg aria-hidden="true" viewBox="0 0 28 28" className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.8">
                          {option.value === "round_tube" ? <circle cx="14" cy="14" r="10" /> :
                            option.value === "square_tube" ? <rect x="4" y="4" width="20" height="20" rx="1" /> :
                            <rect x="2" y="7" width="24" height="14" rx="1" />}
                        </svg>
                        <span className="truncate">{t(option.short)}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

          </div>
        </div>
        <div data-cockpit-workspace className={styles.workspace}>
          <div data-cockpit-fields className={styles.fields}>
            <div className="grid gap-2">
              <section
                aria-labelledby="calculator-measures"
                className="min-w-0"
              >
                <div className="min-w-0">
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <h2 id="calculator-measures" className="text-[10px] font-extrabold uppercase tracking-[0.13em] text-[#52615b]">
                      {!inEmbeddedBuilder ? <span aria-hidden="true" className={cinematic.step}>3</span> : null}{t("Misure")}
                    </h2>
                    <span className="text-xs text-[#52615b]">mm</span>
                  </div>

                  <div data-cockpit-measurements className={family === "rectangular_tube" ? styles.measurementsRect : styles.measurements}>
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

                  {!inEmbeddedBuilder ? <h3 className={cinematic.inputHeading}><span aria-hidden="true" className={cinematic.step}>4</span>{cine.lengthQuantity}</h3> : null}
                  <div data-cockpit-length-quantity className={styles.lengthQuantity}>
                    <div>
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <span className="text-[10px] font-bold text-[#52615b]">{t("Lunghezza barra")}</span>
                        <span className="text-xs text-[#52615b]">m</span>
                      </div>
                      <div className="flex w-fit items-center gap-1.5">
                        <select aria-label={t("Lunghezza barra")} value={lengthPresets.some((preset) => preset === length) ? length : "custom"} onChange={(event) => { if (event.target.value !== "custom") setLength(event.target.value); }} className="h-11 sm:h-10 w-[112px] rounded-lg border border-[#d0dfd6] bg-white px-2 text-xs font-semibold text-[#173f34]">
                          {lengthPresets.map((preset) => <option key={preset} value={preset}>{preset} m</option>)}
                          <option value="custom">{t("Personalizzata")}</option>
                        </select>
                        <input value={length} onChange={(event) => setLength(event.target.value)} inputMode="decimal" aria-label={t("Lunghezza barra personalizzata")} className="h-11 sm:h-10 w-[66px] rounded-lg border border-[#d0dfd6] bg-white px-1 text-center text-xs font-semibold text-[#1d2824]" />
                      </div>
                    </div>

                    <div className="text-xs font-bold text-[#52615b]">
                      <label htmlFor="tube-calculator-quantity">{t("Numero barre")}</label>
                      <div className="mt-1 grid w-fit grid-cols-[44px_52px_44px] sm:grid-cols-[36px_52px_36px] gap-1 rounded-xl border border-[#dce7e1] bg-[#f3f7f5] p-1">
                        <button
                          type="button"
                          aria-label={t("Riduci di una barra")}
                          onClick={() => {
                            const current = Math.max(1, Math.floor(parseNumber(quantity) ?? 1));
                            setQuantity(String(Math.max(1, current - 1)));
                          }}
                          className="min-h-11 rounded-lg text-base font-semibold text-[#31594c] transition-colors hover:bg-white hover:text-[#123d34] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#15815a] active:scale-[0.97] sm:min-h-9"
                        >
                          −
                        </button>
                        <input
                          id="tube-calculator-quantity"
                          aria-label={t("Numero barre")}
                          value={quantity}
                          onChange={(event) => setQuantity(event.target.value)}
                          inputMode="numeric"
                          className="h-11 min-w-0 rounded-lg border border-[#d0dfd6] bg-white px-1 text-center text-sm font-semibold text-[#1d2824] outline-none transition-colors focus:border-[#438d7a] focus:ring-2 focus:ring-[#b5ddcd] sm:h-9"
                        />
                        <button
                          type="button"
                          aria-label={t("Aumenta di una barra")}
                          onClick={() => {
                            const current = Math.max(0, Math.floor(parseNumber(quantity) ?? 0));
                            setQuantity(String(current + 1));
                          }}
                          className="min-h-11 rounded-lg text-base font-semibold text-[#31594c] transition-colors hover:bg-white hover:text-[#123d34] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#15815a] active:scale-[0.97] sm:min-h-9"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>

                  {values.error ? (
                    <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-800">
                      {t(values.error)}
                    </p>
                  ) : null}
                </div>

              </section>

              <div className="hidden text-xs text-[#66736e] lg:flex lg:items-center lg:justify-between">
                <span>{t("Il risultato si aggiorna mentre scrivi.")}</span>
                <span>{t(standard === "geometric" ? "Densità modificabile" : "La densità non è modificabile in modalità normativa.")}</span>
              </div>
            </div>
          </div>

          {!inEmbeddedBuilder ? (
            <div data-cinematic-stage className={cinematic.stage}>
              <div className={cinematic.stageHeading}>
                <span>{cine.visual}</span><strong>{t(currentStandard.label)}</strong>
              </div>
              {values.error ? <p role="status" className={cinematic.invalid}>{t(values.error)}</p> : <>
                <div className={cinematic.productPhoto} data-cinematic-product={family}>
                  <picture>
                    <source media="(prefers-reduced-data: reduce)" srcSet={`/calculator/tube-${family.replace("_tube", "")}-384.webp`} />
                    {/* Small, local, decorative artwork. Live dimensions remain in the technical diagram below. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/calculator/tube-${family.replace("_tube", "")}-768.webp`}
                      srcSet={`/calculator/tube-${family.replace("_tube", "")}-384.webp 384w, /calculator/tube-${family.replace("_tube", "")}-768.webp 768w`}
                      sizes="(max-width: 679px) 100vw, (max-width: 1100px) 90vw, 450px"
                      width={768} height={512} alt="" loading="lazy" decoding="async" />
                  </picture>
                  <span className={cinematic.photoNote}>{cine.illustration}</span>
                </div>
                <div className={cinematic.technicalInset}>{sectionDiagram}</div>
              </>}
              <div className={cinematic.sectionMetric}>
                <span>{cine.area}</span>
                <strong>{values.areaMm2 == null ? "—" : formatOutput(values.areaMm2, 2)} <small>mm²</small></strong>
              </div>
            </div>
          ) : null}
          <aside
            data-cockpit-results
            className={`tube-calculator-result ${styles.results}`}
          >
            <div className="shrink-0 border-b border-white/10 px-3 py-2.5">
              {!inEmbeddedBuilder ? <h2 className={cinematic.resultTitle}>{cine.results}</h2> : null}
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/85">
                    {standard === "geometric" ? t("Peso al metro · calcolo libero") : `${t("Massa lineare")} · ${currentStandard.label}`}
                  </p>
                  <p aria-live="polite" aria-atomic="true" className="metric-number mt-0.5 break-words text-2xl font-semibold tracking-[-0.04em] sm:text-3xl">
                    {values.kgM == null ? "—" : formatOutput(values.kgM, 3)}
                    <span className="ml-1 text-base font-semibold tracking-normal text-white/85">kg/m</span>
                  </p>
                </div>
                {inEmbeddedBuilder ? sectionDiagram : null}
              </div>

              {!inEmbeddedBuilder ? <p className={cinematic.resultContext} data-cinematic-context>
                {values.error || values.l == null || values.qty == null ? "—" : `${formatOutput(values.l, 20)} m · ${formatOutput(values.qty, 20)} ${values.qty === 1 ? cine.bar : cine.bars}`}
              </p> : null}
              <div data-cockpit-kpis className="mt-2 grid grid-cols-3 gap-1.5">
                <div className="min-w-0 rounded-lg bg-white/8 px-2 py-1.5">
                  <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-white/85">{t("Peso per barra")}</p>
                  <p className="metric-number mt-1 break-words text-base font-semibold tabular-nums">
                    {values.kgBar == null ? "—" : formatOutput(values.kgBar, 2)}
                    <span className="ml-1 text-[10px] text-white/85">kg</span>
                  </p>
                </div>
                <div className="min-w-0 rounded-lg bg-white/8 px-2 py-1.5">
                  <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-white/85">{t("Metri totali")}</p>
                  <p className="metric-number mt-1 break-words text-base font-semibold tabular-nums">
                    {values.totalMeters == null ? "—" : formatOutput(values.totalMeters, 1)}
                    <span className="ml-1 text-[10px] text-white/85">m</span>
                  </p>
                </div>
                <div className="min-w-0 rounded-lg border border-[#56b88f]/60 bg-[#15533b] px-2 py-1.5" data-calc-total-weight>
                  <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#d6ffe9]">{t("Peso totale")}</p>
                  <p className="metric-number mt-1 break-words text-lg font-bold tabular-nums text-white">
                    {values.totalTonnes == null ? "—" : formatOutput(values.totalTonnes, 4)}
                    <span className="ml-1 text-[10px] text-white/85">t</span>
                  </p>
                </div>
              </div>

              <button
                type="button"
                disabled={!currentSnapshot || (Boolean(onAddToDistinta) && !canAddToDistinta)}
                onClick={() => {
                  if (!currentSnapshot) return;
                  const item = calculatorRfqFromValues(currentSnapshot,
                    typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : "calc-"+Date.now()+"-"+Math.random().toString(36).slice(2));
                  if (onAddToDistinta) {
                    if (!item || !onAddToDistinta(item)) {
                      setActionFeedback(inlineCopy.addError);
                    } else {
                      setActionFeedback(inlinePublicDistinta
                        ? inlineCopy.added
                        : "Articolo aggiunto ✓ · puoi continuare con un’altra misura.");
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
                data-cockpit-add
                className="tube-calculator-rfq-link mt-1.5 inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-[#c3e5d5] bg-[#e3f4eb] px-3 py-2 text-center text-sm font-bold leading-snug text-[#123b34] transition-colors hover:border-[#98d6b6] hover:bg-[#ccebdc] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {!inEmbeddedBuilder ? <svg aria-hidden="true" className={cinematic.actionIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 4h2l2 12h12l2-9H6M9 20h.01M18 20h.01" strokeLinecap="round" strokeLinejoin="round" /></svg> : null}
                {t(onAddToDistinta ? "＋ Aggiungi alla distinta" : "Aggiungi questa misura alla distinta →")}
              </button>
              <p className="mt-1 text-[11px] leading-4 text-white/85">
                {inlinePublicDistinta ? inlineCopy.billWeightNote : t(onAddToDistinta
                  ? "Il peso è teorico: la riga appare subito a fianco, senza inviare una RFQ."
                  : "Gratuito · nessun login richiesto. Il grado acciaio resta da confermare.")}
              </p>

              <section data-commercial-targets className="mt-3 rounded-xl border border-[#4b9774] bg-[#0a2f23] p-3">
                <p className="mb-2 text-xs font-bold text-[#dff9eb]">{commercialLabels.heading}</p>
                <div className="grid grid-cols-2 gap-2">
                  <label className="min-w-0 text-[11px] font-semibold text-[#d9f6e6]">
                    <span className="mb-1 block">{t("Metri totali")}</span>
                    <span className="flex items-center gap-1 rounded-lg border border-[#416a56] bg-[#123f30] px-2 focus-within:border-[#54e8a5]">
                      <input aria-label={t("Metri totali")} inputMode="decimal" value={commercialShownMetres}
                        onChange={(event) => setCommercialQuantity({ mode: "metres", raw: event.target.value })}
                        className="min-w-0 w-full bg-transparent py-2 text-sm font-semibold tabular-nums text-white outline-none" />
                      <span className="text-[#cee5d8]">m</span>
                    </span>
                  </label>
                  <label className="min-w-0 text-[11px] font-semibold text-[#d9f6e6]">
                    <span className="mb-1 block">{commercialLabels.tonnes}</span>
                    <span className="flex items-center gap-1 rounded-lg border border-[#416a56] bg-[#123f30] px-2 focus-within:border-[#54e8a5]">
                      <input aria-label={commercialLabels.tonnes} inputMode="decimal" value={commercialShownTonnes}
                        onChange={(event) => setCommercialQuantity({ mode: "tonnes", raw: event.target.value })}
                        className="min-w-0 w-full bg-transparent py-2 text-sm font-semibold tabular-nums text-white outline-none" />
                      <span className="text-[#cee5d8]">t</span>
                    </span>
                  </label>
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold text-[#d9f6e6]">{commercialLabels.price}</span>
                  <div className="inline-flex rounded-lg border border-[#416a56] p-0.5" role="group" aria-label={commercialLabels.price}>
                    {(["metres", "tonnes"] as const).map((unit) => (
                      <button key={unit} type="button" aria-pressed={commercialPriceUnit === unit}
                        onClick={() => setCommercialPriceUnit(unit)}
                        className={"min-h-11 rounded-md px-3 py-2 text-[11px] font-semibold " + (commercialPriceUnit === unit ? "bg-[#287b57] text-white" : "text-[#cee5d8]")}>
                        {unit === "metres" ? "€/m" : "€/t"}
                      </button>
                    ))}
                  </div>
                </div>
                <input aria-label={commercialLabels.price} inputMode="decimal" value={commercialPrice}
                  onChange={(event) => setCommercialPrice(event.target.value)}
                  placeholder="0,00" className="mt-1 w-full rounded-lg border border-[#416a56] bg-[#123f30] px-2 py-2 text-sm font-semibold text-white outline-none focus:border-[#54e8a5]" />
                <div className="mt-2 rounded-lg bg-white/10 px-3 py-2" aria-live="polite">
                  <p className="text-[10px] text-[#cee5d8]">{({it:"Valore totale target",en:"Target total",de:"Zielgesamtwert",fr:"Valeur cible totale",es:"Valor total objetivo"} as const)[locale]}</p>
                  <p className="text-lg font-bold tabular-nums text-white">{commercialTotal == null ? "—" : new Intl.NumberFormat(locale === "en" ? "en-GB" : locale, { style: "currency", currency: "EUR" }).format(commercialTotal)}</p>
                </div>
                {commercialWeight == null ? <p className="mt-1 text-[10px] text-[#cee5d8]">{({it:"Seleziona una geometria valida per convertire metri e tonnellate.",en:"Select valid dimensions to convert metres and tonnes.",de:"Gültige Abmessungen für die Umrechnung wählen.",fr:"Sélectionnez des dimensions valides pour convertir.",es:"Selecciona dimensiones válidas para convertir."} as const)[locale]}</p> : null}
              </section>


              {!inEmbeddedBuilder ? <button type="button" onClick={copyCurrentResult}
                disabled={!currentSnapshot} className={cinematic.copy} data-cinematic-copy>
                <svg aria-hidden="true" className={cinematic.actionIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="8" y="8" width="12" height="13" rx="2" /><path d="M16 8V3H4v13h4" strokeLinejoin="round" /></svg>
                {cine.copy}
              </button> : null}
              {!inEmbeddedBuilder ? <dl className={cinematic.geometry} data-cinematic-geometry>
                {sectionFacts.map(fact => <div key={fact.key}><dt>{fact.label}</dt>
                  <dd data-section-value={fact.key}>{fact.value}<small> {fact.unit}</small></dd></div>)}
              </dl> : null}

              {values.targetBars != null ? (
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white/10 px-3 py-2 text-xs">
                  <span>{t("Barre necessarie")} <strong>{values.targetBars}</strong></span>
                  <span>{t("Tonnellate reali")} <strong>{values.targetActualTonnes == null ? "—" : formatOutput(values.targetActualTonnes, 4)} t</strong></span>
                </div>
              ) : null}
            </div>

            <div data-cockpit-feedback className={actionFeedback ? "min-w-0 px-3 pb-2" : "sr-only"}>



              <p aria-live="polite" className="mt-2 min-h-4 text-xs font-semibold text-white/85">
                {inlinePublicDistinta ? actionFeedback : t(actionFeedback)}
              </p>





              <p className="sr-only">{t("Nessuna misura o quantità viene inviata al backend per questa funzione.")}</p>
            </div>
          </aside>
        </div>
        <div data-cockpit-details className={styles.detailStrip}>
              {!inEmbeddedBuilder ? <details className="group/extra mt-1 rounded-lg border border-white/15 px-2 py-1.5">
                <summary className="flex min-h-11 cursor-pointer items-center justify-between text-[11px] font-semibold text-white sm:min-h-9 focus-visible:outline-2 focus-visible:outline-white">
                  {t("Copia risultato")} · {t("Copia link")} · ★ <span aria-hidden="true" className="transition-transform group-open/extra:rotate-180">⌄</span>
                </summary>
                <div className="grid grid-cols-2 gap-1.5 border-t border-white/15 pt-2 sm:grid-cols-3">
                <button
                  type="button"
                  disabled={!currentSnapshot}
                  onClick={copyCurrentResult}
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
                </div>
              </details> : null}
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
        </div>
      </section>

      {inlineBill}
      {inlinePublicDistinta ? (
        <details data-testid="calculator-technical-disclosure"
          className="rounded-xl border border-[#dbe8e1] bg-[#fbfdfb] text-[#305d48]">
          <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-3 px-4 py-2 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#176647]">
            Riferimenti tecnici del calcolatore
            <span aria-hidden="true">⌄</span>
          </summary>
          <div className="space-y-4 border-t border-[#e2eee7] p-3 sm:p-4">
            {secondaryTools}
          </div>
        </details>
      ) : secondaryTools}
    </div>
  );
}
