/**
 * SEO-GROWTH1C.2 — presentation-only funnel aggregation.
 * Input must come from authorized aggregate GSC / GA4 reports.
 * Never stitch identities across products or infer organic GA4 sessions from GSC clicks.
 */
export type SearchVisibility = { impressions: number; clicks: number; averagePosition: number | null };
export type AnalyticsLanding = { sessions: number; activeUsers: number };
export type FunnelEvents = { calculator_used: number; rfq_bill_add: number; rfq_create_start: number; signup_start: number };
export type FunnelDataset = {
  startDate: string; endDate: string; pagePath: string;
  gsc: SearchVisibility | null;
  ga4: AnalyticsLanding | null;
  events: FunnelEvents | null;
};
export type FunnelMetric = { id: string; label: string; value: number | null; rate: number | null; denominator: string | null };

function nonnegative(value: number | undefined | null): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}
function ratio(numerator: number | null, denominator: number | null) {
  return numerator !== null && denominator !== null && denominator > 0 ? numerator / denominator : null;
}
export function buildOrganicFunnel(dataset: FunnelDataset): FunnelMetric[] {
  const impressions = nonnegative(dataset.gsc?.impressions);
  const clicks = nonnegative(dataset.gsc?.clicks);
  const sessions = nonnegative(dataset.ga4?.sessions);
  const users = nonnegative(dataset.ga4?.activeUsers);
  const calc = nonnegative(dataset.events?.calculator_used);
  const bill = nonnegative(dataset.events?.rfq_bill_add);
  const rfq = nonnegative(dataset.events?.rfq_create_start);
  const signup = nonnegative(dataset.events?.signup_start);
  return [
    { id: "impressions", label: "Google impressions", value: impressions, rate: null, denominator: null },
    { id: "clicks", label: "Google clicks", value: clicks, rate: ratio(clicks, impressions), denominator: "Google impressions" },
    { id: "sessions", label: "All-source landing sessions", value: sessions, rate: null, denominator: null },
    { id: "users", label: "Active landing users", value: users, rate: null, denominator: null },
    { id: "calculator_used", label: "Calculator interactions", value: calc, rate: null, denominator: null },
    { id: "rfq_bill_add", label: "Bill additions", value: bill, rate: null, denominator: null },
    { id: "rfq_create_start", label: "RFQ starts", value: rfq, rate: null, denominator: null },
    { id: "signup_start", label: "Signup starts", value: signup, rate: null, denominator: null },
  ];
}
