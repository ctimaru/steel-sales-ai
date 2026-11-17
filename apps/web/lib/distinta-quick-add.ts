import {
  buyerTubeFamilyLabels,
  type BuyerDistintaCatalogOption,
} from "@/lib/buyer-distinta-catalog";
import {
  guidedFormatDimension,
  guidedTubeMassKgM,
  type GuidedTubeFamily,
  type GuidedTubeStandard,
} from "@/lib/buyer-tube-guidance";

/**
 * DISTINTA-QUICK1 (founder decision, 17 Nov 2026): one fast «Aggiungi articolo»
 * bar replaces the manual/AI switch and the 5-step configurator on
 * /rfq-hub/distinta. Search runs on a pre-normalized index (built once per
 * catalog), so a keystroke never re-normalizes the ~1,000 published sizes.
 */

export type QuickAddIndexEntry = {
  option: BuyerDistintaCatalogOption;
  haystack: string;
  dims: string;
};

export type QuickAddSuggestion =
  | { kind: "catalog"; key: string; option: BuyerDistintaCatalogOption; description: string; weightKgM: number; family: GuidedTubeFamily }
  | { kind: "computed"; key: string; description: string; weightKgM: number; family: GuidedTubeFamily }
  | { kind: "free"; key: string; description: string };

/** Accent, decimal comma, multiplication sign and spacing tolerant. */
export function normalizeQuickAddQuery(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLocaleLowerCase("it")
    .replace(/(\d),(\d)/g, "$1.$2")
    .replace(/[×*]/g, "x")
    .replace(/\s*x\s*/g, "x")
    .replace(/[^a-z0-9.]+/g, " ")
    .trim();
}

function dimsOf(option: BuyerDistintaCatalogOption) {
  const [, a, b] = option.sizeKey.split(":");
  const t = String(option.thicknessMm);
  return option.family === "round_tube" ? a + "x" + t : a + "x" + b + "x" + t;
}

export function buildQuickAddIndex(options: BuyerDistintaCatalogOption[]): QuickAddIndexEntry[] {
  return options.map((option) => {
    const dims = dimsOf(option);
    return {
      option,
      dims,
      haystack: normalizeQuickAddQuery([
        option.description, buyerTubeFamilyLabels[option.family], option.sizeLabel, dims, "mm",
      ].join(" ")),
    };
  });
}

const familyWords: [RegExp, GuidedTubeFamily][] = [
  [/\b(tond\w*|round|circ\w*|diam\w*)\b/, "round_tube"],
  [/\b(quadr\w*|square|sq)\b/, "square_tube"],
  [/\b(rett\w*|rect\w*|rettang\w*)\b/, "rectangular_tube"],
];

function familyFromWords(normalized: string): GuidedTubeFamily | null {
  for (const [pattern, family] of familyWords) if (pattern.test(normalized)) return family;
  return null;
}

/**
 * «100x100x5», «quadro 100x100x5», «120x80x4», «tondo 60,3x3», «60.3x3».
 * Returns a theoretical section only when the geometry is valid.
 */
export function parseQuickAddMeasure(query: string, standard: GuidedTubeStandard) {
  const normalized = normalizeQuickAddQuery(query);
  const match = normalized.match(/(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)(?:x(\d+(?:\.\d+)?))?/);
  if (!match) return null;
  const values = match.slice(1).filter(Boolean).map(Number);
  if (!values.every((value) => Number.isFinite(value) && value > 0)) return null;
  const named = familyFromWords(normalized.replace(match[0], " "));
  let family: GuidedTubeFamily;
  let a: number, b: number, t: number;
  if (values.length === 2) {
    [a, t] = values;
    b = a;
    family = named === "square_tube" ? "square_tube" : "round_tube";
    if (named === "rectangular_tube") return null;
  } else {
    [a, b, t] = values;
    if (named === "round_tube") return null;
    family = a === b && named !== "rectangular_tube" ? "square_tube" : "rectangular_tube";
  }
  const weightKgM = guidedTubeMassKgM(family, standard, a, b, t);
  if (weightKgM === null) return null;
  const measures = family === "round_tube"
    ? "Ø " + guidedFormatDimension(a)
    : guidedFormatDimension(a) + " × " + guidedFormatDimension(family === "square_tube" ? a : b);
  return {
    family,
    dims: family === "round_tube" ? a + "x" + t : a + "x" + b + "x" + t,
    description: buyerTubeFamilyLabels[family] + " " + measures + " × " + guidedFormatDimension(t) + " mm",
    weightKgM,
  };
}

/**
 * Ranked suggestions: exact published size first, then other published sizes,
 * then a theoretical calculation for sizes that are not published, and always
 * a last «riga libera» option so the bar is never a dead end.
 */
export function suggestQuickAdd(
  index: QuickAddIndexEntry[],
  query: string,
  standard: GuidedTubeStandard,
  limit = 8,
): QuickAddSuggestion[] {
  const normalized = normalizeQuickAddQuery(query);
  if (!normalized) return [];
  const terms = normalized.split(/\s+/).filter(Boolean);
  const measure = parseQuickAddMeasure(query, standard);
  const exact: QuickAddIndexEntry[] = [];
  const prefix: QuickAddIndexEntry[] = [];
  const rest: QuickAddIndexEntry[] = [];
  for (const entry of index) {
    if (measure && entry.dims === measure.dims && entry.option.family === measure.family) {
      exact.push(entry);
      continue;
    }
    if (!terms.every((term) => entry.haystack.includes(term))) continue;
    if (terms.some((term) => /\d/.test(term) && entry.dims.startsWith(term))) prefix.push(entry);
    else rest.push(entry);
    if (!measure && prefix.length >= limit) break;
  }
  const max = Math.max(1, Math.min(20, Math.floor(limit) || 8));
  const suggestions: QuickAddSuggestion[] = [...exact, ...prefix, ...rest].slice(0, max).map(({ option }) => ({
    kind: "catalog", key: "catalog:" + option.id, option, description: option.description,
    weightKgM: option.weightKgM, family: option.family,
  }));
  if (measure && exact.length === 0) {
    suggestions.unshift({
      kind: "computed", key: "computed:" + measure.family + ":" + measure.dims,
      description: measure.description, weightKgM: measure.weightKgM, family: measure.family,
    });
    if (suggestions.length > max) suggestions.length = max;
  }
  const free = query.trim().replace(/\s+/g, " ").slice(0, 160);
  if (free.length >= 2) suggestions.push({ kind: "free", key: "free", description: free });
  return suggestions;
}

/** Weight stored as Italian text in the draft row (decimal comma, no thousands separator). */
export function quickAddWeightText(weightKgM: number) {
  return String(Math.round(weightKgM * 1000) / 1000).replace(".", ",");
}
