/**
 * I18N2 public-only mass estimation engine.
 * Uses the same geometric formulas and nominal corner-radius rules as WC3.
 * No catalog promotion, verified reference or commercial pricing is inferred.
 */
export type PublicTubeShape = "round" | "square" | "rectangular";
export type PublicTubeStandard = "en10219" | "en10210" | "geometric";

export type PublicTubeMassInput = {
  shape: PublicTubeShape;
  standard: PublicTubeStandard;
  outerDiameterMm?: number;
  widthMm?: number;
  heightMm?: number;
  thicknessMm: number;
  lengthM: number;
  bars: number;
  densityKgM3?: number;
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

export function estimatePublicTubeMass(input: PublicTubeMassInput): PublicTubeMassResult {
  const { shape, standard, outerDiameterMm: d, widthMm: b, heightMm: h,
    thicknessMm: t, lengthM: l, bars } = input;
  const rho = standard === "geometric" ? (input.densityKgM3 ?? 7850) : 7850;

  if (!Number.isFinite(t) || t <= 0) return { ok: false, error: "Wall thickness must be greater than zero." };
  if (!Number.isFinite(l) || l <= 0) return { ok: false, error: "Bar length must be greater than zero." };
  if (!Number.isSafeInteger(bars) || bars <= 0) return { ok: false, error: "Enter a positive whole number of bars." };
  if (!Number.isFinite(rho) || rho <= 0 || rho > 30000) return { ok: false, error: "Enter a valid material density." };
  if (!["round", "square", "rectangular"].includes(shape) || !["en10219", "en10210", "geometric"].includes(standard)) {
    return { ok: false, error: "Unsupported shape or calculation method." };
  }

  let areaMm2: number;
  if (shape === "round") {
    if (d == null || !Number.isFinite(d) || d <= 2 * t) {
      return { ok: false, error: "Outside diameter must be greater than twice the wall thickness." };
    }
    areaMm2 = Math.PI * t * (d - t);
  } else {
    const width = b ?? Number.NaN;
    const height = shape === "square" ? width : (h ?? Number.NaN);
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 2 * t || height <= 2 * t) {
      return { ok: false, error: "Outside dimensions must be greater than twice the wall thickness." };
    }
    if (standard === "geometric") {
      areaMm2 = width * height - (width - 2 * t) * (height - 2 * t);
    } else {
      const outerFactor = standard === "en10210" ? 1.5 : t <= 6 ? 2 : t <= 10 ? 2.5 : 3;
      const innerFactor = standard === "en10210" ? 1 : t <= 6 ? 1 : t <= 10 ? 1.5 : 2;
      const outerRadiusMm = outerFactor * t;
      const innerRadiusMm = innerFactor * t;
      areaMm2 =
        2 * t * (width + height - 2 * t) -
        (4 - Math.PI) * (outerRadiusMm ** 2 - innerRadiusMm ** 2);
    }
  }

  if (!Number.isFinite(areaMm2) || areaMm2 <= 0) {
    return { ok: false, error: "These dimensions cannot produce a valid section area." };
  }
  const weightKgM = areaMm2 * rho / 1_000_000;
  const weightKgBar = weightKgM * l;
  const totalMeters = l * bars;
  const totalKg = weightKgBar * bars;
  if (![weightKgM, weightKgBar, totalMeters, totalKg].every(Number.isFinite)) {
    return { ok: false, error: "Calculated mass is outside the supported numeric range." };
  }
  return {
    ok: true, areaMm2, weightKgM, weightKgBar, totalMeters,
    totalKg, totalTonnes: totalKg / 1000, densityKgM3: rho, estimated: true,
  };
}

export function formatEnglishMass(value: number, digits = 3): string {
  return new Intl.NumberFormat("en-GB", { maximumFractionDigits: digits }).format(value);
}
