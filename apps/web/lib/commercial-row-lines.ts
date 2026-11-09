// Sintesi delle prime righe di una richiesta, offerta o ordine per la lista
// Commerciale. Solo lettura e solo testo già visibile all'utente (RLS).

export const ROW_LINES_FETCHED = 4;
const MAX_SPEC = 84;

type Row = Record<string, unknown>;

const unitLabels: Record<string, string> = {
  pz: "pz", pcs: "pz", t: "t", ton: "t", tons: "t", kg: "kg", m: "m", mt: "m",
  pacchi: "pacchi", pacco: "pacco", barre: "barre",
};

// Importi in euro: la lista mostra materiale e quantità, mai prezzi.
const MONEY = /€\s*\d[\d.,]*(?:\s*\/\s*[\wà-ù.]+)?|\d[\d.,]*\s*(?:€|euro|eur)\b(?:\s*\/\s*[\wà-ù.]+)?|€/gi;

function cleanSpec(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value
    .replace(MONEY, " ")
    .replace(/[-–—_=]{2,}/g, " · ")
    .replace(/\s+/g, " ")
    .replace(/(?:\s*·\s*){2,}/g, " · ")
    .replace(/(?:\s+(?:a|da|di|per|al|il|e|franco|prezzo|prezzi))+\s*$/i, "")
    .replace(/^[\s·,;:]+|[\s·,;:]+$/g, "");
  if (!text) return null;
  return text.length > MAX_SPEC ? text.slice(0, MAX_SPEC - 1).trimEnd() + "…" : text;
}

// Una riga "sembra un materiale" se misure (80x80x10), norma (EN 10219) o qualità
// (S355J2H) compaiono all'inizio del testo. Le frasi libere delle email, dove le
// misure arrivano dopo un discorso, non lo sono.
const SPEC_PATTERN = /\d+(?:[.,]\d+)?\s*[x×]\s*\d+|\bEN\s*\d{4,5}\b|\bS\s?\d{3}[A-Z0-9]*\b/i;
const SPEC_START_WINDOW = 24;
function looksLikeSpec(raw: unknown): boolean {
  if (typeof raw !== "string") return false;
  const match = SPEC_PATTERN.exec(raw.trim());
  return match !== null && match.index <= SPEC_START_WINDOW;
}

function quantityLabel(quantity: unknown, unit: unknown): string | null {
  const n = typeof quantity === "number" ? quantity : typeof quantity === "string" && quantity.trim() ? Number(quantity) : NaN;
  if (!Number.isFinite(n) || n <= 0) return null;
  const formatted = new Intl.NumberFormat("it-IT", { maximumFractionDigits: 3 }).format(n);
  const raw = typeof unit === "string" ? unit.trim().toLowerCase() : "";
  const label = raw ? (unitLabels[raw] ?? raw) : "";
  return label ? formatted + " " + label : formatted;
}

/** Sceglie la prima riga che sembra un materiale; se nessuna lo è non inventa nulla. */
export function summarizeRowLines(lines: unknown): { material?: string; quantity?: string } {
  if (!Array.isArray(lines) || lines.length === 0) return {};
  const rows = lines.filter((line): line is Row => Boolean(line) && typeof line === "object");
  const chosen = rows.find((row) => looksLikeSpec(row.raw_spec_text) || looksLikeSpec(row.source_text));
  if (!chosen) return {};
  const spec = cleanSpec(looksLikeSpec(chosen.raw_spec_text) ? chosen.raw_spec_text : chosen.source_text);
  if (!spec) return {};
  const others = rows.length - 1;
  const extra = rows.length >= ROW_LINES_FETCHED ? "+ altre righe" : others > 0 ? "+" + others + (others === 1 ? " riga" : " righe") : "";
  const quantity = quantityLabel(chosen.requested_quantity ?? chosen.quantity, chosen.quantity_unit);
  return { material: extra ? spec + " · " + extra : spec, quantity: quantity ?? undefined };
}
