// NET-PRODUCERS-UX3 (founder request, 23 Nov 2026): the producers page was too
// crowded. Pure helpers for the compact list: one search box that routes a
// company name to the directory and a technical question to the AI search,
// and de-duplicated source values (the crawler can record the same word on
// several pages and in different letter cases: «tubi saldati», «TUBI SALDATI»).
// Nothing here infers a capability: values are only grouped for display and
// each one keeps the link to its first-party source.

export type ProducerValueKind =
  | "manufacturing_process"
  | "technical_standard"
  | "steel_grade"
  | "section_shape"
  | "dimension_range";

export type ProducerSourceValue = {
  id: string;
  kind: ProducerValueKind;
  value: string;
  sourceUrl: string;
  sourceTitle?: string;
};

export type GroupedProducerValue = {
  key: string;
  kind: ProducerValueKind;
  value: string;
  sourceUrl: string;
  sourceTitle?: string;
  /** How many records (pages or repeated mentions) carry the same value. */
  occurrences: number;
};

export const PRODUCER_VALUE_GROUPS: { kind: ProducerValueKind; label: string }[] = [
  { kind: "manufacturing_process", label: "Processo produttivo" },
  { kind: "technical_standard", label: "Norme dalle fonti" },
  { kind: "steel_grade", label: "Gradi indicati" },
  { kind: "section_shape", label: "Sezioni" },
  { kind: "dimension_range", label: "Gamme dimensionali" },
];

/** Order used for the 2–3 values shown on a row: what the company makes first. */
const HIGHLIGHT_ORDER: ProducerValueKind[] = [
  "manufacturing_process",
  "section_shape",
  "technical_standard",
  "steel_grade",
  "dimension_range",
];

function normalizeKey(value: string) {
  return value
    .normalize("NFKC")
    .replace(/[‐-―]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** Prefer the spelling that is not all capitals («Tubi saldati» over «TUBI SALDATI»),
 * except for codes where capitals are the norm (EN 10219, S355J2H). */
function betterSpelling(current: string, candidate: string) {
  const shouting = (s: string) => /[a-zà-ÿ]/i.test(s) && s === s.toUpperCase() && /\s/.test(s);
  if (shouting(current) && !shouting(candidate)) return candidate;
  return current;
}

/** Collapses values that differ only by case or spacing; keeps the first source link. */
export function groupProducerValues(items: readonly ProducerSourceValue[]): GroupedProducerValue[] {
  const byKey = new Map<string, GroupedProducerValue>();
  for (const item of items) {
    const text = item.value.replace(/\s+/g, " ").trim();
    if (!text) continue;
    const key = item.kind + ":" + normalizeKey(text);
    const existing = byKey.get(key);
    if (existing) {
      existing.occurrences += 1;
      existing.value = betterSpelling(existing.value, text);
      continue;
    }
    byKey.set(key, {
      key,
      kind: item.kind,
      value: text,
      sourceUrl: item.sourceUrl,
      sourceTitle: item.sourceTitle,
      occurrences: 1,
    });
  }
  return [...byKey.values()];
}

/**
 * The few values shown on a list row. Values documented with a source come
 * first; source mentions only fill the gap when no documented value exists.
 */
export function producerHighlights(
  documented: readonly ProducerSourceValue[],
  mentions: readonly ProducerSourceValue[],
  max = 3,
): { shown: GroupedProducerValue[]; hidden: number } {
  const pool = groupProducerValues(documented.length > 0 ? documented : mentions);
  const rank = (kind: ProducerValueKind) => HIGHLIGHT_ORDER.indexOf(kind);
  const sorted = [...pool].sort((a, b) => rank(a.kind) - rank(b.kind));
  return { shown: sorted.slice(0, max), hidden: Math.max(0, sorted.length - max) };
}

/**
 * One search box for two jobs. A company name or domain filters the directory
 * (the default); a question, a standard, a grade or a size goes to the AI
 * search with sources. Deliberately conservative: product words alone
 * («Alessio Tubi», «Acciaitubi») stay a name search.
 */
export function isProducerTechnicalQuestion(input: string): boolean {
  const text = input.trim();
  if (text.length < 4) return false;
  if (text.includes("?")) return true;
  if (/^(chi|cerco|cerca|trova|trovami|quali|quale|dove|vorrei|mi serve|mi servono|produttori|fornitori|who|which|find)\b/i.test(text))
    return true;
  if (/\b(EN|UNI|ISO|ASTM|API|DIN|ASME)\s?-?\s?\d{2,}/i.test(text)) return true;
  if (/\bS\s?\d{3}[A-Z0-9+]{0,6}\b/i.test(text)) return true;
  if (/\b(AISI|inox)\s?\d{3}/i.test(text)) return true;
  if (/\d+(?:[.,]\d+)?\s?[x×*]\s?\d+/i.test(text)) return true;
  return false;
}
