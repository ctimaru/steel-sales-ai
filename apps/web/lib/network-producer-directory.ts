import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { NetworkProDirectory, NetworkProDirectoryResult } from "@/lib/network-pro-coverage";
import type { ProducerFilters } from "@/lib/network-producer-filters";

// NET-PRODUCERS-FILTERS1: filtered and sorted producer directory for Italy.
// Calls run under the viewer's own token (never a service key); the RPC checks
// the live producers/IT entitlement again and fails closed with 42501.
// When the RPC is not available (not yet migrated, or any other error) the
// caller falls back to netpro1b_scoped_directory without filters.

export type ProducerRowCounts = { documentedValues: number; catalogs: number; mentions: number };

export type ProducerFilteredDirectory = {
  result: NetworkProDirectoryResult;
  counts: Record<string, ProducerRowCounts>;
};

export type ProducerFacetValue = { value: string; label: string; companies: number };

export type ProducerFacets = {
  products: ProducerFacetValue[];
  standards: ProducerFacetValue[];
  grades: ProducerFacetValue[];
  regions: ProducerFacetValue[];
  documentedCompanies: number;
};

const count = (x: unknown): x is number => typeof x === "number" && Number.isSafeInteger(x) && x >= 0;
const record = (x: unknown): Record<string, unknown> | null =>
  x && typeof x === "object" && !Array.isArray(x) ? (x as Record<string, unknown>) : null;

/** Strict parser: any unexpected shape means «not available», never a partial list. */
export function parseProducerFilteredDirectory(payload: unknown): {
  directory: NetworkProDirectory;
  counts: Record<string, ProducerRowCounts>;
} | null {
  const obj = record(payload);
  if (
    obj?.contract !== "netproducers2-directory-v1" ||
    obj.country !== "IT" ||
    !count(obj.total) || !count(obj.page) || obj.page < 1 ||
    !count(obj.limit) || obj.limit < 1 || obj.limit > 24 ||
    obj.manufacturer_confirmed !== false || obj.exact_combination_confirmed !== false ||
    !Array.isArray(obj.items) || obj.items.length > obj.limit
  ) return null;
  const items: NetworkProDirectory["items"] = [];
  const counts: Record<string, ProducerRowCounts> = {};
  for (const item of obj.items) {
    const row = record(item);
    if (
      !row || typeof row.id !== "string" || typeof row.name !== "string" || row.name.length > 600 ||
      row.country_code !== "IT" ||
      (row.website_url !== null && typeof row.website_url !== "string") ||
      !count(row.documented_values) || !count(row.catalogs) || !count(row.mentions)
    ) return null;
    items.push({ id: row.id, name: row.name, countryCode: "IT", websiteUrl: row.website_url as string | null });
    counts[row.id] = { documentedValues: row.documented_values, catalogs: row.catalogs, mentions: row.mentions };
  }
  return {
    directory: {
      contract: "netpro1b-scoped-directory-v1",
      module: "producers",
      country: "IT",
      total: obj.total,
      page: obj.page,
      limit: obj.limit,
      items,
    },
    counts,
  };
}

function facetList(raw: unknown): ProducerFacetValue[] | null {
  if (!Array.isArray(raw) || raw.length > 60) return null;
  const out: ProducerFacetValue[] = [];
  for (const item of raw) {
    const row = record(item);
    if (
      !row || typeof row.value !== "string" || typeof row.label !== "string" ||
      row.value.length > 200 || row.label.length > 200 || !count(row.companies)
    ) return null;
    out.push({ value: row.value, label: row.label, companies: row.companies });
  }
  return out;
}

export function parseProducerFacets(payload: unknown): ProducerFacets | null {
  const obj = record(payload);
  if (obj?.contract !== "netproducers2-facets-v1" || obj.country !== "IT" || !count(obj.documented_companies))
    return null;
  const products = facetList(obj.products);
  const standards = facetList(obj.standards);
  const grades = facetList(obj.grades);
  const regions = facetList(obj.regions);
  if (!products || !standards || !grades || !regions) return null;
  return { products, standards, grades, regions, documentedCompanies: obj.documented_companies };
}

/** Returns null when the filtered RPC cannot be used: the page then falls back to the basic directory. */
export async function getProducerFilteredDirectory(args: {
  organizationId: string;
  q: string;
  page: number;
  filters: ProducerFilters;
}): Promise<ProducerFilteredDirectory | null> {
  try {
    const db = await createClient();
    const { data, error } = await db.rpc("netproducers2_directory", {
      p_organization_id: args.organizationId,
      p_country: "IT",
      p_query: args.q.trim().slice(0, 120) || null,
      p_products: args.filters.products.length ? args.filters.products : null,
      p_standards: args.filters.standards.length ? args.filters.standards : null,
      p_grades: args.filters.grades.length ? args.filters.grades : null,
      p_region: args.filters.region,
      p_documented_only: args.filters.documentedOnly,
      p_include_mentions: args.filters.includeMentions,
      p_sort: args.filters.sort,
      p_page: args.page,
      p_limit: 18,
    });
    if (error) {
      return error.code === "42501" ? { result: { status: "locked", data: null }, counts: {} } : null;
    }
    const parsed = parseProducerFilteredDirectory(data);
    if (!parsed) return null;
    return { result: { status: "ready", data: parsed.directory }, counts: parsed.counts };
  } catch {
    return null;
  }
}

export async function getProducerFacets(organizationId: string, includeMentions: boolean): Promise<ProducerFacets | null> {
  try {
    const db = await createClient();
    const { data, error } = await db.rpc("netproducers2_facets", {
      p_organization_id: organizationId,
      p_country: "IT",
      p_include_mentions: includeMentions,
    });
    if (error) return null;
    return parseProducerFacets(data);
  } catch {
    return null;
  }
}
