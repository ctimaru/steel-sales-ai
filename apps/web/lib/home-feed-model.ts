/**
 * HOME-FEED1: pure model for the Home feed (LinkedIn-style infinite scroll).
 *
 * The feed only re-presents content the viewer can already see elsewhere:
 * published Network companies, School guides and reference cards, Marketplace
 * public teasers and editorially published Steel Pulse news. It never invents
 * posts, never ranks by private data and never grants access: every source is
 * fetched server-side through the same permission-checked reads as its own page.
 *
 * CPOST1 adds the one exception, by founder decision (4 Nov 2026): text posts
 * written by verified companies, read through cpost1_feed.
 *
 * Kept free of runtime imports so it can be unit-tested in isolation.
 */

import type { CompanyPostItem } from "./company-posts-model";

/**
 * HOME-FEED2 (founder review, 20 Nov 2026): one row of a companies group.
 * `reason` says why the company is shown («Tubi · Produttore»).
 */
export type HomeFeedConnect = "available" | "connected" | "pending" | "unavailable" | null;

export type HomeFeedCompanyRow = {
  id: string;
  name: string;
  role: string | null;
  place: string;
  verified: boolean;
  saved: boolean;
  /** Connetti (founder decision, 2 Nov 2026) stays the relationship action in the feed. */
  connect: HomeFeedConnect;
  reason: string | null;
};

export type HomeFeedItem =
  | {
      /**
       * HOME-FEED2: Network companies arrive grouped, one card per feed page,
       * instead of one card per company (the feed read like a directory).
       * source "distinte": companies working the families of the organization's
       * own bills; "network": the general published Network.
       * lockedTotal: without Network PRO, only how many match (no names).
       */
      kind: "companies";
      key: string;
      source: "distinte" | "network";
      families: string[];
      companies: HomeFeedCompanyRow[];
      lockedTotal: number | null;
    }
  | {
      kind: "article";
      key: string;
      slug: string;
      category: string;
      title: string;
      lead: string;
      readMinutes: number;
      image: string | null;
      imageAlt: string;
    }
  | {
      kind: "standard";
      key: string;
      slug: string;
      code: string;
      title: string;
      explanation: string;
      families: string[];
    }
  | {
      kind: "grade";
      key: string;
      slug: string;
      designation: string;
      family: string | null;
      description: string;
      standardSystem: string | null;
    }
  | {
      kind: "opportunity";
      key: string;
      id: string;
      buyer: string | null;
      lines: string[];
      lineCount: number;
      country: string | null;
      closesAt: string;
      closingSoon: boolean;
    }
  | {
      kind: "news";
      key: string;
      headline: string;
      summary: string;
      sourceName: string;
      sourceUrl: string;
      publishedAt: string | null;
    }
  | CompanyPostItem;

/** School stream phases, in order: static articles, then standards, then grades. */
export type SchoolPhase = "articles" | "standards" | "grades" | "done";

export type HomeFeedCursor = {
  v: 1;
  /** Network browse page (1-based) and index inside it; page 0 = exhausted. */
  np: number;
  ni: number;
  /** School phase and offset within it. */
  sp: SchoolPhase;
  so: number;
  /** Marketplace offset; -1 = exhausted. */
  mo: number;
  /** CPOST1 company posts: "" = from the newest, "x" = exhausted, else a keyset token. */
  pc: string;
  /** HOME-FEED2 companies for the bills of material: offset, -1 = exhausted. */
  dm: number;
};

export const HOME_FEED_PAGE = { companies: 4, school: 2, opportunities: 1, matched: 4 } as const;
const MAX_INT = 100_000;

export const initialHomeFeedCursor: HomeFeedCursor = { v: 1, np: 1, ni: 0, sp: "articles", so: 0, mo: 0, pc: "", dm: 0 };

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max ? value : fallback;
}

export function encodeHomeFeedCursor(cursor: HomeFeedCursor): string {
  return [cursor.v, cursor.np, cursor.ni, cursor.sp, cursor.so, cursor.mo, cursor.pc, cursor.dm].join(".");
}

/** Tamper-tolerant: anything malformed restarts from the beginning, never throws. */
export function decodeHomeFeedCursor(value: unknown): HomeFeedCursor {
  if (typeof value !== "string" || value.length > 200) return initialHomeFeedCursor;
  const [v, np, ni, sp, so, mo, pc, dm] = value.split(".");
  if (v !== "1") return initialHomeFeedCursor;
  const phase: SchoolPhase = sp === "articles" || sp === "standards" || sp === "grades" || sp === "done" ? sp : "articles";
  return {
    v: 1,
    np: clampInt(Number(np), 0, MAX_INT, 1),
    ni: clampInt(Number(ni), 0, 100, 0),
    sp: phase,
    so: clampInt(Number(so), 0, MAX_INT, 0),
    mo: clampInt(Number(mo), -1, MAX_INT, 0),
    // Only the escaped keyset alphabet survives; anything else restarts the posts.
    pc: typeof pc === "string" && pc.length <= 120 && /^(x|[0-9T:_+Z-]+~[0-9a-f-]{36})?$/i.test(pc) ? pc : "",
    // Cursors issued before HOME-FEED2 have no 8th part: start from the bills.
    dm: dm === undefined ? 0 : clampInt(Number(dm), -1, MAX_INT, 0),
  };
}

export function homeFeedExhausted(cursor: HomeFeedCursor): boolean {
  return cursor.np === 0 && cursor.sp === "done" && cursor.mo === -1 && cursor.pc === "x" && cursor.dm === -1;
}

/**
 * HOME-FEED2: one page = at most one companies group, spaced between the
 * other sources so no source dominates a screen: S G O S (School, group,
 * opportunity, School). Missing sources simply close the gap.
 */
export function interleaveHomeFeed(
  group: HomeFeedItem | null,
  school: readonly HomeFeedItem[],
  opportunities: readonly HomeFeedItem[],
): HomeFeedItem[] {
  const s = [...school];
  const out: HomeFeedItem[] = [];
  if (s.length) out.push(s.shift()!);
  if (group) out.push(group);
  out.push(...opportunities);
  return [...out, ...s];
}

const FAMILY_LABELS: Record<string, string> = {
  tubes_pipes: "Tubi",
  flat_products: "Prodotti piani",
  long_products: "Prodotti lunghi",
};

const ROLE_LABELS: Record<string, string> = {
  producer: "Produttore",
  trader_distributor: "Commerciante",
  processor_service_provider: "Terzista",
  end_user: "Utilizzatore",
};

/** «Tubi», «Tubi e prodotti piani»: the families of the bills, in Italian. */
export function homeFeedFamilyText(keys: readonly string[]): string {
  const labels = keys.map((key) => FAMILY_LABELS[key]).filter(Boolean);
  if (labels.length === 0) return "";
  if (labels.length === 1) return labels[0];
  const lower = labels.map((label, index) => (index === 0 ? label : label.toLowerCase()));
  return lower.slice(0, -1).join(", ") + " e " + lower[lower.length - 1];
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type DistintaCompaniesPage = {
  networkEnabled: boolean;
  families: string[];
  total: number;
  rows: Array<{ id: string; name: string; countryCode: string | null; verified: boolean; role: string | null; reason: string | null }>;
};

/**
 * HOME-FEED2: validate public.homefeed2_distinta_companies. Anything off-contract
 * is null, which makes the loader fall back to the general Network.
 */
export function parseDistintaCompanies(raw: unknown): DistintaCompaniesPage | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const v = raw as Record<string, unknown>;
  if (v.contract !== "HOME-FEED2-distinta-companies-v1") return null;
  if (typeof v.network_enabled !== "boolean" || !Array.isArray(v.families) || !Array.isArray(v.items)) return null;
  if (typeof v.total !== "number" || !Number.isInteger(v.total) || v.total < 0) return null;
  const families = v.families.filter((f): f is string => typeof f === "string" && f in FAMILY_LABELS);
  const rows: DistintaCompaniesPage["rows"] = [];
  for (const item of v.items) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const id = typeof r.id === "string" ? r.id : "";
    const name = typeof r.company_name === "string" ? r.company_name.trim().slice(0, 160) : "";
    if (!UUID_RE.test(id) || !name) continue;
    const role = typeof r.role_key === "string" ? ROLE_LABELS[r.role_key] ?? null : null;
    const rowFamilies = Array.isArray(r.families) ? r.families.filter((f): f is string => typeof f === "string") : [];
    // The role is already on the row's detail line («Produttore · Italia»): the reason is the products.
    const reason = homeFeedFamilyText(rowFamilies) || null;
    const country = typeof r.country_code === "string" && /^[A-Z]{2}$/.test(r.country_code) ? r.country_code : null;
    rows.push({ id, name, countryCode: country, verified: r.verified === true, role, reason });
  }
  // Without Network access the server never sends names; never show any anyway.
  return { networkEnabled: v.network_enabled, families, total: v.total, rows: v.network_enabled ? rows : [] };
}

/** Next offset for the bills source, or -1 when the matches are over. */
export function nextDistintaOffset(offset: number, taken: number, total: number): number {
  const next = offset + taken;
  return taken <= 0 || next >= total ? -1 : next;
}

/** Inside a group: verified companies first, then the source order. */
export function sortCompanyRows<T extends { verified: boolean }>(rows: readonly T[]): T[] {
  return rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => Number(b.row.verified) - Number(a.row.verified) || a.index - b.index)
    .map((entry) => entry.row);
}

/** Drop repeated keys across pages (a source page can shift between requests). */
export function dedupeHomeFeed(existing: readonly string[], incoming: readonly HomeFeedItem[]): HomeFeedItem[] {
  const seen = new Set(existing);
  const out: HomeFeedItem[] = [];
  for (const item of incoming) {
    if (seen.has(item.key)) continue;
    seen.add(item.key);
    out.push(item);
  }
  return out;
}

/** Advance the Network part of the cursor after taking `taken` items from a page. */
export function advanceNetworkCursor(
  cursor: Pick<HomeFeedCursor, "np" | "ni">,
  pageLength: number,
  taken: number,
  hasMore: boolean,
): Pick<HomeFeedCursor, "np" | "ni"> {
  if (cursor.np === 0) return { np: 0, ni: 0 };
  const next = cursor.ni + taken;
  if (next < pageLength) return { np: cursor.np, ni: next };
  return hasMore ? { np: cursor.np + 1, ni: 0 } : { np: 0, ni: 0 };
}

/** Steel Pulse published cards → news posts. Only http(s) sources are kept. */
export function pulseNewsItems(
  cards: ReadonlyArray<{ headline?: unknown; summary?: unknown; source_name?: unknown; source_url?: unknown; source_published_at?: unknown }>,
): HomeFeedItem[] {
  const out: HomeFeedItem[] = [];
  for (const card of cards) {
    const headline = typeof card.headline === "string" ? card.headline.trim().slice(0, 200) : "";
    const url = typeof card.source_url === "string" ? card.source_url.trim() : "";
    if (!headline || !/^https?:\/\//i.test(url)) continue;
    out.push({
      kind: "news",
      key: "news:" + url,
      headline,
      summary: typeof card.summary === "string" ? card.summary.trim().slice(0, 400) : "",
      sourceName: typeof card.source_name === "string" ? card.source_name.trim().slice(0, 120) : "Fonte",
      sourceUrl: url,
      publishedAt: typeof card.source_published_at === "string" ? card.source_published_at : null,
    });
  }
  return out;
}

/** First page: up to two news posts on top, any further news after the page. */
export function withPulseNews(page: readonly HomeFeedItem[], news: readonly HomeFeedItem[]): HomeFeedItem[] {
  return dedupeHomeFeed([], [...news.slice(0, 2), ...page, ...news.slice(2)]);
}

const LEGAL_FORMS = new Set([
  "srl", "srls", "spa", "sapa", "snc", "sas", "scarl", "scrl", "coop", "societa", "soc",
  "ltd", "limited", "plc", "llc", "inc", "corp", "gmbh", "kg", "ohg", "ug", "ag", "sarl",
  "eurl", "sl", "sll", "bv", "nv", "oy", "oyj", "ab", "sro", "spzoo", "kft", "co",
]);

/**
 * HOME-FEED1B: avatar initials that tell companies apart. Legal forms
 * ("S.r.l.", "S.p.A.") and punctuation are ignored; a single word gives its
 * first two letters ("Tecnocurve S.r.l." → "TE", "Tubi S.p.A." → "TU").
 */
export function companyInitials(name: string): string {
  const words = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\./g, "")
    .split(/[^A-Za-z0-9]+/)
    .filter((word) => word && !LEGAL_FORMS.has(word.toLowerCase()));
  if (words.length === 0) return "•";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}
