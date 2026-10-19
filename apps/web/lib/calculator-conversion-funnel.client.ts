"use client";

import { ANALYTICS_CONSENT_STORAGE_KEY, analyticsConsentRecordIsCurrent, parseAnalyticsConsentRecord } from "@/lib/analytics-consent";
import { trackProductEvent } from "@/lib/product-analytics-events.client";
import { trackSchoolCalculatorStage } from "@/lib/school-acquisition.client";
import type { TubeCalculatorLocale } from "@/lib/tube-calculator-locale";

export type CalculatorFunnelStage =
  | "bill_line_added" | "rfq_create_click" | "guest_handoff"
  | "registration_click" | "login_click" | "rfq_created";

/** Aggregate event counts only; no identifiers, prices, geometry, URL or session data. */
export function trackCalculatorFunnel(stage: CalculatorFunnelStage, locale: TubeCalculatorLocale): boolean {
  try {
    const consent = parseAnalyticsConsentRecord(window.localStorage.getItem(ANALYTICS_CONSENT_STORAGE_KEY));
    if (consent?.decision !== "granted" || !analyticsConsentRecordIsCurrent(consent)) return false;
    trackProductEvent("calc_funnel_" + stage as `calc_funnel_${CalculatorFunnelStage}`, { locale });
    trackSchoolCalculatorStage(stage);
    return true;
  } catch {
    return false;
  }
}
