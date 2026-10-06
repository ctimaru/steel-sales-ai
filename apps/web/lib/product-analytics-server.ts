import { track } from "@vercel/analytics/server";

import type { ProductAnalyticsData } from "@/lib/product-analytics";

export async function trackProductEventServer(
  name: string,
  data: ProductAnalyticsData = {},
) {
  try {
    await track(name, data);
  } catch {
    // Telemetry is best-effort and must never block auth or commercial workflows.
  }
}
