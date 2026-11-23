// NET-PRODUCERS-FILTERS1 (founder decisions, 23 Nov 2026): filters for the
// producers page live in the address, so a filtered list can be shared and the
// back button works. Pure helpers, used by the server page and the client bar.
//
//   ?prodotto=…&prodotto=…  values as written in the sources (several = any of them)
//   ?norma=…                 standards, matched on the base code (EN 10219-1 → EN 10219)
//   ?grado=…                 steel grades
//   ?regione=…               one Italian region (registered sites)
//   ?doc=1                   only companies with documented technical data
//   ?menzioni=1              also match «menzioni da qualificare» (explicit switch)
//   ?ord=doc                 most documented first (default: name)

export type ProducerSort = "name" | "documented";

export type ProducerFilters = {
  products: string[];
  standards: string[];
  grades: string[];
  region: string | null;
  documentedOnly: boolean;
  includeMentions: boolean;
  sort: ProducerSort;
};

export const EMPTY_PRODUCER_FILTERS: ProducerFilters = {
  products: [],
  standards: [],
  grades: [],
  region: null,
  documentedOnly: false,
  includeMentions: false,
  sort: "name",
};

type RawParams = Record<string, string | string[] | undefined>;

const MAX_VALUES = 10;
const MAX_LENGTH = 80;

function list(raw: string | string[] | undefined): string[] {
  const values = Array.isArray(raw) ? raw : raw === undefined ? [] : [raw];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const clean = value.replace(/\s+/g, " ").trim();
    if (!clean || clean.length > MAX_LENGTH) continue;
    const key = clean.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(clean);
    if (out.length === MAX_VALUES) break;
  }
  return out;
}

function single(raw: string | string[] | undefined): string | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const clean = (value ?? "").replace(/\s+/g, " ").trim();
  return clean && clean.length <= 90 ? clean : null;
}

const on = (raw: string | string[] | undefined) => (Array.isArray(raw) ? raw[0] : raw) === "1";

export function parseProducerFilters(params: RawParams): ProducerFilters {
  return {
    products: list(params.prodotto),
    standards: list(params.norma),
    grades: list(params.grado),
    region: single(params.regione),
    documentedOnly: on(params.doc),
    includeMentions: on(params.menzioni),
    sort: (Array.isArray(params.ord) ? params.ord[0] : params.ord) === "doc" ? "documented" : "name",
  };
}

/** True when the list is narrowed (the sort alone does not count as a filter). */
export function hasActiveProducerFilters(filters: ProducerFilters): boolean {
  return (
    filters.products.length > 0 ||
    filters.standards.length > 0 ||
    filters.grades.length > 0 ||
    filters.region !== null ||
    filters.documentedOnly
  );
}

export function activeProducerFilterCount(filters: ProducerFilters): number {
  return (
    filters.products.length +
    filters.standards.length +
    filters.grades.length +
    (filters.region ? 1 : 0) +
    (filters.documentedOnly ? 1 : 0)
  );
}

/** Stable key: changes whenever the filtered list changes (used to reset selections). */
export function producerFiltersKey(filters: ProducerFilters): string {
  return JSON.stringify([
    filters.products, filters.standards, filters.grades, filters.region,
    filters.documentedOnly, filters.includeMentions, filters.sort,
  ]);
}

export function producerFilterParams(
  base: { q?: string; country: string; page?: number },
  filters: ProducerFilters,
): URLSearchParams {
  const params = new URLSearchParams();
  if (base.q) params.set("q", base.q);
  params.set("country", base.country);
  for (const value of filters.products) params.append("prodotto", value);
  for (const value of filters.standards) params.append("norma", value);
  for (const value of filters.grades) params.append("grado", value);
  if (filters.region) params.set("regione", filters.region);
  if (filters.documentedOnly) params.set("doc", "1");
  if (filters.includeMentions) params.set("menzioni", "1");
  if (filters.sort === "documented") params.set("ord", "doc");
  if (base.page && base.page > 1) params.set("p", String(base.page));
  return params;
}

export function toggleFilterValue(values: readonly string[], value: string): string[] {
  const key = value.toLowerCase();
  return values.some((v) => v.toLowerCase() === key)
    ? values.filter((v) => v.toLowerCase() !== key)
    : [...values, value].slice(0, MAX_VALUES);
}
