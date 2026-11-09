// Sintesi delle prime righe di una richiesta, offerta o ordine per la lista
// Commerciale. Solo lettura e solo testo già visibile all'utente (RLS).

export const ROW_LINES_FETCHED = 4;
const MAX_SPEC = 84;

type Row = Record<string, unknown>;

const unitLabels: Record<string, string> = {
  pz: "pz", pcs: "pz", t: "t", ton: "t", tons: "t", kg: "kg", m: "m", mt: "m",
  pacchi: "pacchi", pacco: "pacco", barre: "barre",
};

function cleanSpec(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value.replace(/[-–—_=]{2,}/g, " · ").replace(/\s+/g, " ").replace(/^[\s·]+|[\s·]+$/g, "");
  if (!text) return null;
  return text.length > MAX_SPEC ? text.slice(0, MAX_SPEC - 1).trimEnd() + "…" : text;
}

function quantityLabel(quantity: unknown, unit: unknown): string | null {
  const n = typeof quantity === "number" ? quantity : typeof quantity === "string" && quantity.trim() ? Number(quantity) : NaN;
  if (!Number.isFinite(n) || n <= 0) return null;
  const formatted = new Intl.NumberFormat("it-IT", { maximumFractionDigits: 3 }).format(n);
  const raw = typeof unit === "string" ? unit.trim().toLowerCase() : "";
  const label = raw ? (unitLabels[raw] ?? raw) : "";
  return label ? formatted + " " + label : formatted;
}

/** Restituisce materiale (prima riga, ripulita) e quantità; segnala se ce ne sono altre. */
export function summarizeRowLines(lines: unknown): { material?: string; quantity?: string } {
  if (!Array.isArray(lines) || lines.length === 0) return {};
  const rows = lines.filter((line): line is Row => Boolean(line) && typeof line === "object");
  if (!rows.length) return {};
  const first = rows[0];
  const spec = cleanSpec(first.raw_spec_text) ?? cleanSpec(first.source_text);
  const extra = rows.length >= ROW_LINES_FETCHED ? "altre righe" : rows.length > 1 ? "+" + (rows.length - 1) + (rows.length === 2 ? " riga" : " righe") : "";
  const quantity = quantityLabel(first.requested_quantity ?? first.quantity, first.quantity_unit);
  const material = spec ? (extra ? spec + " · " + (extra.startsWith("+") ? extra : "+ " + extra) : spec) : undefined;
  return { material, quantity: quantity ?? undefined };
}
