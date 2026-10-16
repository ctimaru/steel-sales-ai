/**
 * CALC-UX4 — Bidirectional commercial estimate based on the calculator's
 * theoretical kg/m. No market quote, tax, discount, margin or RFQ value.
 *
 * Monetary values never leave the mounted component: no URL, history,
 * localStorage, analytics, RFQ handoff, or backend persistence.
 */
export type PriceBasis = "tonne" | "metre";

export type PriceLocale = "it" | "en" | "de" | "fr" | "es";

export function parseCommercialRate(input: string, locale: PriceLocale = "it"): number | null {
  const raw = input.trim();
  if (!raw || !/^[0-9.,]+$/.test(raw)) return null;
  const decimal = locale === "en" ? "." : ",";
  const grouping = locale === "en" ? "," : ".";
  const escape = (char: string) => "\\" + char;
  // A grouped monetary amount must be structurally correct (1.250,50 IT;
  // 1,250.50 EN). Single '1.250' IT is 1250, not a decimal 1.25.
  const groups = new RegExp("^\\d{1,3}(?:" + escape(grouping) + "\\d{3})+$");
  const groupedDecimal = new RegExp(
    "^\\d{1,3}(?:" + escape(grouping) + "\\d{3})+" + escape(decimal) + "\\d{1,4}$",
  );
  let normalized: string;
  if (groups.test(raw) || groupedDecimal.test(raw)) {
    normalized = raw.split(grouping).join("").replace(decimal, ".");
  } else {
    // Support intuitive simple dot/comma entry in every locale. Disallow
    // malformed combinations rather than silently misprice a steel offer.
    if (!/^\d{1,9}(?:[,.]\d{0,4})?$/.test(raw)) return null;
    normalized = raw.replace(",", ".");
  }
  const amount = Number(normalized);
  return Number.isFinite(amount) && amount >= 0 && amount <= 100_000_000 ? amount : null;
}

export function convertCommercialRate(
  input: string,
  basis: PriceBasis,
  weightKgM: number | null,
  locale: PriceLocale = "it",
): number | null {
  const amount = parseCommercialRate(input, locale);
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
