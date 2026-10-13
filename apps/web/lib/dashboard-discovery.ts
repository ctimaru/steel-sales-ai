import type { MarketplaceFeedItem } from "@/lib/marketplace";
import type { NetworkActivityItem } from "@/lib/network";
import type { PulseAdvancedInterests } from "@/lib/steel-pulse-advanced";

// Only existing, viewer-authorized P5.2 public teaser lines and P4 activity summaries
// may enter the dashboard. No RFQ Hub owner records, inquiry payloads or prices.
export type DashboardOpportunity = {
  id: string;
  product: string;
  lineCount: number;
  delivery: string;
  closingSoon: boolean;
  anonymousBuyer: boolean;
  reason: string | null;
};
export type DashboardFollowedUpdate = {
  id: string;
  companyId: string;
  companyName: string;
  summary: string;
  occurredAt: string;
  unread: boolean;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const productTerms: Record<string, readonly string[]> = {
  round_tubes: ["round", "tond", "circular"],
  hollow_sections: ["hollow", "profil", "quadrat", "rettangol", "square", "rectangular"],
  seamless_tubes: ["seamless", "senza saldatura"],
  welded_tubes: ["welded", "saldat"],
  stainless_steel: ["stainless", "inox", "inossidabil"],
  steel_processing: ["processing", "lavoraz", "taglio", "fabrication"],
};
const regionTerms: Record<string, readonly string[]> = {
  north_west: ["lombardia","piemonte","liguria","valle d'aosta"],
  north_east: ["veneto","friuli","trentino","emilia-romagna"],
  center: ["toscana","umbria","marche","lazio"],
  south: ["abruzzo","molise","campania","puglia","basilicata","calabria"],
  islands: ["sicilia","sardegna"],
};

function interestMatch(item: MarketplaceFeedItem, interests: PulseAdvancedInterests) {
  const lines = item.teaser_lines;
  const product = interests.product_interests.some((key) =>
    lines.some((line) => {
      const text = [line.product_family_key,line.product_family_name,line.manufacturing_process ?? ""].join(" ").toLowerCase();
      return (productTerms[key] ?? []).some((term) => text.includes(term));
    }),
  );
  const territory = interests.territory_interests.some((key) => lines.some((line) => {
    const country = line.delivery_country_code.toUpperCase();
    const region = (line.delivery_region ?? "").toLowerCase();
    if (key === "italy") return country === "IT";
    if (key === "europe") return ["IT","DE","FR","ES","AT","BE","NL","PL","PT","CZ","SK","SI","HR","HU","RO","BG","GR","SE","FI","DK","IE","EE","LV","LT","LU","CY","MT"].includes(country);
    if (key === "usa") return country === "US";
    return country === "IT" && (regionTerms[key] ?? []).some((name) => region.includes(name));
  }));
  return { score: (product ? 2 : 0) + (territory ? 1 : 0), product, territory };
}

export function selectDashboardOpportunities(
  items: readonly MarketplaceFeedItem[],
  interests: PulseAdvancedInterests,
  limit = 3,
): DashboardOpportunity[] {
  return items
    .filter((item) =>
      UUID.test(item.request_id) &&
      (item.effective_status === "open" || item.effective_status === "closing_soon") &&
      (item.visibility_mode === "anonymous" || item.visibility_mode === "named") &&
      item.buyer?.visibility_mode === item.visibility_mode &&
      Array.isArray(item.teaser_lines) && item.teaser_lines.length > 0 &&
      item.teaser_lines.every((line) =>
        typeof line.product_family_name === "string" &&
        typeof line.product_family_key === "string" &&
        typeof line.delivery_country_code === "string",
      ),
    )
    .map((item, index) => ({ item, index, match: interestMatch(item, interests) }))
    .sort((a,b) => b.match.score - a.match.score || a.index - b.index)
    .slice(0, Math.max(0, Math.min(6, Math.floor(limit))))
    .map(({ item, match }) => {
      const first = item.teaser_lines[0];
      const country = first.delivery_country_code.toUpperCase();
      const delivery = /^[A-Z]{2}$/.test(country) ? country : "da definire";
      return {
        id: item.request_id,
        product: first.product_family_name.slice(0, 120),
        lineCount: Math.max(1, Math.min(500, item.line_count)),
        delivery,
        closingSoon: item.effective_status === "closing_soon",
        anonymousBuyer: item.visibility_mode === "anonymous",
        reason: match.product && match.territory ? "Prodotto e territorio di interesse"
          : match.product ? "Prodotto di interesse"
          : match.territory ? "Territorio di interesse"
          : null,
      };
    });
}

export function selectDashboardFollowedUpdates(
  items: readonly NetworkActivityItem[],
  limit = 3,
): DashboardFollowedUpdate[] {
  return items
    .filter((item) =>
      UUID.test(item.activity_event_id) &&
      UUID.test(item.network_company_id) &&
      typeof item.company_name === "string" &&
      typeof item.summary === "string" && item.summary.trim().length > 0 &&
      typeof item.occurred_at === "string" && !Number.isNaN(Date.parse(item.occurred_at)),
    )
    .slice(0, Math.max(0, Math.min(6, Math.floor(limit))))
    .map((item) => ({
      id: item.activity_event_id,
      companyId: item.network_company_id,
      companyName: item.company_name.slice(0, 120),
      summary: item.summary.slice(0, 320),
      occurredAt: item.occurred_at,
      unread: item.is_unread === true,
    }));
}
