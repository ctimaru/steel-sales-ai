import type { BuyerDistintaCatalogOption } from "@/lib/buyer-distinta-catalog";
import type { BuyerQuantityMode } from "@/lib/buyer-distinta";

export type GuidedTubeFamily = BuyerDistintaCatalogOption["family"];
export type GuidedTubeStandard = "EN 10219" | "EN 10210";
export type GuidedDimension = "diameter" | "side" | "width" | "height" | "thickness";

export type GuidedTubeDraft = {
  family: GuidedTubeFamily | "";
  standard: GuidedTubeStandard | "";
  grade: string;
  diameter: string;
  side: string;
  width: string;
  height: string;
  thickness: string;
  quantityMode: BuyerQuantityMode;
  quantity: string;
  barLengthM: string;
  finish: string;
  targetEurT: string;
  note: string;
};

export const newGuidedTubeDraft = (): GuidedTubeDraft => ({
  family: "", standard: "", grade: "", diameter: "", side: "",
  width: "", height: "", thickness: "",
  quantityMode: "bars", quantity: "", barLengthM: "12",
  finish: "", targetEurT: "", note: "",
});

export const guidedTubeGrades = [
  "S235JRH", "S275J0H", "S275J2H", "S355J0H", "S355J2H", "S355K2H",
] as const;

/** Same nominal section assumptions used in the public K5/WC3.1 calculator.
 * EN 10219 has thicker corner radii than EN 10210 for SHS/RHS.
 * Rounding is for display only; never claim mill-certified/verified mass.
 */
export function guidedTubeMassKgM(
  family: GuidedTubeFamily,
  standard: GuidedTubeStandard,
  a: number, b: number, thickness: number,
): number | null {
  if (![a,b,thickness].every((n) => Number.isFinite(n) && n > 0)) return null;
  if (thickness * 2 >= Math.min(a,b)) return null;
  let areaMm2: number;
  if (family === "round_tube") {
    areaMm2 = Math.PI * thickness * (a - thickness);
  } else {
    const outerRadiusMm = standard === "EN 10210" ? 1.5 * thickness :
      thickness <= 6 ? 2 * thickness : thickness <= 10 ? 2.5 * thickness : 3 * thickness;
    const innerRadiusMm = standard === "EN 10210" ? thickness :
      thickness <= 6 ? thickness : thickness <= 10 ? 1.5 * thickness : 2 * thickness;
    areaMm2 = 2 * thickness * (a + b - 2 * thickness) -
      (4 - Math.PI) * (outerRadiusMm ** 2 - innerRadiusMm ** 2);
  }
  const mass = areaMm2 * 7850 / 1_000_000;
  return Number.isFinite(mass) && mass > 0 ? mass : null;
}

export function guidedParseDimension(value: string): number | null {
  const parsed = Number(value.trim().replace(",", "."));
  return value.trim() && Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}
export function guidedFormatDimension(value: number): string {
  return value.toLocaleString("it-IT", { maximumFractionDigits: 2 });
}

export function guidedTubeMeasurement(
  draft: GuidedTubeDraft,
): { description: string; weightKgM: number; family: GuidedTubeFamily; standard: GuidedTubeStandard } | null {
  if (!draft.family || !draft.standard || !draft.grade.trim()) return null;
  const a = guidedParseDimension(draft.family === "round_tube" ? draft.diameter :
    draft.family === "square_tube" ? draft.side : draft.width);
  const b = draft.family === "rectangular_tube" ? guidedParseDimension(draft.height) : a;
  const thickness = guidedParseDimension(draft.thickness);
  if (a === null || b === null || thickness === null) return null;
  const weightKgM = guidedTubeMassKgM(draft.family, draft.standard, a, b, thickness);
  if (weightKgM === null) return null;
  const measures = draft.family === "round_tube"
    ? "Ø " + guidedFormatDimension(a) : draft.family === "square_tube"
      ? guidedFormatDimension(a) + " × " + guidedFormatDimension(a)
      : guidedFormatDimension(a) + " × " + guidedFormatDimension(b);
  const shape = draft.family === "round_tube" ? "Tubo tondo" :
    draft.family === "square_tube" ? "Tubo quadro" : "Tubo rettangolare";
  return {
    description: shape + " " + measures + " × " + guidedFormatDimension(thickness) + " mm",
    weightKgM, family: draft.family, standard: draft.standard,
  };
}

export function suggestedGuidedDimensions(
  options: BuyerDistintaCatalogOption[],
  draft: GuidedTubeDraft,
  field: GuidedDimension,
  query: string,
  limit = 7,
): string[] {
  if (!draft.family || !query.trim()) return [];
  const prefix = query.trim().replace(",", ".");
  const matches = new Set<number>();
  for (const option of options) {
    if (option.family !== draft.family) continue;
    const key = option.sizeKey.split(":");
    const a = Number(key[1]), b = Number(key[2]);
    const thickness = option.thicknessMm;
    const side = guidedParseDimension(draft.side);
    const diameter = guidedParseDimension(draft.diameter);
    const width = guidedParseDimension(draft.width);
    const height = guidedParseDimension(draft.height);
    if (field === "height" && width !== null && a !== width) continue;
    if (field === "thickness" && (
      (draft.family === "round_tube" && diameter !== null && a !== diameter) ||
      (draft.family === "square_tube" && side !== null && a !== side) ||
      (draft.family === "rectangular_tube" &&
        ((width !== null && a !== width) || (height !== null && b !== height)))
    )) continue;
    const value = field === "thickness" ? thickness :
      field === "height" ? b : a;
    if (Number.isFinite(value) && String(value).startsWith(prefix)) matches.add(value);
  }
  return [...matches].sort((a,b) => a-b)
    .slice(0, Math.max(1, Math.min(12, limit)))
    .map(guidedFormatDimension);
}
