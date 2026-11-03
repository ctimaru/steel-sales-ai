/**
 * ONBOARDING-AUDIT2 · F3 — Italian VAT number (Partita IVA).
 *
 * Accepts the usual ways people type it ("IT 01234567890", "012.345.678-90")
 * and returns the 11 digits when the format and check digit are valid.
 * The check digit follows the Agenzia delle Entrate algorithm: odd positions
 * as-is, even positions doubled (minus 9 when above 9), then (10 - sum % 10) % 10.
 */
export function normalizeItalianVat(value: unknown): string | null {
  let digits = String(value ?? "").toUpperCase().replace(/[\s.\-/]/g, "");
  if (digits.startsWith("IT")) digits = digits.slice(2);
  if (!/^\d{11}$/.test(digits) || /^0{11}$/.test(digits)) return null;

  let sum = 0;
  for (let index = 0; index < 10; index += 1) {
    let digit = Number(digits.charAt(index));
    if (index % 2 === 1) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }

  return (10 - (sum % 10)) % 10 === Number(digits.charAt(10)) ? digits : null;
}

/** A new Italian company (no claimed profile) must give a valid Partita IVA. */
export function italianVatRequired(countryCode: unknown, hasClaim: boolean): boolean {
  return !hasClaim && String(countryCode ?? "").trim().toUpperCase() === "IT";
}

export function italianVatMessage(locale: "it" | "en"): string {
  return locale === "en"
    ? "Enter a valid Italian VAT number (Partita IVA, 11 digits)."
    : "Inserisci una Partita IVA italiana valida (11 cifre).";
}
