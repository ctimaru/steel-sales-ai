import "server-only";

import { cache } from "react";

import { createPublicSupabaseClient } from "@/lib/supabase/public";

/**
 * HOME-NETPRO-PUBLIC1: live Network totals for the public home.
 * Reads public.public_network_counts() with the publishable key (no session):
 * aggregate counts only, no company data. Any failure returns null and the
 * page simply hides the numbers — never an estimate. Memoized per render so
 * the hero pill and the Network showcase share one call; the static page is
 * regenerated at most once an hour (revalidate on the route).
 */
export type PublicNetworkCounts = {
  total: number;
  italy: number;
  countries: number;
  producers: number;
  distributors: number;
  processors: number;
  endUsers: number;
};

const count = (value: unknown) =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;

export function parsePublicNetworkCounts(payload: unknown): PublicNetworkCounts | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const data = payload as Record<string, unknown>;
  if (data.contract !== "public-network-counts-v1") return null;
  const modules = data.modules && typeof data.modules === "object" ? (data.modules as Record<string, unknown>) : null;
  const parsed = {
    total: count(data.total),
    italy: count(data.italy),
    countries: count(data.countries),
    producers: count(modules?.producers),
    distributors: count(modules?.distributors),
    processors: count(modules?.processors),
    endUsers: count(modules?.end_users),
  };
  if (Object.values(parsed).some((value) => value === null)) return null;
  const counts = parsed as PublicNetworkCounts;
  if (counts.total === 0 || counts.italy > counts.total) return null;
  return counts;
}

export const getPublicNetworkCounts = cache(async (): Promise<PublicNetworkCounts | null> => {
  try {
    const db = createPublicSupabaseClient();
    if (!db) return null;
    const { data, error } = await db.rpc("public_network_counts");
    if (error) return null;
    return parsePublicNetworkCounts(data);
  } catch {
    return null;
  }
});
