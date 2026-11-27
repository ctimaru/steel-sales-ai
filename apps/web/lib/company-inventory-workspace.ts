import type { ManagedNetworkInventory, NetworkInventoryItem, NetworkInventoryKind, NetworkInventoryUnit } from "@/lib/network-stock";

export type CompanyInventorySaveResult = { status: "saved" | "error"; message: string };

export type CompanyInventoryFilters = {
  query: string;
  kind: "all" | NetworkInventoryKind;
  visibility: "all" | "draft" | "published";
};

const kinds = ["stock", "incoming", "production"] as const;
const units = ["t", "kg", "m", "bars", "pcs"] as const;
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;

function searchText(value: string) {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("it-IT");
}

/** Filters only the records returned by the managed reader; their order is preserved. */
export function filterCompanyInventory(
  items: readonly NetworkInventoryItem[],
  filters: CompanyInventoryFilters,
): NetworkInventoryItem[] {
  const terms = searchText(filters.query).trim().split(/\s+/).filter(Boolean);
  return items.filter((item) => {
    if (filters.kind !== "all" && item.kind !== filters.kind) return false;
    if (filters.visibility !== "all" && item.publication_status !== filters.visibility) return false;
    const searchable = searchText([
      item.product_name, item.standard, item.grade, item.dimensions, item.location,
    ].filter(Boolean).join(" "));
    return terms.every((term) => searchable.includes(term));
  });
}

/** Record counts, never quantity totals or a claim about effective Network visibility. */
export function summarizeCompanyInventory(items: readonly NetworkInventoryItem[]) {
  return items.reduce((summary, item) => {
    summary.total += 1;
    summary[item.kind] += 1;
    if (item.publication_status === "draft") summary.draft += 1;
    if (item.publication_status === "published") summary.published += 1;
    return summary;
  }, { total: 0, stock: 0, incoming: 0, production: 0, draft: 0, published: 0 });
}

export function inventoryUnitLabel(unit: NetworkInventoryUnit): string {
  return { t: "t", kg: "kg", m: "m", bars: "barre", pcs: "pz" }[unit];
}

/** ISO dates must represent a real Gregorian calendar day, not a Date rollover. */
function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  if (year < 1 || month < 1 || month > 12 || day < 1) return false;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  return day <= [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
}

const updatedFormatter = new Intl.DateTimeFormat("it-IT", {
  day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Rome",
});

export function inventoryUpdatedLabel(iso: string): string | null {
  const timestamp = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,6})?(?:Z|[+-](\d{2}):(\d{2}))$/.exec(iso);
  if (!timestamp || !isCalendarDate(timestamp[1]) ||
      Number(timestamp[2]) > 23 || Number(timestamp[3]) > 59 || Number(timestamp[4]) > 59 ||
      Number(timestamp[5] ?? 0) > 23 || Number(timestamp[6] ?? 0) > 59) return null;
  const date = new Date(iso);
  return Number.isFinite(date.getTime()) ? updatedFormatter.format(date) : null;
}

function inventoryQuantity(value: string | number): number | null {
  const text = String(value).trim().replace(",", ".");
  // The writer stores numeric(14,3): reject precision loss instead of rounding silently.
  if (!/^(?:\d+(?:\.\d{1,3})?|\.\d{1,3})$/.test(text)) return null;
  const quantity = Number(text);
  return Number.isFinite(quantity) && quantity > 0 && quantity <= 1000000000 ? quantity : null;
}

export type CompanyInventoryInput = {
  companyId: string;
  itemId: string | null;
  kind: NetworkInventoryKind;
  productName: string;
  standard: string | null;
  grade: string | null;
  dimensions: string | null;
  quantity: number;
  unit: NetworkInventoryUnit;
  location: string | null;
  availableOn: string | null;
  publicationStatus: "draft" | "published" | "archived";
};

export type CompanyInventoryInputResult =
  | { ok: true; input: CompanyInventoryInput }
  | { ok: false; message: string };

/** A whitelist of company-declared fields; organization and provenance never come from the form. */
export function companyInventoryInput(formData: FormData): CompanyInventoryInputResult {
  const fields = [
    "network_company_id", "item_id", "kind", "product_name", "standard", "grade", "dimensions",
    "quantity", "unit", "location", "available_on", "intent",
  ] as const;
  const values: Record<(typeof fields)[number], string> = {} as Record<(typeof fields)[number], string>;
  for (const key of fields) {
    const entries = formData.getAll(key);
    if (entries.length > 1 || (entries.length === 1 && typeof entries[0] !== "string")) {
      return { ok: false, message: "I dati del modulo non sono validi. Rileggi i campi prima di salvare." };
    }
    values[key] = String(entries[0] ?? "").trim();
  }
  const publicationStatus = values.intent || "draft";
  if (!uuid.test(values.network_company_id) || (values.item_id && !uuid.test(values.item_id)) ||
      !["draft", "published", "archived"].includes(publicationStatus) ||
      (publicationStatus === "archived" && !values.item_id)) {
    return { ok: false, message: "La disponibilità non è valida. Aggiorna la pagina e riapri la scheda." };
  }
  if (!kinds.includes(values.kind as NetworkInventoryKind) ||
      !units.includes(values.unit as NetworkInventoryUnit)) {
    return { ok: false, message: "Scegli un tipo di disponibilità e un’unità di misura validi." };
  }
  if (values.product_name.length < 2 || values.product_name.length > 180) {
    return { ok: false, message: "Descrivi il prodotto con un testo da 2 a 180 caratteri." };
  }
  if (values.standard.length > 90 || values.grade.length > 90 ||
      values.dimensions.length > 160 || values.location.length > 180) {
    return { ok: false, message: "Riduci norma e grado a 90 caratteri, dimensioni a 160 e località a 180." };
  }
  const quantity = inventoryQuantity(values.quantity);
  if (quantity === null) return {
    ok: false, message: "Inserisci una quantità maggiore di zero, fino a 1.000.000.000, con al massimo tre decimali.",
  };
  const availableOn = values.kind === "stock" ? null : values.available_on || null;
  if ((availableOn !== null && !isCalendarDate(availableOn)) ||
      (publicationStatus === "published" && values.kind !== "stock" && availableOn === null)) {
    return { ok: false, message: "Indica una data prevista valida per pubblicare un arrivo o una produzione." };
  }
  return { ok: true, input: {
    companyId: values.network_company_id,
    itemId: values.item_id || null,
    kind: values.kind as NetworkInventoryKind,
    productName: values.product_name,
    standard: values.standard || null,
    grade: values.grade || null,
    dimensions: values.dimensions || null,
    quantity,
    unit: values.unit as NetworkInventoryUnit,
    location: values.location || null,
    availableOn,
    publicationStatus: publicationStatus as CompanyInventoryInput["publicationStatus"],
  } };
}

/** Public RPC omits status; managed RPC must declare it explicitly to avoid promoting ambiguous rows. */
export function normalizeCompanyInventoryRows(
  data: unknown,
  mode: "managed" | "public",
): NetworkInventoryItem[] {
  if (!Array.isArray(data)) return [];
  return data.flatMap((row: unknown) => {
    if (!row || typeof row !== "object" || Array.isArray(row)) return [];
    const value = row as Record<string, unknown>;
    const status = value.publication_status;
    if (mode === "managed" ? status !== "draft" && status !== "published" : status !== undefined && status !== "published") return [];
    if (typeof value.id !== "string" || !uuid.test(value.id) ||
        typeof value.company_id !== "string" || !uuid.test(value.company_id) ||
        typeof value.product_name !== "string" || value.provenance !== "company_declared" ||
        !kinds.includes(value.kind as NetworkInventoryKind) || !units.includes(value.unit as NetworkInventoryUnit) ||
        (typeof value.quantity !== "number" && typeof value.quantity !== "string") ||
        typeof value.updated_at !== "string") return [];
    const quantity = inventoryQuantity(value.quantity);
    if (quantity === null) return [];
    return [{
      id: value.id,
      company_id: value.company_id,
      kind: value.kind as NetworkInventoryKind,
      product_name: value.product_name,
      standard: typeof value.standard === "string" ? value.standard : null,
      grade: typeof value.grade === "string" ? value.grade : null,
      dimensions: typeof value.dimensions === "string" ? value.dimensions : null,
      quantity,
      unit: value.unit as NetworkInventoryUnit,
      location: typeof value.location === "string" ? value.location : null,
      available_on: typeof value.available_on === "string" ? value.available_on : null,
      updated_at: value.updated_at,
      provenance: "company_declared" as const,
      publication_status: status === "draft" ? "draft" as const : "published" as const,
    }];
  });
}

/** A malformed managed response is unavailable, not proof of an empty company inventory. */
export function parseManagedCompanyInventory(data: unknown, companyId: string): ManagedNetworkInventory {
  if (!Array.isArray(data)) return { items: [], ready: false };
  const items = normalizeCompanyInventoryRows(data, "managed");
  if (items.length !== data.length || items.some((item) => item.company_id !== companyId)) {
    return { items: [], ready: false };
  }
  return { items: items.slice(0, 100), ready: true };
}
