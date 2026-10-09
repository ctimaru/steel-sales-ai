import { calculateBuyerDistintaLine, type BuyerDistintaDraftLine } from "@/lib/buyer-distinta";
import { guidedTubeMeasurement, type GuidedTubeDraft } from "@/lib/buyer-tube-guidance";

/** Produce a canonical, complete RFQ line from one guided interaction.
 * Mass is theoretical and rounded exactly as the existing public builder.
 */
export function guidedTubeToBuyerLine(draft: GuidedTubeDraft, id: string): BuyerDistintaDraftLine | null {
  const measurement = guidedTubeMeasurement(draft);
  if (!measurement) return null;
  const line: BuyerDistintaDraftLine = {
    id,
    description: measurement.description,
    standard: measurement.standard,
    grade: draft.grade.trim().toUpperCase(),
    finish: draft.finish.trim(),
    quantityMode: draft.quantityMode,
    quantity: draft.quantity.trim(),
    barLengthM: draft.barLengthM.trim(),
    weightKgM: measurement.weightKgM.toLocaleString("it-IT", { maximumFractionDigits: 3 }),
    targetEurT: draft.targetEurT.trim(),
    note: draft.note.trim(),
  };
  return calculateBuyerDistintaLine(line).complete ? line : null;
}
