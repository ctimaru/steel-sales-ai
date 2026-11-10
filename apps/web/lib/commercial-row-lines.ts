// Sintesi numerica delle righe di una richiesta, offerta o ordine per la lista
// Commerciale. Decisione di prodotto: nella lista NON compare testo libero preso
// dalle email (può contenere prezzi, condizioni e frasi private). Si leggono solo
// campi numerici: quantità e unità. Il testo completo resta nel dettaglio.

export const ROW_LINES_FETCHED = 4;

type Row = Record<string, unknown>;

const unitLabels: Record<string, string> = {
  pz: "pz", pcs: "pz", t: "t", ton: "t", tons: "t", kg: "kg", m: "m", mt: "m",
  pacchi: "pacchi", pacco: "pacco", barre: "barre",
};

function quantityLabel(quantity: unknown, unit: unknown): string | null {
  const n = typeof quantity === "number" ? quantity : typeof quantity === "string" && quantity.trim() ? Number(quantity) : NaN;
  if (!Number.isFinite(n) || n <= 0) return null;
  const formatted = new Intl.NumberFormat("it-IT", { maximumFractionDigits: 3 }).format(n);
  const raw = typeof unit === "string" ? unit.trim().toLowerCase() : "";
  const label = raw ? (unitLabels[raw] ?? raw) : "";
  return label ? formatted + " " + label : formatted;
}

/** Numero di righe (4+ se ce ne sono di più di quelle lette) e, solo se è una riga sola, la quantità. */
export function summarizeRowLines(lines: unknown): { lines?: string; quantity?: string } {
  if (!Array.isArray(lines)) return {};
  const rows = lines.filter((line): line is Row => Boolean(line) && typeof line === "object");
  if (!rows.length) return {};
  const count = rows.length >= ROW_LINES_FETCHED ? ROW_LINES_FETCHED + "+ righe" : rows.length === 1 ? "1 riga" : rows.length + " righe";
  const quantity = rows.length === 1 ? quantityLabel(rows[0].requested_quantity ?? rows[0].quantity, rows[0].quantity_unit) : null;
  return { lines: count, quantity: quantity ?? undefined };
}
