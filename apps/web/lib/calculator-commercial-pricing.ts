/**
 * CALC-UX4 — Bidirectional commercial estimate based on the calculator's
 * theoretical kg/m. No market quote, tax, discount, margin or RFQ value.
 *
 * Monetary values never leave the mounted component: no URL, history,
 * localStorage, analytics, RFQ handoff, or backend persistence.
 */
export type PriceBasis = "tonne" | "metre";

export function parseCommercialRate(input: string): number | null {
  const raw = input.trim();
  // Commercial quick entry: plain positive numbers with ',' OR '.' decimals.
  // Reject grouped/ambiguous values instead of silently mispricing a quote.
  if (!/^\d{1,9}(?:[,.]\d{0,4})?$/.test(raw)) return null;
  const amount = Number(raw.replace(",", "."));
  return Number.isFinite(amount) && amount >= 0 && amount <= 100_000_000 ? amount : null;
}

export function convertCommercialRate(
  input: string,
  basis: PriceBasis,
  weightKgM: number | null,
): number | null {
  const amount = parseCommercialRate(input);
  if (amount === null || weightKgM === null || !Number.isFinite(weightKgM) || weightKgM <= 0) {
    return null;
  }
  const other = basis === "tonne"
    ? amount * weightKgM / 1000
    : amount * 1000 / weightKgM;
  return Number.isFinite(other) && other >= 0 && other <= 100_000_000 ? other : null;
}

export function priceInputText(value: number, locale: "it" | "en" | "de" | "fr" | "es") {
  return new Intl.NumberFormat(
    { it: "it-IT", en: "en-GB", de: "de-DE", fr: "fr-FR", es: "es-ES" }[locale],
    { useGrouping: false, maximumFractionDigits: 4, minimumFractionDigits: 0 },
  ).format(value);
}
