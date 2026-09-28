import type {
  PublicTubeDimension,
  PublicTubeDimensionSummary,
  PublicTubeFamilyHub,
  PublicTubeSizeHubSummary,
} from "@/lib/public-knowledge";

export type PublicTubeFamilySlug = PublicTubeFamilyHub["family_slug"];
export type PublicTubeFamily = PublicTubeDimensionSummary["product_family"];

export const tubeFamilyConfigs: Array<{
  slug: PublicTubeFamilySlug;
  productFamily: PublicTubeFamily;
  label: string;
  singular: string;
  shortDescription: string;
}> = [
  {
    slug: "tondo",
    productFamily: "round_tube",
    label: "Tubi tondi",
    singular: "tubo tondo",
    shortDescription: "Diametri e spessori con peso al metro pubblicato.",
  },
  {
    slug: "quadro",
    productFamily: "square_tube",
    label: "Profili quadri",
    singular: "profilo quadro",
    shortDescription: "Sezioni SHS raggruppate per lato esterno e spessore.",
  },
  {
    slug: "rettangolare",
    productFamily: "rectangular_tube",
    label: "Profili rettangolari",
    singular: "profilo rettangolare",
    shortDescription: "Sezioni RHS raggruppate per base, altezza e spessore.",
  },
];

export function getTubeFamilyBySlug(slug: string) {
  return tubeFamilyConfigs.find((item) => item.slug === slug) ?? null;
}

export function getTubeFamilyByProductFamily(productFamily: PublicTubeFamily) {
  return tubeFamilyConfigs.find((item) => item.productFamily === productFamily) ?? null;
}

export function formatTubeNumber(value: number, digits = 3) {
  return new Intl.NumberFormat("it-IT", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  }).format(value);
}

export function tubeSlugNumber(value: number) {
  return String(value).replace(".", "-");
}

export function tubeSizeSlug(dimension: {
  product_family: PublicTubeFamily;
  outer_diameter_mm: number | null;
  width_mm: number | null;
  height_mm: number | null;
}) {
  if (dimension.product_family === "round_tube") {
    return tubeSlugNumber(dimension.outer_diameter_mm ?? 0);
  }
  return (
    tubeSlugNumber(dimension.width_mm ?? 0) +
    "x" +
    tubeSlugNumber(dimension.height_mm ?? 0)
  );
}

export function tubeSizeLabel(dimension: {
  product_family: PublicTubeFamily;
  outer_diameter_mm: number | null;
  width_mm: number | null;
  height_mm: number | null;
}) {
  if (dimension.product_family === "round_tube") {
    return "Ø " + formatTubeNumber(dimension.outer_diameter_mm ?? 0) + " mm";
  }
  return (
    formatTubeNumber(dimension.width_mm ?? 0) +
    " × " +
    formatTubeNumber(dimension.height_mm ?? 0) +
    " mm"
  );
}

export function tubeDimensionLabel(
  dimension: Pick<
    PublicTubeDimension,
    "product_family" | "outer_diameter_mm" | "width_mm" | "height_mm" | "thickness_mm"
  >,
) {
  const size = tubeSizeLabel(dimension);
  return size + " × " + formatTubeNumber(dimension.thickness_mm) + " mm";
}

export function tubeFamilyHubPath(familySlug: PublicTubeFamilySlug) {
  return "/knowledge/tubes/" + familySlug;
}

export function tubeSizeHubPath(
  familySlug: PublicTubeFamilySlug,
  sizeSlug: string,
) {
  return "/knowledge/tubes/" + familySlug + "/" + sizeSlug;
}

export function tubeSizeHubPathForDimension(
  dimension: Pick<
    PublicTubeDimensionSummary,
    "product_family" | "outer_diameter_mm" | "width_mm" | "height_mm"
  >,
) {
  const family = getTubeFamilyByProductFamily(dimension.product_family);
  if (!family) return "/knowledge/tubes";
  return tubeSizeHubPath(family.slug, tubeSizeSlug(dimension));
}

export function tubeSizeHubLabel(hub: PublicTubeSizeHubSummary) {
  return tubeSizeLabel(hub);
}
