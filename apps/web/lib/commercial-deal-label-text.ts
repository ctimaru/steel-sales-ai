export const DEAL_LABEL_MAX = 80;

// Il nome della trattativa è un testo breve scelto dall'utente: niente a capo né caratteri di controllo.
export function normalizeDealLabel(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const clean = value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  return clean ? clean.slice(0, DEAL_LABEL_MAX) : null;
}
