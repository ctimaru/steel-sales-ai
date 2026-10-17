"use client";

import { track } from "@vercel/analytics";
import type { InternationalRfqEventName } from "@/lib/international-rfq-funnel";

export type ProductAnalyticsEventName = InternationalRfqEventName
  | "calc_funnel_bill_line_added"
  | "calc_funnel_rfq_create_click"
  | "calc_funnel_guest_handoff"
  | "calc_funnel_registration_click"
  | "calc_funnel_login_click"
  | "calc_funnel_rfq_created"
  | "company_search"
  | "company_claim_start"
  | "weight_calculation"
  | "rfq_calculator_line_added"
  | "rfq_bill_copied"
  | "bd17_cta_control_view"
  | "bd17_cta_control_click"
  | "bd17_cta_clarity_view"
  | "bd17_cta_clarity_click";

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
