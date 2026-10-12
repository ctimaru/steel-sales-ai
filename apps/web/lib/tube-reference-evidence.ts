/**
 * CALC-UX1 — conservative public source classification.
 *
 * K6 RPC exposes method, provider, source name and URL — not product-standard,
 * independent-verification evidence or grade fields. NEVER upgrade 'published'
 * to 'verified' merely because its K6 row is canonical or its mass matches a
 * geometry. Standard identification here is a presentation annotation only;
 * it does not mutate the canonical reference or imply EN 10210/10219 conformity.
 */
import type { PublicTubeDimensionSummary } from "@/lib/public-knowledge";

export type ReferenceStandard = "en10216-2" | "en10219" | "en10210" | "unspecified";
export type CalculatorStandard = "en10219" | "en10210" | "geometric";
type PublicReference = Pick<PublicTubeDimensionSummary,
  "source_name" | "source_url" | "source_provider" | "weight_method" | "product_family" |
  "outer_diameter_mm" | "width_mm" | "height_mm" | "thickness_mm">;

/** Documentary attribution for ONE reviewed MSZ PDF, not the whole provider. */
const mszP265gh = /^https:\/\/(?:www\.)?msz\.be\/upload\/file\/P265GH_FR_2\.pdf(?:[?#].*)?$/i;

export function referenceEvidence(reference: Pick<PublicReference, "source_name" | "source_url" | "source_provider" | "weight_method">) {
  const sourceName = reference.source_name?.trim() ?? "";
  const isMszP265gh = mszP265gh.test(reference.source_url ?? "") &&
    /metal service zwevegem/i.test(reference.source_provider ?? "");
  // A source document with an explicit standard may be labelled as such;
  // never infer from supplier name, dimensions or product family.
  const standard: ReferenceStandard = isMszP265gh ? "en10216-2" :
    /\bEN\s*10216\s*[-–]\s*2\b/i.test(sourceName) ? "en10216-2" :
    /\bEN\s*10219\b/i.test(sourceName) ? "en10219" :
    /\bEN\s*10210\b/i.test(sourceName) ? "en10210" : "unspecified";
  const declaredMethod = reference.weight_method === "verified" ? "verified" :
    reference.weight_method === "published" ? "published" : "unspecified";
  return {
    standard,
    declaredMethod,
    grade: isMszP265gh || /\bP265GH\b/i.test(sourceName) ? "P265GH" : null,
    sourceConfirmed: isMszP265gh,
  } as const;
}

export function sourceStandardLabel(standard: ReferenceStandard, locale: "it" | "en"): string {
  if (standard === "en10216-2") return "EN 10216-2";
  if (standard === "en10219") return "EN 10219";
  if (standard === "en10210") return "EN 10210";
  return locale === "it" ? "Norma non dichiarata" : "Standard not declared";
}

export function sourceMethodLabel(method: ReturnType<typeof referenceEvidence>["declaredMethod"], locale: "it" | "en") {
  if (method === "published") return locale === "it" ? "Pubblicato da fonte terza" : "Third-party published";
  if (method === "verified") return locale === "it" ? "Classificato verificato" : "Marked verified";
  return locale === "it" ? "Metodo non dichiarato" : "Method not declared";
}

export function isStandardComparable(reference: PublicReference, calculatorStandard: CalculatorStandard): boolean {
  if (calculatorStandard === "geometric") return false; // Free geometry is not a product standard.
  return referenceEvidence(reference).standard === calculatorStandard;
}

/** A proximity search for discoverability, NEVER a normative or mass equivalence assertion. */
export function relatedTubeReferences<T extends PublicReference>(
  references: readonly T[],
  selected: {
    family: PublicReference["product_family"];
    outerDiameter: number | null;
    width: number | null;
    height: number | null;
    thickness: number | null;
    standard: CalculatorStandard;
  },
  limit = 3,
) {
  const candidates = references.filter((reference) =>
    reference.product_family === selected.family &&
    isStandardComparable(reference, selected.standard)
  );
  if (!Number.isFinite(selected.thickness) || selected.thickness == null || selected.thickness <= 0) return [];
  const size = selected.family === "round_tube" ? selected.outerDiameter : selected.width;
  if (size == null || !Number.isFinite(size) || size <= 0) return [];
  if (selected.family === "rectangular_tube" && (selected.height == null || selected.height <= 0)) return [];

  return candidates
    .map((reference) => {
      const primary = selected.family === "round_tube" ? reference.outer_diameter_mm : reference.width_mm;
      const second = selected.family === "rectangular_tube" ? reference.height_mm : null;
      const distance = Math.abs((primary ?? 0) - size) / size +
        (selected.family === "rectangular_tube" ? Math.abs((second ?? 0) - (selected.height ?? 0)) / (selected.height ?? 1) : 0) +
        Math.abs(reference.thickness_mm - selected.thickness!) / selected.thickness!;
      return { reference, distance };
    })
    .filter((item) => item.distance <= 0.3) // Don't suggest distant cross-size weights as similar.
    .sort((a,b) => a.distance - b.distance)
    .slice(0, Math.max(0,limit))
    .map((item) => item.reference);
}
