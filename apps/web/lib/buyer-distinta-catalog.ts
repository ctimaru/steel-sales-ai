import type { PublicTubeDimensionSummary } from "@/lib/public-knowledge";

export type BuyerDistintaCatalogOption = {
  id: string;
  family: PublicTubeDimensionSummary["product_family"];
  sizeKey: string;
  sizeLabel: string;
  thicknessMm: number;
  description: string;
  weightKgM: number;
  sourceName: string | null;
};

export const buyerTubeFamilyLabels: Record<BuyerDistintaCatalogOption["family"], string> = {
  round_tube: "Tubo tondo",
  square_tube: "Tubo quadro",
  rectangular_tube: "Tubo rettangolare",
};

function fmt(value: number) {
  return value.toLocaleString("it-IT", { maximumFractionDigits: 2 });
}

/** Only use dimensions already published in Shared Knowledge, never a private manufacturer list. */
export function buildBuyerDistintaCatalogOptions(
  references: PublicTubeDimensionSummary[],
): BuyerDistintaCatalogOption[] {
  const options = new Map<string, BuyerDistintaCatalogOption>();
  for (const reference of references) {
    const family = reference.product_family;
    const a = family === "round_tube" ? reference.outer_diameter_mm : reference.width_mm;
    const b = family === "rectangular_tube" ? reference.height_mm : a;
    const thickness = Number(reference.thickness_mm);
    const weight = Number(reference.weight_kg_m);
    if (
      !reference.dimension_slug ||
      (family !== "round_tube" && family !== "square_tube" && family !== "rectangular_tube") ||
      a == null || b == null || !Number.isFinite(a) || !Number.isFinite(b) ||
      a <= 0 || b <= 0 || !Number.isFinite(thickness) || thickness <= 0 ||
      thickness * 2 >= Math.min(a,b) || !Number.isFinite(weight) || weight <= 0
    ) continue;

    const sizeKey = family + ":" + a + ":" + b;
    const sizeLabel = family === "round_tube"
      ? "Ø " + fmt(a) + " mm"
      : family === "square_tube"
        ? fmt(a) + " × " + fmt(a) + " mm"
        : fmt(a) + " × " + fmt(b) + " mm";
    const description = buyerTubeFamilyLabels[family] + " " + sizeLabel.replace(" mm", "") +
      " × " + fmt(thickness) + " mm";
    const key = sizeKey + ":" + thickness;
    if (!options.has(key)) {
      options.set(key, {
        id: reference.dimension_slug,
        family,
        sizeKey,
        sizeLabel,
        thicknessMm: thickness,
        description,
        weightKgM: weight,
        sourceName: reference.source_name,
      });
    }
  }
  return [...options.values()].sort((a,b) =>
    a.family.localeCompare(b.family) ||
    a.sizeLabel.localeCompare(b.sizeLabel, "it", { numeric: true }) ||
    a.thicknessMm - b.thicknessMm
  );
}

/** Accent, decimal comma, multiplication sign and spacing tolerant dimension search. */
function normalizeBuyerDimensionQuery(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("it")
    .replace(/(\d),(\d)/g, "$1.$2")
    .replace(/[×*]/g, "x")
    .replace(/\s*x\s*/g, "x")
    .replace(/[^a-z0-9.]+/g, " ")
    .trim();
}

export function searchBuyerDistintaCatalog(
  options: BuyerDistintaCatalogOption[],
  query: string,
  limit = 8,
): BuyerDistintaCatalogOption[] {
  const normalized = normalizeBuyerDimensionQuery(query);
  if (!normalized) return [];
  const terms = normalized.split(/\s+/).filter(Boolean);
  const maxResults = Math.max(1, Math.min(20, Math.floor(limit) || 8));
  return options.filter((item) => {
    const haystack = normalizeBuyerDimensionQuery(
      [item.description, buyerTubeFamilyLabels[item.family], item.sizeLabel,
        item.thicknessMm.toLocaleString("it-IT"), "mm"].join(" "),
    );
    return terms.every((term) => haystack.includes(term));
  }).slice(0, maxResults);
}
