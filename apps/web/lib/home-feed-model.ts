/**
 * HOME-FEED1: pure model for the Home feed (LinkedIn-style infinite scroll).
 *
 * The feed only re-presents content the viewer can already see elsewhere:
 * published Network companies, School guides and reference cards, Marketplace
 * public teasers and editorially published Steel Pulse news. It never invents
 * posts, never ranks by private data and never grants access: every source is
 * fetched server-side through the same permission-checked reads as its own page.
 *
 * Kept free of runtime imports so it can be unit-tested in isolation.
 */

export type HomeFeedConnect = "available" | "connected" | "pending" | "unavailable" | null;

export type HomeFeedItem =
  | {
      kind: "company";
      key: string;
      id: string;
      name: string;
      role: string | null;
      place: string;
      products: string[];
      verified: boolean;
      saved: boolean;
      connect: HomeFeedConnect;
      /** HOME-FEED1B: published facility capabilities (same read as /network). */
      capabilities: string[];
      /** Validated http(s) website and its display domain. */
      website: { href: string; domain: string } | null;
      /** Location comes from a source, not confirmed by the company. */
      locationIndicative: boolean;
      market: string | null;
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
    };

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
};

export const HOME_FEED_PAGE = { companies: 6, school: 2, opportunities: 1 } as const;
const MAX_INT = 100_000;

export const initialHomeFeedCursor: HomeFeedCursor = { v: 1, np: 1, ni: 0, sp: "articles", so: 0, mo: 0 };

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max ? value : fallback;
}

export function encodeHomeFeedCursor(cursor: HomeFeedCursor): string {
  return [cursor.v, cursor.np, cursor.ni, cursor.sp, cursor.so, cursor.mo].join(".");
}

/** Tamper-tolerant: anything malformed restarts from the beginning, never throws. */
export function decodeHomeFeedCursor(value: unknown): HomeFeedCursor {
  if (typeof value !== "string" || value.length > 80) return initialHomeFeedCursor;
  const [v, np, ni, sp, so, mo] = value.split(".");
  if (v !== "1") return initialHomeFeedCursor;
  const phase: SchoolPhase = sp === "articles" || sp === "standards" || sp === "grades" || sp === "done" ? sp : "articles";
  return {
    v: 1,
    np: clampInt(Number(np), 0, MAX_INT, 1),
    ni: clampInt(Number(ni), 0, 100, 0),
    sp: phase,
    so: clampInt(Number(so), 0, MAX_INT, 0),
    mo: clampInt(Number(mo), -1, MAX_INT, 0),
  };
}

export function homeFeedExhausted(cursor: HomeFeedCursor): boolean {
  return cursor.np === 0 && cursor.sp === "done" && cursor.mo === -1;
}

/**
 * Interleave one page: companies form the backbone, School and Marketplace
 * posts are spaced through it so no source dominates a screen.
 * Pattern for 6 companies: C C S C O C S C C (school after 2nd and 4th,
 * opportunity after 3rd). Leftovers are appended in source order.
 */
export function interleaveHomeFeed(
  companies: readonly HomeFeedItem[],
  school: readonly HomeFeedItem[],
  opportunities: readonly HomeFeedItem[],
): HomeFeedItem[] {
  const out: HomeFeedItem[] = [];
  const s = [...school];
  const o = [...opportunities];
  companies.forEach((company, index) => {
    out.push(company);
    if ((index === 1 || index === 3) && s.length) out.push(s.shift()!);
    if (index === 2 && o.length) out.push(o.shift()!);
  });
  return [...out, ...s, ...o];
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
