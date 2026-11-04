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
  type HomeFeedConnect,
  type HomeFeedCursor,
  type HomeFeedItem,
} from "@/lib/home-feed-model";
import { getMarketplaceFeed, type MarketplaceFeedItem } from "@/lib/marketplace";
import { getPublishedCapabilityLabels } from "@/lib/network-compact-capabilities";
import { getFreeNetworkViewerRole, getNetworkBrowsePage, safeNetworkWebsiteUrl, type FreeCompany } from "@/lib/network-free";
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

function companyItem(
  company: FreeCompany,
  saved: Set<string>,
  readiness: Map<string, HomeFeedConnect>,
  capabilityLabels: Record<string, string[]>,
): HomeFeedItem | null {
  if (!UUID.test(company.id)) return null;
  const name = clean(company.trading_name) || clean(company.legal_name);
  if (!name) return null;
  const roles = Array.isArray(company.roles) ? company.roles : [];
  const primary = roles.find((role) => role?.is_primary) ?? roles[0];
  const country = clean(company.country_code, 2).toUpperCase();
  const place = [clean(company.location?.city) || clean(company.location?.region), networkCountryName(country) || country]
    .filter(Boolean)
    .join(" · ");
  return {
    kind: "company",
    key: "company:" + company.id,
    id: company.id,
    name,
    role: primary?.name ? networkNameIt(primary.name) : null,
    place,
    products: (Array.isArray(company.products) ? company.products : []).slice(0, 3).map((p) => networkNameIt(p)).filter(Boolean),
    verified: company.verification_status === "verified",
    saved: saved.has(company.id),
    connect: readiness.get(company.id) ?? null,
    capabilities: (capabilityLabels[company.id] ?? []).slice(0, 3).map((c) => networkNameIt(c)).filter(Boolean),
    website: websiteOf(company.website_url),
    locationIndicative: company.geography_status === "sourced_unverified",
    market: clean(company.market_name, 80) || null,
  };
}

function websiteOf(value: string | null | undefined): { href: string; domain: string } | null {
  const href = safeNetworkWebsiteUrl(value);
  if (!href) return null;
  try {
    return { href, domain: new URL(href).hostname.replace(/^www\./, "") };
  } catch {
    return null;
  }
}

async function loadCompanies(viewer: HomeFeedViewer, cursor: HomeFeedCursor) {
  if (!viewer.networkAccess || cursor.np === 0) {
    return { items: [] as HomeFeedItem[], next: { np: 0, ni: 0 }, failed: false };
  }
  try {
    // Same ranking as /network: the viewer's own role drives the persona order.
    const persona = await getFreeNetworkViewerRole(viewer.organizationId).catch(() => null);
    const page = await getNetworkBrowsePage(viewer.organizationId, viewer.networkAccess, "published", {
      persona: persona ?? undefined,
      page: cursor.np,
    });
    const own = viewer.organizationName.trim().toLowerCase();
    const slice = page.items
      .slice(cursor.ni, cursor.ni + HOME_FEED_PAGE.companies)
      .filter((c) => clean(c.legal_name).toLowerCase() !== own && clean(c.trading_name).toLowerCase() !== own);
    const ids = slice.map((c) => c.id).filter((id) => UUID.test(id));
    const [savedIds, readiness, capabilityLabels] = await Promise.all([
      viewer.canInteract ? getSavedNetworkCompanyIds(viewer.organizationId, ids).catch(() => []) : Promise.resolve([]),
      viewer.canInteract
        ? getNetworkRecipientReadiness(viewer.organizationId, ids).catch(() => new Map())
        : Promise.resolve(new Map()),
      // Public, published facility capabilities: the same read /network uses for every tier.
      getPublishedCapabilityLabels(ids).catch(() => ({} as Record<string, string[]>)),
    ]);
    const saved = new Set(savedIds);
    const items = slice
      .map((c) => companyItem(c, saved, readiness as Map<string, HomeFeedConnect>, capabilityLabels))
      .filter(Boolean) as HomeFeedItem[];
    const taken = Math.min(HOME_FEED_PAGE.companies, Math.max(0, page.items.length - cursor.ni));
    return { items, next: advanceNetworkCursor(cursor, page.items.length, taken, page.has_more), failed: false };
  } catch {
    // Stop paging this source rather than retry forever; the rest of the feed continues.
    return { items: [] as HomeFeedItem[], next: { np: 0, ni: 0 }, failed: true };
  }
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
    loadCompanies(viewer, cursor),
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
  };
  const unavailable: HomeFeedPage["unavailable"] = [];
  if (companies.failed) unavailable.push("network");
  if (school.failed) unavailable.push("school");
  if (opportunities.failed) unavailable.push("marketplace");
  if (posts.failed) unavailable.push("posts");
  return {
    items: withCompanyPosts(interleaveHomeFeed(companies.items, school.items, opportunities.items), posts.items),
    nextCursor: homeFeedExhausted(next) ? null : encodeHomeFeedCursor(next),
    unavailable,
  };
}

/**
 * Right rail "Aziende da conoscere": the same ranked Network page as the feed,
 * taken from further down (index 12+), so it does not repeat the opening posts.
 */
export async function loadHomeSuggestedCompanies(viewer: HomeFeedViewer, limit = 4) {
  const result = await loadCompanies(viewer, { v: 1, np: 1, ni: 12, sp: "done", so: 0, mo: -1, pc: "x" });
  return result.items
    .filter((item): item is Extract<HomeFeedItem, { kind: "company" }> => item.kind === "company")
    .slice(0, Math.max(0, Math.min(6, limit)));
}
