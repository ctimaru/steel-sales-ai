// COMM-CYCLE2.B — customer-facing offer rates only. No buying targets.
import { convertCommercialRate, parseCommercialRate, type PriceBasis } from "./calculator-commercial-pricing.ts";

export type QuoteUnit = "EUR/t" | "EUR/m";
export type QuoteLineInput = { line_id: string; rate: string; unit: QuoteUnit; weight: string };
export type QuoteLinePayload = {
  line_id: string;
  price_value: number | null;
  price_unit: QuoteUnit | null;
  weight_kg_m: number | null;
};

export const UUID_V4ISH = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const QUOTE_UNITS: readonly QuoteUnit[] = ["EUR/t", "EUR/m"];

function readWeight(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = parseCommercialRate(value);
  return parsed !== null && parsed > 0 && parsed <= 100000 ? parsed : null;
}

export function normalizeQuoteLines(input: unknown):
  | { ok: true; lines: QuoteLinePayload[] }
  | { ok: false; message: string } {
  if (!Array.isArray(input) || input.length > 100) {
    return { ok: false, message: "La distinta può contenere al massimo 100 righe." };
  }
  const seen = new Set<string>();
  const lines: QuoteLinePayload[] = [];
  for (const candidate of input as QuoteLineInput[]) {
    if (!candidate || typeof candidate !== "object"
      || typeof candidate.line_id !== "string" || !UUID_V4ISH.test(candidate.line_id)
      || typeof candidate.rate !== "string" || candidate.rate.length > 40
      || !QUOTE_UNITS.includes(candidate.unit)
      || typeof candidate.weight !== "string" || candidate.weight.length > 40) {
      return { ok: false, message: "Una riga dell'offerta non è valida." };
    }
    if (seen.has(candidate.line_id)) {
      return { ok: false, message: "La distinta contiene una riga duplicata." };
    }
    seen.add(candidate.line_id);

    const rate = candidate.rate.trim() ? parseCommercialRate(candidate.rate) : null;
    if (candidate.rate.trim() && (rate === null || rate <= 0)) {
      return { ok: false, message: "Inserisci un prezzo maggiore di zero e valido per ogni riga valorizzata." };
    }
    const weight = readWeight(candidate.weight);
    if (candidate.weight.trim() && weight === null) {
      return { ok: false, message: "Il peso kg/m deve essere positivo e verificato." };
    }
    lines.push({
      line_id: candidate.line_id,
      price_value: rate,
      price_unit: rate === null ? null : candidate.unit,
      weight_kg_m: weight,
    });
  }
  return { ok: true, lines };
}

/** Optional preview, never silently assuming kg/m for unknown profiles. */
export function quoteEquivalentRate(rate: string, unit: QuoteUnit, weight: string): number | null {
  const kgM = readWeight(weight);
  if (kgM === null) return null;
  const basis: PriceBasis = unit === "EUR/t" ? "tonne" : "metre";
  return convertCommercialRate(rate, basis, kgM);
}

/** Total only when requested quantity and unit are measurable, or kg/m is provided.
 * Unknown piece/bar conversion remains 'not available' rather than fabricated. */
export function quoteEstimatedTotal(
  rate: string,
  unit: QuoteUnit,
  quantity: number | null,
  quantityUnit: string,
  weight: string,
): number | null {
  const price = parseCommercialRate(rate);
  if (price === null || price <= 0 || quantity === null || !Number.isFinite(quantity) || quantity <= 0) return null;
  const qty = quantityUnit.toLocaleLowerCase("it-IT").trim();
  if ((unit === "EUR/t" && ["t", "ton", "tonnes", "tonnellate"].includes(qty))
    || (unit === "EUR/m" && ["m", "metri", "metres"].includes(qty))) return price * quantity;
  const kgM = readWeight(weight);
  if (kgM === null) return null;
  if (unit === "EUR/t" && ["m", "metri", "metres"].includes(qty)) return price * quantity * kgM / 1000;
  if (unit === "EUR/m" && ["t", "ton", "tonnes", "tonnellate"].includes(qty)) return price * quantity * 1000 / kgM;
  return null;
}
