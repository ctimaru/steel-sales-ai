import type { Metadata, MetadataRoute } from "next";

export const publicIndexRobots: Metadata["robots"] = {
  index: true,
  follow: true,
};

export const parameterizedNoIndexRobots: Metadata["robots"] = {
  index: false,
  follow: true,
};

export const privateNoIndexRobots: Metadata["robots"] = {
  index: false,
  follow: false,
  noarchive: true,
  nosnippet: true,
  noimageindex: true,
};

export function robotsForParameterizedPage(hasParameters: boolean) {
  return hasParameters ? parameterizedNoIndexRobots : publicIndexRobots;
}

export function googleSiteVerification() {
  const value = process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION?.trim();
  return value || undefined;
}

export function newestDate(values: Array<string | Date | null | undefined>, fallback?: Date) {
  const timestamps = values
    .map((value) => {
      if (!value) return Number.NaN;
      const date = value instanceof Date ? value : new Date(value);
      return date.getTime();
    })
    .filter(Number.isFinite);

  if (!timestamps.length) return fallback ?? new Date("2026-09-28T00:00:00Z");
  return new Date(Math.max(...timestamps));
}

export function finalizePublicSitemap(entries: MetadataRoute.Sitemap) {
  const unique = new Map<string, MetadataRoute.Sitemap[number]>();
  for (const entry of entries) unique.set(entry.url, entry);

  const result = [...unique.values()];

  if (result.length >= 45_000) {
    console.warn(
      `Public sitemap contains ${result.length} URLs. Prepare sitemap sharding before reaching the 50,000 URL protocol limit.`,
    );
  }

  if (result.length > 50_000) {
    throw new Error(
      `Public sitemap contains ${result.length} URLs and exceeds the 50,000 URL limit. Split the sitemap before publishing more pages.`,
    );
  }

  return result;
}
