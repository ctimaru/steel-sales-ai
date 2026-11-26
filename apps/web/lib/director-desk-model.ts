// DIR-DESK1 (founder decisions, 25 nov 2026) — Scrivania della Direzione.
//
// Modulo puro: aggrega le trattative già costruite da commercial-deal-model per
// ufficio e per persona, e calcola i valori in euro dalle righe di offerte,
// ordini dei clienti e ordini ai fornitori. Nessuna stima: una riga con unità
// incoerenti (ad es. prezzo al metro e quantità in tonnellate senza peso kg/m)
// non ha un valore, e la pagina lo dice invece di inventarlo.

import { isDealDue, sortDeals, type CommercialDeal } from "./commercial-deal-model.ts";

export type DeskOfficeKey = "commercial" | "purchasing";
/** Ufficio della persona: «direction» per la Direzione, null se senza profilo. */
export type DeskPersonOffice = "direction" | DeskOfficeKey | null;

export type DeskMember = {
  userId: string;
  email: string;
  office: DeskPersonOffice;
  /** Permesso di scrittura nel workspace (un viewer non può ricevere pratiche). */
  canWrite: boolean;
};

/** Valore in euro di una trattativa: null = nessun documento con prezzi. */
export type DealValue = { eur: number | null; unknown: boolean };

export type DeskDeal = {
  deal: CommercialDeal;
  /** Responsabile: assegnatario (vendite) o proprietario della RFQ (acquisti). */
  responsibleId: string | null;
  value: DealValue;
};

export type DeskTotals = {
  open: number;
  todo: number;
  waiting: number;
  due: number;
  review: number;
  valueEur: number;
  /** Trattative aperte con prezzi ma senza un valore calcolabile. */
  valueUnknown: number;
};

export type DeskOffice = DeskTotals & { key: DeskOfficeKey; people: number };
export type DeskPerson = DeskTotals & { member: DeskMember };

export type DirectorDesk = {
  numbers: { salesTodo: number; purchaseTodo: number; dueSales: number; duePurchase: number; review: number };
  offices: Record<DeskOfficeKey, DeskOffice>;
  people: DeskPerson[];
  directors: number;
  withoutProfile: number;
  /** Trattative di vendita aperte senza responsabile nel team, le più urgenti prima. */
  unassigned: DeskDeal[];
  unassignedTotal: number;
};

// ── Valori in euro ────────────────────────────────────────────────────────────

type Unit = "t" | "kg" | "m" | "pz";

/** «T», «EUR/t», «€/ton», «MT», «PZ»… → unità normalizzata, o null se sconosciuta. */
export function normalizeUnit(value: unknown): Unit | null {
  if (typeof value !== "string") return null;
  const unit = value.trim().toLowerCase().replace(/^(eur|€)\s*\/\s*/, "").replace(/\.$/, "");
  if (["t", "ton", "tons", "tonn", "tonnellata", "tonnellate"].includes(unit)) return "t";
  if (["kg", "kgs", "chilogrammi"].includes(unit)) return "kg";
  if (["m", "mt", "ml", "metri", "metro"].includes(unit)) return "m";
  if (["pz", "pc", "pcs", "nr", "n", "pezzi", "pezzo"].includes(unit)) return "pz";
  return null;
}

const positive = (value: unknown): number | null => {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
};

export type PricedLine = {
  quantity: unknown;
  quantityUnit: unknown;
  price: unknown;
  priceUnit: unknown;
  weightKgM?: unknown;
};

/** Valore della riga in euro, o null se non calcolabile senza stime. */
export function lineValueEur(line: PricedLine): number | null {
  const q = positive(line.quantity);
  const p = positive(line.price);
  const qu = normalizeUnit(line.quantityUnit);
  const pu = normalizeUnit(line.priceUnit);
  const w = positive(line.weightKgM);
  if (q === null || p === null || !qu || !pu) return null;
  if (qu === pu) return q * p;
  const tonnes = qu === "t" ? q : qu === "kg" ? q / 1000 : qu === "m" && w ? (q * w) / 1000 : null;
  const meters = qu === "m" ? q : qu === "t" && w ? (q * 1000) / w : qu === "kg" && w ? q / w : null;
  if (pu === "t" && tonnes !== null) return tonnes * p;
  if (pu === "kg" && tonnes !== null) return tonnes * 1000 * p;
  if (pu === "m" && meters !== null) return meters * p;
  return null;
}

/**
 * Valore del documento: somma delle righe con prezzo. Se anche una sola riga con
 * prezzo non è calcolabile il documento non ha valore (un totale parziale
 * sembrerebbe giusto e non lo è).
 */
export function documentValue(lines: readonly PricedLine[]): DealValue {
  const priced = lines.filter((line) => positive(line.price) !== null);
  if (!priced.length) return { eur: null, unknown: false };
  let total = 0;
  for (const line of priced) {
    const value = lineValueEur(line);
    if (value === null) return { eur: null, unknown: true };
    total += value;
  }
  return { eur: Math.round(total * 100) / 100, unknown: false };
}

// ── Aggregazione ──────────────────────────────────────────────────────────────

function emptyTotals(): DeskTotals {
  return { open: 0, todo: 0, waiting: 0, due: 0, review: 0, valueEur: 0, valueUnknown: 0 };
}

function add(totals: DeskTotals, item: DeskDeal, now: number) {
  const { deal } = item;
  if (deal.bucket === "closed" || deal.kind === "distinta") return;
  totals.open += 1;
  if (deal.bucket === "todo") totals.todo += 1;
  if (deal.bucket === "waiting") totals.waiting += 1;
  if (deal.bucket === "review") totals.review += 1;
  if (isDealDue(deal, now)) totals.due += 1;
  if (item.value.eur !== null) totals.valueEur += item.value.eur;
  else if (item.value.unknown) totals.valueUnknown += 1;
}

const officeOrder: Record<string, number> = { direction: 0, commercial: 1, purchasing: 2, none: 3 };

export function buildDirectorDesk(deals: readonly DeskDeal[], members: readonly DeskMember[], now = Date.now()): DirectorDesk {
  const open = deals.filter((d) => d.deal.bucket !== "closed" && d.deal.kind !== "distinta");
  const sales = open.filter((d) => d.deal.side === "sales");
  const purchase = open.filter((d) => d.deal.side === "purchase");
  const memberIds = new Set(members.map((m) => m.userId));

  const offices: Record<DeskOfficeKey, DeskOffice> = {
    commercial: { key: "commercial", people: members.filter((m) => m.office === "commercial").length, ...emptyTotals() },
    purchasing: { key: "purchasing", people: members.filter((m) => m.office === "purchasing").length, ...emptyTotals() },
  };
  for (const item of sales) add(offices.commercial, item, now);
  for (const item of purchase) add(offices.purchasing, item, now);

  const people: DeskPerson[] = members.map((member) => {
    const totals = emptyTotals();
    for (const item of open) if (item.responsibleId === member.userId) add(totals, item, now);
    return { member, ...totals };
  }).sort((a, b) =>
    (officeOrder[a.member.office ?? "none"] - officeOrder[b.member.office ?? "none"]) ||
    b.open - a.open || a.member.email.localeCompare(b.member.email));

  const unassignedAll = sales.filter((d) => !d.responsibleId || !memberIds.has(d.responsibleId));
  const order = new Map(sortDeals(unassignedAll.map((d) => d.deal), now).map((deal, index) => [deal.key, index]));
  const unassigned = [...unassignedAll].sort((a, b) => (order.get(a.deal.key) ?? 0) - (order.get(b.deal.key) ?? 0));

  return {
    numbers: {
      salesTodo: sales.filter((d) => d.deal.bucket === "todo").length,
      purchaseTodo: purchase.filter((d) => d.deal.bucket === "todo").length,
      dueSales: sales.filter((d) => isDealDue(d.deal, now)).length,
      duePurchase: purchase.filter((d) => isDealDue(d.deal, now)).length,
      review: sales.filter((d) => d.deal.bucket === "review").length,
    },
    offices,
    people,
    directors: members.filter((m) => m.office === "direction").length,
    withoutProfile: members.filter((m) => m.office === null).length,
    unassigned: unassigned.slice(0, 20),
    unassignedTotal: unassigned.length,
  };
}

/** «€ 12.400»: euro interi, separatori italiani. */
export function formatEur(value: number): string {
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value);
}

// ── DIR-DESK2: presentazione ──────────────────────────────────────────────────

/** «m.rossi@azienda.it» → «MR»; «anna@…» → «AN». Solo per l'avatar. */
export function deskInitials(email: string): string {
  const local = email.split("@")[0] ?? "";
  const parts = local.split(/[._\-+]+/).filter((p) => /[a-z0-9]/i.test(p));
  const initials = parts.length >= 2 ? parts[0][0] + parts[1][0] : local.replace(/[^a-z0-9]/gi, "").slice(0, 2);
  return (initials || "?").toUpperCase();
}

const romeDay = (time: number) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit" }).format(time);

export type DeskDueTone = "late" | "soon" | "later" | "none";

/** Scadenza in giorni di calendario (ora di Roma): «Scaduta», «Scade oggi», «Domani», «Tra 4 giorni». */
export function deskDueLabel(dueAt: string | null, now = Date.now()): { label: string; tone: DeskDueTone } {
  const due = dueAt ? Date.parse(dueAt) : NaN;
  if (!Number.isFinite(due)) return { label: "Senza scadenza", tone: "none" };
  const days = Math.round((Date.parse(romeDay(due)) - Date.parse(romeDay(now))) / 86_400_000);
  if (days < 0) return { label: "Scaduta", tone: "late" };
  if (days === 0) return { label: "Scade oggi", tone: "late" };
  if (days === 1) return { label: "Domani", tone: "soon" };
  return { label: "Tra " + days + " giorni", tone: days <= 7 ? "soon" : "later" };
}

/** «Giovedì 26 novembre» (ora di Roma). */
export function deskToday(now = Date.now()): string {
  const text = new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", weekday: "long", day: "numeric", month: "long" }).format(now);
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Quote della barra di un ufficio: da fare, in attesa, da verificare, altre aperte (somma = open). */
export function deskOfficeSegments(office: Pick<DeskTotals, "open" | "todo" | "waiting" | "review">) {
  const review = Math.max(0, office.review);
  const rest = Math.max(0, office.open - office.todo - office.waiting - review);
  return { todo: office.todo, waiting: office.waiting, review, rest };
}

/** Percentuale per lo stile della barra, mai oltre 100. */
export function deskShare(part: number, total: number): string {
  if (!total || part <= 0) return "0%";
  return Math.min(100, (part / total) * 100).toFixed(1) + "%";
}
