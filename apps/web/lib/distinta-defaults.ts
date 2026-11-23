import { formatBuyerDocumentRequirements, type BuyerDistintaDocumentRequirements } from "@/lib/buyer-distinta-documents";

/**
 * DISTINTA-DEFAULTS1 (founder decisions, 23 Nov 2026):
 * - a new Distinta is named «RDO <anno>/<progressivo a 4 cifre>» (editable);
 * - step 3 starts with a deadline 3 working days ahead at 12:00;
 * - the message to suppliers is pre-filled: price and availability, delivery
 *   times, offer validity, delivery terms and payment, requested certificates.
 * Pure functions, no I/O.
 */

/** The previous fixed name: still recognised as «no name chosen». */
export const LEGACY_DEFAULT_TITLE = "Richiesta di offerta";

export function romeYear(now: Date = new Date()): number {
  return Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Rome", year: "numeric" }).format(now));
}

export function rdoTitle(year: number, sequence: number): string {
  return "RDO " + year + "/" + String(Math.max(1, Math.trunc(sequence))).padStart(4, "0");
}

/** Next progressive number of the year among the titles the user can see. */
export function nextRdoTitle(titles: ReadonlyArray<string | null | undefined>, year: number): string {
  const pattern = new RegExp("^\\s*RDO\\s+" + year + "\\s*/\\s*(\\d{1,6})(?!\\d)", "i");
  let max = 0;
  for (const title of titles) {
    const match = typeof title === "string" ? title.match(pattern) : null;
    if (match) max = Math.max(max, Number(match[1]));
  }
  return rdoTitle(year, max + 1);
}

/** True for a name the user did not choose (automatic RDO or the legacy default). */
export function isAutomaticDistintaTitle(title: string, automatic: string | null): boolean {
  const value = title.trim();
  return value === LEGACY_DEFAULT_TITLE || (automatic !== null && value === automatic);
}

/** 3 working days ahead (Saturday and Sunday skipped), 12:00 in the browser's time zone. */
export function defaultOfferDeadline(now: Date = new Date(), workingDays = 3): Date {
  const date = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0, 0);
  let added = 0;
  while (added < workingDays) {
    date.setDate(date.getDate() + 1);
    const day = date.getDay();
    if (day !== 0 && day !== 6) added += 1;
  }
  return date;
}

/** Value for <input type="datetime-local"> in local time (not UTC). */
export function toDateTimeLocalValue(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate()) +
    "T" + pad(date.getHours()) + ":" + pad(date.getMinutes());
}

export function defaultSupplierMessage(input: {
  title: string;
  lineCount: number;
  totalTonnes: number | null;
  documents: BuyerDistintaDocumentRequirements | null;
}): string {
  const articles = input.lineCount === 1 ? "1 articolo" : input.lineCount + " articoli";
  const tonnes = input.totalTonnes !== null && Number.isFinite(input.totalTonnes) && input.totalTonnes > 0
    ? ", circa " + input.totalTonnes.toLocaleString("it-IT", { maximumFractionDigits: 2 }) + " t" : "";
  const certificates = input.documents ? formatBuyerDocumentRequirements(input.documents) : "";
  return [
    "Buongiorno,",
    "",
    "vi chiediamo la vostra migliore offerta per la distinta «" + input.title.trim() + "» (" + articles + tonnes + "), entro la scadenza indicata.",
    "",
    "Per ogni articolo indicate per favore:",
    "- prezzo e disponibilità",
    "- tempi di consegna",
    "- validità dell'offerta",
    "- resa e condizioni di pagamento",
    // formatBuyerDocumentRequirements already reads «Documentazione richiesta per l'intera distinta: …».
    ...(certificates ? ["", certificates + "."] : []),
    "",
    "Grazie, cordiali saluti.",
  ].join("\n");
}
