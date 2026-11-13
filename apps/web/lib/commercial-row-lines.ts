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

function numeric(value: unknown): number | null {
  const n = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Numero di righe (4+ se ce ne sono di più di quelle lette) e quantità.
 * La quantità compare con una riga sola, oppure come totale quando TUTTE le
 * righe sono state lette, hanno la stessa unità e un numero valido. Mai un
 * totale parziale (4+ righe) né una somma di unità diverse.
 */
export function summarizeRowLines(lines: unknown): { lines?: string; quantity?: string } {
  if (!Array.isArray(lines)) return {};
  const rows = lines.filter((line): line is Row => Boolean(line) && typeof line === "object");
  if (!rows.length) return {};
  const count = rows.length >= ROW_LINES_FETCHED ? ROW_LINES_FETCHED + "+ righe" : rows.length === 1 ? "1 riga" : rows.length + " righe";
  let quantity: string | null = null;
  if (rows.length === 1) {
    quantity = quantityLabel(rows[0].requested_quantity ?? rows[0].quantity, rows[0].quantity_unit);
  } else if (rows.length < ROW_LINES_FETCHED) {
    const unitOf = (row: Row) => {
      const raw = typeof row.quantity_unit === "string" ? row.quantity_unit.trim().toLowerCase() : "";
      return raw ? (unitLabels[raw] ?? raw) : "";
    };
    const unit = unitOf(rows[0]);
    const amounts = rows.map((row) => numeric(row.requested_quantity ?? row.quantity));
    if (unit && rows.every((row) => unitOf(row) === unit) && amounts.every((n) => n !== null)) {
      const total = quantityLabel(amounts.reduce<number>((sum, n) => sum + (n ?? 0), 0), unit);
      quantity = total ? "tot. " + total : null;
    }
  }
  return { lines: count, quantity: quantity ?? undefined };
}
