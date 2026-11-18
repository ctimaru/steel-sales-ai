/**
 * RFQHUB1B (founder decision, 18 Nov 2026): «Fornitori RFQ» is one address
 * book. Active suppliers (used in RFQs), companies saved from the Network and,
 * for each supplier, the organization's own commercial contacts.
 * Pure merge and display logic, no data access.
 */

export type SupplierBookView = "attivi" | "salvati";

export function supplierBookView(raw: unknown): SupplierBookView {
  return raw === "salvati" ? "salvati" : "attivi";
}

export function supplierBookHref(view: SupplierBookView, query = ""): string {
  const params = new URLSearchParams();
  if (view !== "attivi") params.set("vista", view);
  if (query) params.set("q", query);
  const search = params.toString();
  return "/rfq-hub/suppliers" + (search ? "?" + search : "");
}

export type SupplierBookProfile = {
  id: string;
  identity_key?: string | null;
  tags?: string[];
  notes?: string | null;
  display_name: string | null;
  email: string | null;
  preferred: boolean;
  saved_in_network: boolean;
  supplier_network_company_id: string | null;
  supplier_company_id: string | null;
  rfq_count: number;
  response_rate_pct: number | string;
  last_used_at: string | null;
};

export type SupplierBookSaved = {
  network_company_id: string;
  name: string | null;
  country_code: string | null;
  saved_at: string | null;
};

export type SupplierBookCompany = {
  id: string;
  name: string;
  network_company_id: string | null;
};

export type SupplierBookContact = {
  id: string;
  company_id: string | null;
  full_name: string;
  email: string | null;
  phone: string | null;
  role: string | null;
};

export type SupplierBookRow = {
  key: string;
  name: string;
  active: boolean;
  saved: boolean;
  preferred: boolean;
  profileId: string | null;
  networkCompanyId: string | null;
  companyId: string | null;
  countryCode: string | null;
  fallbackEmail: string | null;
  rfqCount: number;
  responseRatePct: number | null;
  lastUsedAt: string | null;
  savedAt: string | null;
  contacts: SupplierBookContact[];
  /** RFQHUB1D: only requests actually sent count; drafts are counted apart. */
  sentCount: number;
  respondedCount: number;
  draftCount: number;
  tags: string[];
  notes: string | null;
};

/** One line of a supplier's RFQ use (buyer_rfq_suppliers), owner-scoped. */
export type SupplierBookUsage = {
  identity_key: string | null;
  rfq_id: string;
  sent_at: string | null;
  responded_at: string | null;
};

type UsageSets = { sent: Set<string>; responded: Set<string>; all: Set<string> };

function usageByIdentity(usage: SupplierBookUsage[]): Map<string, UsageSets> {
  const map = new Map<string, UsageSets>();
  for (const row of usage) {
    if (!row.identity_key) continue;
    const sets = map.get(row.identity_key) ?? { sent: new Set(), responded: new Set(), all: new Set() };
    sets.all.add(row.rfq_id);
    if (row.sent_at) sets.sent.add(row.rfq_id);
    if (row.responded_at) sets.responded.add(row.rfq_id);
    map.set(row.identity_key, sets);
  }
  return map;
}

/**
 * «2 richieste inviate · ha risposto a 1» / «Solo in 3 bozze, mai inviato» /
 * «Salvata il …». Drafts never count as requests nor lower the answer rate.
 */
export function supplierBookUsageLabel(row: SupplierBookRow, formatDate: (value: string) => string): string {
  if (row.sentCount > 0) {
    return row.sentCount + (row.sentCount === 1 ? " richiesta inviata" : " richieste inviate")
      + " · " + (row.respondedCount ? "ha risposto a " + row.respondedCount : "nessuna risposta finora")
      + (row.lastUsedAt ? " · ultima " + formatDate(row.lastUsedAt) : "");
  }
  if (row.active) {
    const drafts = row.draftCount || row.rfqCount;
    return "In " + drafts + (drafts === 1 ? " bozza" : " bozze") + ", non ancora inviato";
  }
  return "Salvata" + (row.savedAt ? " il " + formatDate(row.savedAt) : "") + " · non ancora usata nelle richieste";
}

function rate(value: number | string | null | undefined): number | null {
  const n = typeof value === "string" ? Number(value) : value;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}

/**
 * One row per supplier. A Network company is one supplier even when it was
 * used in RFQs, saved in the Network and has a private company in the
 * Commerciale: the row keeps every link and gathers its contacts once.
 */
export function buildSupplierBook(input: {
  profiles: SupplierBookProfile[];
  saved: SupplierBookSaved[];
  companies: SupplierBookCompany[];
  contacts: SupplierBookContact[];
  usage?: SupplierBookUsage[];
}): SupplierBookRow[] {
  const rows = new Map<string, SupplierBookRow>();
  const usage = usageByIdentity(input.usage ?? []);
  const rowUsage = new Map<string, UsageSets>();
  const addUsage = (key: string, identity: string | null | undefined) => {
    const sets = identity ? usage.get(identity) : undefined;
    if (!sets) return;
    const target = rowUsage.get(key) ?? { sent: new Set<string>(), responded: new Set<string>(), all: new Set<string>() };
    sets.sent.forEach((id) => target.sent.add(id));
    sets.responded.forEach((id) => target.responded.add(id));
    sets.all.forEach((id) => target.all.add(id));
    rowUsage.set(key, target);
  };
  const companyByNetwork = new Map<string, SupplierBookCompany>();
  for (const company of input.companies) {
    if (company.network_company_id) companyByNetwork.set(company.network_company_id, company);
  }

  for (const profile of input.profiles) {
    const network = profile.supplier_network_company_id;
    const key = network ? "network:" + network
      : profile.supplier_company_id ? "company:" + profile.supplier_company_id
      : "profile:" + profile.id;
    addUsage(key, profile.identity_key);
    const existing = rows.get(key);
    if (existing) {
      // Two profiles of the same supplier (e.g. two e-mails): sum the usage.
      existing.rfqCount += profile.rfq_count;
      existing.preferred ||= profile.preferred;
      if ((profile.last_used_at ?? "") > (existing.lastUsedAt ?? "")) existing.lastUsedAt = profile.last_used_at;
      continue;
    }
    rows.set(key, {
      key,
      name: profile.display_name || profile.email || "Fornitore",
      active: true,
      saved: profile.saved_in_network,
      preferred: profile.preferred,
      profileId: profile.id,
      networkCompanyId: network,
      companyId: profile.supplier_company_id ?? (network ? companyByNetwork.get(network)?.id ?? null : null),
      countryCode: null,
      fallbackEmail: profile.email,
      rfqCount: profile.rfq_count,
      responseRatePct: rate(profile.response_rate_pct),
      lastUsedAt: profile.last_used_at,
      savedAt: null,
      contacts: [],
      sentCount: 0,
      respondedCount: 0,
      draftCount: 0,
      tags: profile.tags ?? [],
      notes: profile.notes ?? null,
    });
  }

  for (const saved of input.saved) {
    const key = "network:" + saved.network_company_id;
    const existing = rows.get(key);
    if (existing) {
      existing.saved = true;
      existing.savedAt = saved.saved_at;
      existing.countryCode ??= saved.country_code;
      continue;
    }
    rows.set(key, {
      key,
      name: saved.name || companyByNetwork.get(saved.network_company_id)?.name || "Azienda salvata",
      active: false,
      saved: true,
      preferred: false,
      profileId: null,
      networkCompanyId: saved.network_company_id,
      companyId: companyByNetwork.get(saved.network_company_id)?.id ?? null,
      countryCode: saved.country_code,
      fallbackEmail: null,
      rfqCount: 0,
      responseRatePct: null,
      lastUsedAt: null,
      savedAt: saved.saved_at,
      contacts: [],
      sentCount: 0,
      respondedCount: 0,
      draftCount: 0,
      tags: [],
      notes: null,
    });
  }

  for (const [key, sets] of rowUsage) {
    const row = rows.get(key);
    if (!row) continue;
    row.sentCount = sets.sent.size;
    row.respondedCount = sets.responded.size;
    row.draftCount = [...sets.all].filter((id) => !sets.sent.has(id)).length;
  }

  const contactsByCompany = new Map<string, SupplierBookContact[]>();
  for (const contact of input.contacts) {
    if (!contact.company_id) continue;
    const list = contactsByCompany.get(contact.company_id) ?? [];
    list.push(contact);
    contactsByCompany.set(contact.company_id, list);
  }
  for (const row of rows.values()) {
    if (row.companyId) {
      row.contacts = (contactsByCompany.get(row.companyId) ?? [])
        .slice()
        .sort((a, b) => a.full_name.localeCompare(b.full_name, "it"));
    }
  }

  return [...rows.values()].sort((a, b) =>
    Number(b.preferred) - Number(a.preferred)
    || (b.lastUsedAt ?? b.savedAt ?? "").localeCompare(a.lastUsedAt ?? a.savedAt ?? "")
    || a.name.localeCompare(b.name, "it"));
}

export function supplierBookFilter(rows: SupplierBookRow[], view: SupplierBookView, query = ""): SupplierBookRow[] {
  const q = query.trim().toLowerCase();
  return rows.filter((row) => (view === "attivi" ? row.active : row.saved) && (!q
    || row.name.toLowerCase().includes(q)
    || (row.fallbackEmail ?? "").toLowerCase().includes(q)
    || row.contacts.some((c) => c.full_name.toLowerCase().includes(q) || (c.email ?? "").toLowerCase().includes(q))));
}

/** Contacts can be added when the supplier is a Network or Commerciale company. */
export function supplierBookCanAddContact(row: SupplierBookRow): boolean {
  return Boolean(row.networkCompanyId || row.companyId);
}

const saveErrors: Record<string, string> = {
  name: "Scrivi il nome del contatto.",
  email: "Indirizzo email non valido.",
  length: "Telefono o ruolo troppo lunghi.",
  target: "Fornitore non valido.",
  company_not_found: "Azienda non trovata.",
  network_company_not_found: "Azienda non più disponibile nel Network.",
  email_in_use: "Questa email è già un contatto di un altro fornitore.",
};

export function supplierContactError(code: unknown): string {
  return (typeof code === "string" && saveErrors[code]) || "Salvataggio non riuscito. Riprova.";
}

const supplierStatusLabels: Record<string, string> = {
  draft: "Bozza, non inviata",
  queued: "In invio",
  sent: "Inviata",
  delivered: "Consegnata",
  opened: "Letta",
  responded: "Ha risposto",
  declined: "Ha rinunciato",
  bounced: "Email non consegnata",
  complained: "Segnalata come indesiderata",
  failed: "Invio non riuscito",
  cancelled: "Annullata",
  awarded: "Aggiudicata",
  not_awarded: "Non aggiudicata",
};

/** What happened to the request for this supplier, in plain Italian. */
export function supplierRequestStatusLabel(status: string): string {
  return supplierStatusLabels[status] ?? "Stato da verificare";
}

/** Link to start a new request already pointed at this Network company. */
export function supplierRequestHref(networkCompanyId: string): string {
  return "/rfq-hub/distinta?network=" + encodeURIComponent(networkCompanyId);
}
