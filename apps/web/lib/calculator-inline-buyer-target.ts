/**
 * CALC-INT4.4C — buyer-only, explicit, ephemeral commercial target selection.
 *
 * Prices are never part of 4.4A's public session bill, clipboard, URL, events
 * or supplier traffic. No persistence: server-side, tenant-bound save is 4.4D.
 * This module reuses CALC-UX4's bidirectional converter and canonical buyer
 * bill's weight and pricing calculations; it is a pure in-memory adapter.
 */
import type { PriceBasis } from "@/lib/calculator-commercial-pricing";
import { convertCommercialRate, parseCommercialRate } from "@/lib/calculator-commercial-pricing";
import { calculateBuyerDistintaLine, type BuyerDistintaDraftLine } from "@/lib/buyer-distinta";
import type { InlineDistintaState } from "@/lib/calculator-inline-distinta";

export type BuyerTargetCandidate = {
  priceEurT: number;
  sourceKgM: number;
};
export type BuyerTargetState = Record<string, number>;
export type BuyerTargetResult = { ok: true; targets: BuyerTargetState } |
  { ok: false; reason: "invalid" | "missing" | "weight-mismatch" };

const safePrice = (value: number) => Number.isFinite(value) && value > 0 && value <= 100_000_000;
const validLine = (line: BuyerDistintaDraftLine) =>
  line.targetEurT === "" && calculateBuyerDistintaLine(line).complete;

export function captureBuyerTargetCandidate(
  raw: string,
  basis: PriceBasis,
  kgM: number,
): BuyerTargetCandidate | null {
  if ((basis !== "tonne" && basis !== "metre") ||
      !Number.isFinite(kgM) || kgM <= 0 ||
      parseCommercialRate(raw, "it") === null) return null;
  const tonne = basis === "tonne" ? parseCommercialRate(raw, "it") :
    convertCommercialRate(raw, "metre", kgM, "it");
  if (tonne === null || !safePrice(tonne)) return null;
  return { priceEurT: tonne, sourceKgM: kgM };
}

export function matchesBuyerTargetWeight(line: BuyerDistintaDraftLine, candidate: BuyerTargetCandidate): boolean {
  if (!validLine(line) || !safePrice(candidate.priceEurT) ||
      !Number.isFinite(candidate.sourceKgM) || candidate.sourceKgM <= 0) return false;
  const kgM = calculateBuyerDistintaLine(line).weightKgM;
  if (kgM === null) return false;
  // Existing buyer adapter serializes the calculated weight to 3 decimal
  // digits, so a tolerance of HALF a milligram per metre is required.
  return Math.abs(kgM - candidate.sourceKgM) <= 0.000501;
}

export function assignBuyerTargetToLine(
  state: InlineDistintaState,
  targets: BuyerTargetState,
  id: string,
  candidate: BuyerTargetCandidate,
): BuyerTargetResult {
  const line = state.lines.find(row => row.id === id);
  if (!line) return { ok: false, reason: "missing" };
  if (!matchesBuyerTargetWeight(line, candidate)) return { ok: false, reason: "weight-mismatch" };
  return { ok: true, targets: { ...targets, [id]: candidate.priceEurT } };
}

export function editBuyerTargetForLine(
  state: InlineDistintaState, targets: BuyerTargetState,
  id: string, raw: string, basis: PriceBasis,
): BuyerTargetResult {
  const line = state.lines.find(row => row.id === id);
  if (!line || !validLine(line)) return { ok: false, reason: "missing" };
  const kgM = calculateBuyerDistintaLine(line).weightKgM;
  if (kgM === null) return { ok: false, reason: "invalid" };
  const candidate = captureBuyerTargetCandidate(raw, basis, kgM);
  if (!candidate) return { ok: false, reason: "invalid" };
  return assignBuyerTargetToLine(state, targets, id, candidate);
}

export function removeBuyerTarget(targets: BuyerTargetState, id: string): BuyerTargetState {
  const next = { ...targets };
  delete next[id];
  return next;
}

export function pruneBuyerTargets(state: InlineDistintaState, targets: BuyerTargetState): BuyerTargetState {
  const ids = new Set(state.lines.map(line => line.id));
  return Object.fromEntries(Object.entries(targets).filter(([id, value])=>ids.has(id) && safePrice(value)));
}

export function buyerTargetPreview(line: BuyerDistintaDraftLine, targets: BuyerTargetState) {
  const tonne = targets[line.id];
  if (!safePrice(tonne) || !validLine(line)) return null;
  // Existing Buyer Distinta engine remains authoritative, including €/m and
  // quantity-level totals; the public copy/export never uses this projection.
  const calc = calculateBuyerDistintaLine({ ...line, targetEurT: String(tonne) });
  return calc.complete ? { eurT: calc.targetEurT!, eurM: calc.targetEurM!,
    estimatedTotal: calc.targetTotalEur! } : null;
}
