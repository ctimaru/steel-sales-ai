/**
 * CALC-INT2 — authoritative, dependency-free public tube mass calculation.
 *
 * The shared IT/EN calculator and the English public RFQ bill use this exact
 * section model. The numbers are theoretical estimates, never a verified
 * published weight, proof of conformity or product equivalence.
 *
 * EN 10210 / EN 10219: nominal corner approximations used by the existing
 * public calculator. Do not extend this model to other norms without
 * source-controlled dimensional rules and numerical acceptance vectors.
 */
export type PublicTubeShape = "round" | "square" | "rectangular";
export type PublicTubeStandard = "en10219" | "en10210" | "geometric";

export type PublicTubeSectionInput = {
  shape: PublicTubeShape;
  standard: PublicTubeStandard;
  outerDiameterMm?: number;
  widthMm?: number;
  heightMm?: number;
  thicknessMm: number;
  densityKgM3?: number;
};

export type PublicTubeSectionResult =
  | { ok: false; error: string }
  | {
      ok: true;
      areaMm2: number;
      freeAreaMm2: number;
      standardAreaMm2: number | null;
      outerRadiusMm: number | null;
      innerRadiusMm: number | null;
      densityKgM3: number;
      weightKgM: number;
      estimated: true;
    };

export type PublicTubeMassInput = PublicTubeSectionInput & {
  lengthM: number;
  bars: number;
};

export type PublicTubeMassResult =
  | { ok: false; error: string }
  | {
      ok: true;
      areaMm2: number;
      weightKgM: number;
      weightKgBar: number;
      totalMeters: number;
      totalKg: number;
      totalTonnes: number;
      densityKgM3: number;
      estimated: true;
    };

export function parseTubeNumber(value: string): number {
  const trimmed = value.trim().replace(/\s/g, "");
  if (!/^[+-]?(?:\d+(?:[.,]\d*)?|[.,]\d+)$/.test(trimmed)) return Number.NaN;
  return Number(trimmed.replace(",", "."));
}

/** Nominal section radii, used only for EN 10210/EN 10219 square and RHS. */
export function standardCornerRadii(standard: Exclude<PublicTubeStandard, "geometric">, thicknessMm: number) {
  if (standard === "en10210") {
    return { outerRadiusMm: 1.5 * thicknessMm, innerRadiusMm: 1.0 * thicknessMm };
  }
  if (thicknessMm <= 6) {
    return { outerRadiusMm: 2.0 * thicknessMm, innerRadiusMm: 1.0 * thicknessMm };
  }
  if (thicknessMm <= 10) {
    return { outerRadiusMm: 2.5 * thicknessMm, innerRadiusMm: 1.5 * thicknessMm };
  }
  return { outerRadiusMm: 3.0 * thicknessMm, innerRadiusMm: 2.0 * thicknessMm };
}

export function standardRectangularAreaMm2(
  standard: Exclude<PublicTubeStandard, "geometric">,
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

/**
 * Single numerical source of truth. No mutation, locale, catalog, auth or
 * storage access. The same section mass can be multiplied by any bar length
 * or whole-bar count without changing its geometry.
 */
export function calculateTubeSection(input: PublicTubeSectionInput): PublicTubeSectionResult {
  const { shape, standard, outerDiameterMm: d, widthMm: b, heightMm: h, thicknessMm: t } = input;
  if (!["round", "square", "rectangular"].includes(shape) ||
      !["en10219", "en10210", "geometric"].includes(standard)) {
    return { ok: false, error: "Unsupported shape or calculation method." };
  }
  if (!Number.isFinite(t) || t <= 0) {
    return { ok: false, error: "Wall thickness must be greater than zero." };
  }
  const rho = standard === "geometric" ? (input.densityKgM3 ?? 7850) : 7850;
  if (!Number.isFinite(rho) || rho <= 0) {
    return { ok: false, error: "Enter a valid material density." };
  }

  let freeAreaMm2: number;
  let standardAreaMm2: number | null = null;
  let outerRadiusMm: number | null = null;
  let innerRadiusMm: number | null = null;
  if (shape === "round") {
    if (d == null || !Number.isFinite(d) || d <= 2 * t) {
      return { ok: false, error: "Outside diameter must be greater than twice the wall thickness." };
    }
    freeAreaMm2 = Math.PI * t * (d - t);
    if (standard !== "geometric") standardAreaMm2 = freeAreaMm2;
  } else {
    const width = b ?? Number.NaN;
    const height = shape === "square" ? width : (h ?? Number.NaN);
    if (!Number.isFinite(width) || !Number.isFinite(height) ||
        width <= 2 * t || height <= 2 * t) {
      return { ok: false, error: "Outside dimensions must be greater than twice the wall thickness." };
    }
    freeAreaMm2 = width * height - (width - 2 * t) * (height - 2 * t);
    if (standard !== "geometric") {
      const section = standardRectangularAreaMm2(standard, width, height, t);
      standardAreaMm2 = section.areaMm2;
      outerRadiusMm = section.outerRadiusMm;
      innerRadiusMm = section.innerRadiusMm;
    }
  }

  const areaMm2 = standard === "geometric" ? freeAreaMm2 : standardAreaMm2!;
  if (!Number.isFinite(areaMm2) || areaMm2 <= 0) {
    return { ok: false, error: "These dimensions cannot produce a valid section area." };
  }
  const weightKgM = (areaMm2 * rho) / 1_000_000;
  if (!Number.isFinite(weightKgM) || weightKgM <= 0) {
    return { ok: false, error: "Calculated mass is outside the supported numeric range." };
  }
  return { ok: true, areaMm2, freeAreaMm2, standardAreaMm2,
    outerRadiusMm, innerRadiusMm, weightKgM, densityKgM3: rho, estimated: true };
}

/** Compatibility API for the existing English RFQ builder (unchanged shape). */
export function estimatePublicTubeMass(input: PublicTubeMassInput): PublicTubeMassResult {
  const { lengthM: l, bars } = input;
  if (!Number.isFinite(input.thicknessMm) || input.thicknessMm <= 0) {
    return { ok: false, error: "Wall thickness must be greater than zero." };
  }
  if (!Number.isFinite(l) || l <= 0) {
    return { ok: false, error: "Bar length must be greater than zero." };
  }
  if (!Number.isSafeInteger(bars) || bars <= 0) {
    return { ok: false, error: "Enter a positive whole number of bars." };
  }
  const rho = input.standard === "geometric" ? (input.densityKgM3 ?? 7850) : 7850;
  if (!Number.isFinite(rho) || rho <= 0 || rho > 30000) {
    return { ok: false, error: "Enter a valid material density." };
  }
  const section = calculateTubeSection(input);
  if (!section.ok) return section;
  const weightKgM = section.weightKgM;
  const weightKgBar = weightKgM * l;
  const totalMeters = l * bars;
  const totalKg = weightKgBar * bars;
  if (![weightKgBar, totalMeters, totalKg].every(Number.isFinite)) {
    return { ok: false, error: "Calculated mass is outside the supported numeric range." };
  }
  return { ok: true, areaMm2: section.areaMm2, weightKgM,
    weightKgBar, totalMeters, totalKg, totalTonnes: totalKg / 1000,
    densityKgM3: section.densityKgM3, estimated: true };
}

export function formatEnglishMass(value: number, digits = 3): string {
  return new Intl.NumberFormat("en-GB", { maximumFractionDigits: digits }).format(value);
}
