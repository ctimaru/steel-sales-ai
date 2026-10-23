"use client";

import {
  ANALYTICS_CONSENT_STORAGE_KEY,
  analyticsConsentRecordIsCurrent,
  parseAnalyticsConsentRecord,
} from "@/lib/analytics-consent";

/**
 * GA4 companion events for already existing public calculator / RFQ interactions.
 * Never send dimensional, price, company, contact or user-provided values.
 * The event is deliberately not a GA4 'conversion' until configured as a key event.
 */
const PUBLIC_FUNNEL_EVENTS = {
  weight_calculation: "calculator_used",
  rfq_calculator_line_added: "rfq_bill_add",
  calc_funnel_bill_line_added: "rfq_bill_add",
  school_funnel_bill_line_added: "rfq_bill_add",
  rfq_bill_copied: "rfq_bill_copied",
  calc_funnel_rfq_create_click: "rfq_create_start",
  school_funnel_rfq_create_click: "rfq_create_start",
  calc_funnel_registration_click: "signup_start",
  school_funnel_registration_click: "signup_start",
  network_activation_registration_click: "signup_start",
} as const;

type TrackedName = keyof typeof PUBLIC_FUNNEL_EVENTS;
type SafeCategory = string | number | boolean;
const publicPath = (path: string) =>
  /^(?:\/(?:en|de|fr|es))?\/knowledge\/tubes(?:\/|$)/.test(path)
  || /^\/(?:distinta|register)(?:\/|$)/.test(path);

export function trackConsentedGa4FunnelEvent(
  name: string,
  properties?: Record<string, SafeCategory>,
): boolean {
  if (!(name in PUBLIC_FUNNEL_EVENTS) || typeof window === "undefined") return false;
  try {
    if (!publicPath(window.location.pathname)) return false;
    const consent = parseAnalyticsConsentRecord(
      window.localStorage.getItem(ANALYTICS_CONSENT_STORAGE_KEY),
    );
    if (consent?.decision !== "granted" || !analyticsConsentRecordIsCurrent(consent)) return false;
    const gtag = (window as Window & { gtag?: (...args: unknown[]) => void }).gtag;
    if (typeof gtag !== "function") return false;

    // Only enumerated, bounded values: never forward the complete properties object.
    const locale = window.location.pathname.startsWith("/en/") ? "en"
      : window.location.pathname.startsWith("/de/") ? "de"
      : window.location.pathname.startsWith("/fr/") ? "fr"
      : window.location.pathname.startsWith("/es/") ? "es" : "it";
    const safeFamily = ["round_tube", "square_tube", "rectangular_tube"];
    const safeStandard = ["en10210", "en10219", "geometric"];
    const family = typeof properties?.family === "string" && safeFamily.includes(properties.family) ? properties.family : "unknown";
    const standard = typeof properties?.standard === "string" && safeStandard.includes(properties.standard) ? properties.standard : "unknown";
    const mappedName = PUBLIC_FUNNEL_EVENTS[name as TrackedName];
    gtag("event", mappedName, { locale, family, standard });
    return true;
  } catch {
    return false;
  }
}
