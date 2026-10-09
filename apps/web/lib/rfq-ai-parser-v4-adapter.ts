import {
  makeRfqAiIntakeBatch,
  type RfqAiLocator, type RfqAiRawLine,
  type RfqAiSourceIntent, type RfqAiSourceRef,
} from "@/lib/rfq-ai-intake-contract";

/**
 * Read-only adapter for the existing worker ParserV4Adapter observations.
 * The legacy Python import ParserV31Adapter is an alias of ParserV4Adapter.
 * Do not connect this adapter to a save or dispatch action in RFQAI1.
 */
export type ParserV4Observation = Record<string, unknown>;

/** Intake provenance must not invent Excel row or PDF page numbers. */
export function mapParserV4Observation(raw: ParserV4Observation): RfqAiRawLine {
  const metadata = raw.metadata && typeof raw.metadata === "object" && !Array.isArray(raw.metadata)
    ? raw.metadata as Record<string, unknown> : {};
  const validation = metadata.validation && typeof metadata.validation === "object" &&
    !Array.isArray(metadata.validation)
    ? metadata.validation as Record<string, unknown> : {};
  const parserVersion = metadata.parser_contract_version;
  return {
    sourceText: raw.source_text,
    standard: raw.standard,
    grade: raw.grade,
    outerDiameterMm: raw.outer_diameter_mm,
    widthMm: raw.width_mm,
    heightMm: raw.height_mm,
    thicknessMm: raw.thickness_mm,
    lengthMm: raw.length_mm,
    quantity: raw.quantity,
    quantityUnit: raw.quantity_unit,
    itemRole: raw.item_role,
    parserConfidence: raw.confidence,
    // Legacy or damaged parser envelopes never bypass review.
    parserValidationStatus: parserVersion === "v4" ? validation.status : "review_required",
    // Supplier price_value / price_unit must never be silently mapped to
    // buyer targetEurT. That requires a separate governed interpretation.
  };
}

export function makeRfqAiBatchFromParserV4(
  source: RfqAiSourceRef, intent: RfqAiSourceIntent,
  observations: readonly ParserV4Observation[],
  knownLocators?: readonly (RfqAiLocator | null)[],
) {
  return makeRfqAiIntakeBatch(
    source,
    intent,
    observations.map((row, index) => ({
      candidateId: "v4-" + (index + 1),
      locator: knownLocators?.[index] ?? { kind: "extracted_observation" as const, observationIndex: index + 1 },
      raw: mapParserV4Observation(row),
    })),
  );
}
