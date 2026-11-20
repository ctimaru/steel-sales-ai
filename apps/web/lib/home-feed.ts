import "server-only";

import {
  COMPANY_POSTS_PER_PAGE,
  decodeCompanyPostsToken,
  encodeCompanyPostsToken,
  parseCompanyPostsFeed,
  withCompanyPosts,
} from "@/lib/company-posts-model";
import {
  HOME_FEED_PAGE,
  advanceNetworkCursor,
  encodeHomeFeedCursor,
  homeFeedExhausted,
  interleaveHomeFeed,
  nextDistintaOffset,
  parseDistintaCompanies,
  sortCompanyRows,
  type HomeFeedCompanyRow,
  type HomeFeedConnect,
  type HomeFeedCursor,
  type HomeFeedItem,
} from "@/lib/home-feed-model";
import { getMarketplaceFeed, type MarketplaceFeedItem } from "@/lib/marketplace";
import { getPublishedCapabilityLabels } from "@/lib/network-compact-capabilities";
import { getFreeNetworkViewerRole, getNetworkBrowsePage, type FreeCompany } from "@/lib/network-free";
import { getNetworkRecipientReadiness } from "@/lib/network-recipient-readiness";
import { getSavedNetworkCompanyIds } from "@/lib/network-saved-set";
import { networkCountryName } from "@/lib/network-eu-countries";
import { networkNameIt } from "@/lib/network-taxonomy-it";
import { listPublicGradesPage, listPublicStandardsPage } from "@/lib/public-knowledge";
import { schoolArticles } from "@/lib/school-articles";
import { createClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type HomeFeedViewer = {
  organizationId: string;
  organizationName: string;
  /** "pro" with the Network entitlement, "free" with free read, null = no Network. */
  networkAccess: "pro" | "free" | null;
  /** Interactive roles may Connetti / Salva; viewers only read. */
  canInteract: boolean;
  /** CPOST1: company admins may delete their colleagues' posts (re-checked in SQL). */
  isAdmin: boolean;
};

export type HomeFeedPage = {
  items: HomeFeedItem[];
  nextCursor: string | null;
  /** Sources that failed on this page: shown as a quiet notice, never as "empty". */
  unavailable: Array<"network" | "school" | "marketplace" | "posts">;
};

function clean(value: unknown, max = 240): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function isOwnCompany(viewer: HomeFeedViewer, names: Array<string | null | undefined>): boolean {
  const own = viewer.organizationName.trim().toLowerCase();
  return Boolean(own) && names.some((name) => clean(name).toLowerCase() === own);
}

/** Saved state and Connetti readiness, only for roles that can act on them. */
async function rowActions(viewer: HomeFeedViewer, ids: string[]) {
  if (!viewer.canInteract || ids.length === 0) return { saved: new Set<string>(), readiness: new Map<string, HomeFeedConnect>() };
  const [savedIds, readiness] = await Promise.all([
    getSavedNetworkCompanyIds(viewer.organizationId, ids).catch(() => [] as string[]),
    getNetworkRecipientReadiness(viewer.organizationId, ids).catch(() => new Map()),
  ]);
  return { saved: new Set(savedIds), readiness: readiness as Map<string, HomeFeedConnect> };
}

function companyRow(
  company: FreeCompany,
  saved: Set<string>,
  readiness: Map<string, HomeFeedConnect>,
  capabilityLabels: Record<string, string[]>,
): HomeFeedCompanyRow | null {
  if (!UUID.test(company.id)) return null;
  const name = clean(company.trading_name) || clean(company.legal_name);
  if (!name) return null;
  const roles = Array.isArray(company.roles) ? company.roles : [];
  const primary = roles.find((role) => role?.is_primary) ?? roles[0];
  const country = clean(company.country_code, 2).toUpperCase();
  const place = [clean(company.location?.city) || clean(company.location?.region), networkCountryName(country) || country]
    .filter(Boolean)
    .join(" · ");
  // Why it is shown: what it makes or works, when the Network knows it.
  const products = (Array.isArray(company.products) ? company.products : []).slice(0, 2).map((p) => networkNameIt(p)).filter(Boolean);
  const capabilities = (capabilityLabels[company.id] ?? []).slice(0, 2).map((c) => networkNameIt(c)).filter(Boolean);
  const what = products.length ? products : capabilities;
  return {
    id: company.id,
    name,
    role: primary?.name ? networkNameIt(primary.name) : null,
    place,
    verified: company.verification_status === "verified",
    saved: saved.has(company.id),
    connect: readiness.get(company.id) ?? null,
    reason: what.length ? what.join(", ") : null,
  };
}

/** The general published Network, same ranking as /network, as one group. */
async function loadNetworkGroup(viewer: HomeFeedViewer, cursor: HomeFeedCursor) {
  if (!viewer.networkAccess || cursor.np === 0) {
    return { item: null as HomeFeedItem | null, next: { np: 0, ni: 0 }, failed: false };
  }
  try {
    // Same ranking as /network: the viewer's own role drives the persona order.
    const persona = await getFreeNetworkViewerRole(viewer.organizationId).catch(() => null);
    const page = await getNetworkBrowsePage(viewer.organizationId, viewer.networkAccess, "published", {
      persona: persona ?? undefined,
      page: cursor.np,
    });
    const slice = page.items
      .slice(cursor.ni, cursor.ni + HOME_FEED_PAGE.companies)
      .filter((c) => !isOwnCompany(viewer, [c.legal_name, c.trading_name]));
    const ids = slice.map((c) => c.id).filter((id) => UUID.test(id));
    const [actions, capabilityLabels] = await Promise.all([
      rowActions(viewer, ids),
      // Public, published facility capabilities: the same read /network uses for every tier.
      getPublishedCapabilityLabels(ids).catch(() => ({} as Record<string, string[]>)),
    ]);
    const rows = slice
      .map((c) => companyRow(c, actions.saved, actions.readiness, capabilityLabels))
      .filter(Boolean) as HomeFeedCompanyRow[];
    const taken = Math.min(HOME_FEED_PAGE.companies, Math.max(0, page.items.length - cursor.ni));
    const item: HomeFeedItem | null = rows.length
      ? { kind: "companies", key: "companies:network:" + cursor.np + ":" + cursor.ni, source: "network", families: [], companies: sortCompanyRows(rows), lockedTotal: null }
      : null;
    return { item, next: advanceNetworkCursor(cursor, page.items.length, taken, page.has_more), failed: false };
  } catch {
    // Stop paging this source rather than retry forever; the rest of the feed continues.
    return { item: null as HomeFeedItem | null, next: { np: 0, ni: 0 }, failed: true };
  }
}

/**
 * HOME-FEED2: companies that work the product families of the organization's
 * own bills (public.homefeed2_distinta_companies). Names only with Network
 * access; otherwise one teaser with the total. Any failure (including the
 * function not yet installed) ends this source and the general Network takes over.
 */
async function loadDistintaGroup(viewer: HomeFeedViewer, cursor: HomeFeedCursor) {
  if (!viewer.networkAccess || cursor.dm < 0) return { item: null as HomeFeedItem | null, dm: -1 };
  try {
    const db = await createClient();
    const { data, error } = await db.rpc("homefeed2_distinta_companies", {
      p_organization_id: viewer.organizationId,
      p_limit: HOME_FEED_PAGE.matched,
      p_offset: cursor.dm,
    });
    const page = error ? null : parseDistintaCompanies(data);
    if (!page || page.total === 0 || page.families.length === 0) return { item: null, dm: -1 };
    if (!page.networkEnabled) {
      // Teaser once, on the first page only.
      const item: HomeFeedItem | null = cursor.dm === 0
        ? { kind: "companies", key: "companies:distinte:locked", source: "distinte", families: page.families, companies: [], lockedTotal: page.total }
        : null;
      return { item, dm: -1 };
    }
    const visible = page.rows.filter((row) => !isOwnCompany(viewer, [row.name]));
    const actions = await rowActions(viewer, visible.map((row) => row.id));
    const rows: HomeFeedCompanyRow[] = visible.map((row) => ({
      id: row.id,
      name: row.name,
      role: row.role,
      place: row.countryCode ? networkCountryName(row.countryCode) || row.countryCode : "",
      verified: row.verified,
      saved: actions.saved.has(row.id),
      connect: actions.readiness.get(row.id) ?? null,
      reason: row.reason,
    }));
    const dm = nextDistintaOffset(cursor.dm, page.rows.length, page.total);
    const item: HomeFeedItem | null = rows.length
      ? { kind: "companies", key: "companies:distinte:" + cursor.dm, source: "distinte", families: page.families, companies: rows, lockedTotal: null }
      : null;
    return { item, dm };
  } catch {
    return { item: null as HomeFeedItem | null, dm: -1 };
  }
}

/** One companies group per page: the bills first, then the general Network. */
async function loadCompanyGroup(viewer: HomeFeedViewer, cursor: HomeFeedCursor) {
  const matched = await loadDistintaGroup(viewer, cursor);
  if (matched.item) {
    return { item: matched.item, dm: matched.dm, next: { np: cursor.np, ni: cursor.ni }, failed: false };
  }
  const network = await loadNetworkGroup(viewer, cursor);
  return { item: network.item, dm: matched.dm, next: network.next, failed: network.failed };
}

async function loadSchool(cursor: HomeFeedCursor) {
  const want = HOME_FEED_PAGE.school;
  const items: HomeFeedItem[] = [];
  let phase = cursor.sp;
  let offset = cursor.so;
  let failed = false;
  // Walk phases until the page is full or everything is exhausted.
  for (let guard = 0; items.length < want && phase !== "done" && guard < 4; guard++) {
    const need = want - items.length;
    if (phase === "articles") {
      const chunk = schoolArticles.slice(offset, offset + need);
      for (const a of chunk) {
        items.push({
          kind: "article",
          key: "article:" + a.slug,
          slug: a.slug,
          category: a.category,
          title: a.title,
          lead: clean(a.lead, 320),
          readMinutes: a.readMinutes,
          image: a.visual?.src ?? null,
          imageAlt: clean(a.visual?.alt, 200),
        });
      }
      offset += chunk.length;
      if (offset >= schoolArticles.length) { phase = "standards"; offset = 0; }
      continue;
    }
    try {
      if (phase === "standards") {
        const rows = await listPublicStandardsPage(offset, need);
        for (const s of rows) {
          if (!s.slug || !s.code) continue;
          items.push({
            kind: "standard",
            key: "standard:" + s.slug,
            slug: s.slug,
            code: clean(s.code, 60),
            title: clean(s.title, 160),
            explanation: clean(s.short_explanation || s.seo_description, 320),
            families: (s.product_families ?? []).slice(0, 3).map((f) => networkNameIt(f)).filter(Boolean),
          });
        }
        offset += rows.length;
        if (rows.length < need) { phase = "grades"; offset = 0; }
        continue;
      }
      const rows = await listPublicGradesPage(offset, need);
      for (const g of rows) {
        if (!g.slug || !g.designation) continue;
        items.push({
          kind: "grade",
          key: "grade:" + g.slug,
          slug: g.slug,
          designation: clean(g.designation, 60),
          family: clean(g.material_family, 80) || null,
          description: clean(g.short_description || g.seo_description, 320),
          standardSystem: clean(g.standard_system, 40) || null,
        });
      }
      offset += rows.length;
      if (rows.length < need) { phase = "done"; offset = 0; }
    } catch {
      failed = true;
      phase = "done";
      offset = 0;
    }
  }
  return { items, next: { sp: phase, so: offset }, failed };
}

function opportunityItem(item: MarketplaceFeedItem): HomeFeedItem | null {
  if (!UUID.test(item.request_id)) return null;
  if (item.effective_status !== "open" && item.effective_status !== "closing_soon") return null;
  const lines = (item.teaser_lines ?? [])
    .map((line) => [clean(line.product_family_name, 80), clean(line.quantity_band, 40)].filter(Boolean).join(" · "))
    .filter(Boolean)
    .slice(0, 3);
  if (!lines.length) return null;
  const firstCountry = clean(item.teaser_lines?.[0]?.delivery_country_code, 2).toUpperCase();
  const buyer = item.buyer?.visibility_mode === "named" ? clean(item.buyer.display_name, 120) || null : null;
  return {
    kind: "opportunity",
    key: "opportunity:" + item.request_id,
    id: item.request_id,
    buyer,
    lines,
    lineCount: Math.max(1, Math.min(500, item.line_count || lines.length)),
    country: /^[A-Z]{2}$/.test(firstCountry) ? networkCountryName(firstCountry) || firstCountry : null,
    closesAt: clean(item.closes_at, 40),
    closingSoon: item.effective_status === "closing_soon",
  };
}

async function loadOpportunities(viewer: HomeFeedViewer, cursor: HomeFeedCursor) {
  if (cursor.mo < 0) return { items: [] as HomeFeedItem[], next: -1, failed: false };
  try {
    const feed = await getMarketplaceFeed(viewer.organizationId, { limit: HOME_FEED_PAGE.opportunities, offset: cursor.mo });
    if (!feed || feed.contract !== "P5.2-feed-v1" || !Array.isArray(feed.items)) {
      return { items: [] as HomeFeedItem[], next: -1, failed: true };
    }
    const items = feed.items.map(opportunityItem).filter(Boolean) as HomeFeedItem[];
    const next = cursor.mo + feed.items.length;
    return { items, next: feed.items.length === 0 || next >= feed.total ? -1 : next, failed: false };
  } catch {
    return { items: [] as HomeFeedItem[], next: -1, failed: true };
  }
}

/**
 * CPOST1: posts by verified companies, newest first, through cpost1_feed.
 * The RPC re-derives the viewer from the session; it returns no posts while
 * the feature is switched off, which simply ends this source.
 */
async function loadCompanyPosts(cursor: HomeFeedCursor) {
  const position = decodeCompanyPostsToken(cursor.pc);
  if (position === "done") return { items: [] as HomeFeedItem[], next: "x", failed: false };
  try {
    const db = await createClient();
    const { data, error } = await db.rpc("cpost2_feed", {
      p_limit: COMPANY_POSTS_PER_PAGE,
      p_before_created_at: position === "start" ? null : position.beforeCreatedAt,
      p_before_id: position === "start" ? null : position.beforeId,
    });
    const page = error ? null : parseCompanyPostsFeed(data);
    if (!page) return { items: [] as HomeFeedItem[], next: "x", failed: Boolean(error) };
    return { items: page.items as HomeFeedItem[], next: encodeCompanyPostsToken(page.next), failed: false };
  } catch {
    return { items: [] as HomeFeedItem[], next: "x", failed: true };
  }
}

/** One page of the Home feed. Sources load in parallel and fail independently. */
export async function loadHomeFeedPage(viewer: HomeFeedViewer, cursor: HomeFeedCursor): Promise<HomeFeedPage> {
  const [companies, school, opportunities, posts] = await Promise.all([
    loadCompanyGroup(viewer, cursor),
    loadSchool(cursor),
    loadOpportunities(viewer, cursor),
    loadCompanyPosts(cursor),
  ]);
  const next: HomeFeedCursor = {
    v: 1,
    np: companies.next.np,
    ni: companies.next.ni,
    sp: school.next.sp,
    so: school.next.so,
    mo: opportunities.next,
    pc: posts.next,
    dm: companies.dm,
  };
  const unavailable: HomeFeedPage["unavailable"] = [];
  if (companies.failed) unavailable.push("network");
  if (school.failed) unavailable.push("school");
  if (opportunities.failed) unavailable.push("marketplace");
  if (posts.failed) unavailable.push("posts");
  return {
    items: withCompanyPosts(interleaveHomeFeed(companies.item, school.items, opportunities.items), posts.items),
    nextCursor: homeFeedExhausted(next) ? null : encodeHomeFeedCursor(next),
    unavailable,
  };
}
