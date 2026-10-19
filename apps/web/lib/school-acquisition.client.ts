"use client";
import { ANALYTICS_CONSENT_STORAGE_KEY, analyticsConsentRecordIsCurrent, parseAnalyticsConsentRecord } from "@/lib/analytics-consent";
import { trackProductEvent } from "@/lib/product-analytics-events.client";

/** SCHOOL-GROWTH1D: category-only event attribution; no visitor/session identifiers. */
export type SchoolStage = "content_view" | "calculator_click" | "calculator_open" | "distinta_click" | "bill_line_added" | "rfq_create_click" | "guest_handoff" | "registration_click" | "login_click" | "rfq_created";
export type SchoolSurface = "home" | "articles" | "article" | "navigation" | "calculator";
const STAGES = new Set<SchoolStage>(["content_view", "calculator_click", "calculator_open", "distinta_click", "bill_line_added", "rfq_create_click", "guest_handoff", "registration_click", "login_click", "rfq_created"]);

export function hasCurrentAnalyticsConsent(): boolean {
  try {
    const record = parseAnalyticsConsentRecord(window.localStorage.getItem(ANALYTICS_CONSENT_STORAGE_KEY));
    return record?.decision === "granted" && analyticsConsentRecordIsCurrent(record);
  } catch { return false; }
}
export function isSchoolCalculatorSource(pathname: string, search: string): boolean {
  if (pathname !== "/knowledge/tubes") return false;
  try { return new URLSearchParams(search).get("source") === "school"; }
  catch { return false; }
}
export function schoolContentSurface(pathname: string): "home" | "articles" | "article" | null {
  if (pathname === "/knowledge") return "home";
  if (pathname === "/knowledge/articoli") return "articles";
  if (/^\/knowledge\/articoli\/[a-z0-9-]+$/.test(pathname)) return "article";
  return null;
}
export function trackSchoolStage(stage: SchoolStage, surface: SchoolSurface): boolean {
  if (!STAGES.has(stage) || !hasCurrentAnalyticsConsent()) return false;
  trackProductEvent(`school_funnel_${stage}`, { surface });
  return true;
}
export function trackSchoolCalculatorStage(stage:
  "bill_line_added" | "rfq_create_click" | "guest_handoff" |
  "registration_click" | "login_click" | "rfq_created"): boolean {
  try {
    if (!isSchoolCalculatorSource(window.location.pathname, window.location.search)) return false;
    return trackSchoolStage(stage, "calculator");
  } catch { return false; }
}
