"use client";

import { track } from "@vercel/analytics";

export type ProductAnalyticsEventName =
  | "company_search"
  | "company_claim_start"
  | "weight_calculation"
  | "rfq_calculator_line_added"
  | "rfq_bill_copied";

export function trackProductEvent(
  name: ProductAnalyticsEventName,
  properties?: Record<string, string | number | boolean>,
) {
  try {
    track(name, properties);
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("Product analytics event unavailable:", name, error);
    }
  }
}
