import "server-only";

import { createClient } from "@/lib/supabase/server";

/** NET-RESEARCH1 — «Profilo in breve» researched on the company's official
 * website (founder decisions 26 nov 2026). Published profiles for every
 * authenticated user; pilot profiles only for the platform superadmin. */
export type NetworkCompanyResearch = {
  preview: boolean;
  summary: string | null;
  activities: string[];
  products: string[];
  sectors: string[];
  certifications: string[];
  markets: string[];
  foundedYear: number | null;
  employeesBand: string | null;
  revenueBand: string | null;
  revenueYear: number | null;
  plantsCount: number | null;
  sourceUrls: string[];
  researchedAt: string | null;
};

const strings = (value: unknown, max: number) =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === "string" && v.length <= 80).slice(0, max) : [];
const int = (value: unknown) => (typeof value === "number" && Number.isInteger(value) ? value : null);
const text = (value: unknown) => (typeof value === "string" && value.trim() ? value : null);

export async function getNetworkCompanyResearch(companyId: string): Promise<NetworkCompanyResearch | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("net_research1_company_profile", { p_company_id: companyId });
    if (error || !data) return null;
    const row = data as Record<string, unknown>;
    const research: NetworkCompanyResearch = {
      preview: row.preview === true,
      summary: text(row.summary),
      activities: strings(row.activities, 12),
      products: strings(row.products, 20),
      sectors: strings(row.sectors, 12),
      certifications: strings(row.certifications, 12),
      markets: strings(row.markets, 12),
      foundedYear: int(row.founded_year),
      employeesBand: text(row.employees_band),
      revenueBand: text(row.revenue_band),
      revenueYear: int(row.revenue_year),
      plantsCount: int(row.plants_count),
      sourceUrls: strings(row.source_urls, 12).filter((u) => u.startsWith("https://")),
      researchedAt: text(row.researched_at),
    };
    const empty = !research.summary && !research.activities.length && !research.products.length
      && !research.certifications.length;
    return empty ? null : research;
  } catch {
    return null;
  }
}
