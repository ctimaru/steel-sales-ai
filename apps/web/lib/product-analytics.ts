"use client";

import { track } from "@vercel/analytics";

export type ProductAnalyticsValue = string | number | boolean | null;
export type ProductAnalyticsData = Record<string, ProductAnalyticsValue>;

export function trackProductEvent(
  name: string,
  data: ProductAnalyticsData = {},
) {
  if (typeof window === "undefined") return;

  try {
    track(name, data);
  } catch {
    // Analytics must never interrupt a user workflow.
  }
}
