import "server-only";
import { createSign } from "node:crypto";
import type { FunnelDataset } from "@/lib/seo-growth1c2-funnel-model";

const GSC_SITE = "sc-domain:smartsteelsales.com";
const GA4_PROPERTY = "557280842";
const PAGE = "/en/knowledge/tubes";
type ServiceAccount = { client_email: string; private_key: string; token_uri?: string };
type ReportRow = { dimensionValues?: { value?: string }[]; metricValues?: { value?: string }[] };
const empty = (startDate: string, endDate: string): FunnelDataset => ({
  startDate, endDate, pagePath: PAGE, gsc: null, ga4: null, events: null,
});
const number = (value: string | undefined) => {
  const n = Number(value);
  return value !== undefined && Number.isFinite(n) && n >= 0 ? n : null;
};
function base64url(data: string) {
  return Buffer.from(data).toString("base64url");
}
async function accessToken(account: ServiceAccount) {
  if (!account.client_email || !account.private_key) throw new Error("Analytics service account incomplete");
  const endpoint = account.token_uri ?? "https://oauth2.googleapis.com/token";
  if (new URL(endpoint).origin !== "https://oauth2.googleapis.com") throw new Error("Untrusted token endpoint");
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64url(JSON.stringify({
    iss: account.client_email,
    scope: "https://www.googleapis.com/auth/analytics.readonly https://www.googleapis.com/auth/webmasters.readonly",
    aud: endpoint, iat: now, exp: now + 3600,
  }));
  const input = header + "." + payload;
  const signer = createSign("RSA-SHA256");
  signer.update(input);
  const assertion = input + "." + signer.sign(account.private_key).toString("base64url");
  const response = await fetch(endpoint, {
    method: "POST", cache: "no-store",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error("Analytics credential exchange failed");
  const json = await response.json() as { access_token?: string };
  if (!json.access_token) throw new Error("Analytics access token missing");
  return json.access_token;
}
async function postJson(endpoint: string, token: string, payload: object): Promise<{ rows?: ReportRow[] }> {
  const response = await fetch(endpoint, {
    method: "POST", headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
    body: JSON.stringify(payload), next: { revalidate: 3600 }, signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error("Aggregate analytics request failed: " + response.status);
  return response.json() as Promise<{ rows?: ReportRow[] }>;
}
/** Only server-side. Missing credentials or source failures yield null, never synthetic zeros. */
export async function loadOrganicAcquisitionSnapshot(): Promise<FunnelDataset> {
  const now = new Date();
  const end = new Date(now); end.setUTCDate(end.getUTCDate() - 2);
  const start = new Date(end); start.setUTCDate(start.getUTCDate() - 6);
  const startDate = start.toISOString().slice(0,10);
  const endDate = end.toISOString().slice(0,10);
  const snapshot = empty(startDate, endDate);
  const raw = process.env.GOOGLE_ANALYTICS_SERVICE_ACCOUNT_JSON;
  if (!raw) return snapshot;
  let token: string;
  try { token = await accessToken(JSON.parse(raw) as ServiceAccount); }
  catch { return snapshot; }

  try {
    const report = await postJson(
      "https://www.googleapis.com/webmasters/v3/sites/" + encodeURIComponent(GSC_SITE) + "/searchAnalytics/query",
      token, { startDate, endDate, dimensions: ["page"], dimensionFilterGroups: [{ filters: [
        { dimension: "page", operator: "equals", expression: "https://www.smartsteelsales.com" + PAGE },
      ] }], rowLimit: 1 },
    ) as { rows?: Array<{ clicks?: number; impressions?: number; position?: number }> };
    const row = report.rows?.[0];
    snapshot.gsc = row ? { clicks: row.clicks ?? 0, impressions: row.impressions ?? 0, averagePosition: row.position ?? null }
      : { clicks: 0, impressions: 0, averagePosition: null };
  } catch { /* GSC remains unavailable */ }

  const base = "https://analyticsdata.googleapis.com/v1beta/properties/" + GA4_PROPERTY + ":runReport";
  try {
    const report = await postJson(base, token, {
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: "pagePath" }],
      metrics: [{ name: "sessions" }, { name: "activeUsers" }],
      dimensionFilter: { filter: { fieldName: "pagePath", stringFilter: { matchType: "EXACT", value: PAGE } } },
      limit: 1,
    });
    const metrics = report.rows?.[0]?.metricValues;
    snapshot.ga4 = { sessions: number(metrics?.[0]?.value) ?? 0, activeUsers: number(metrics?.[1]?.value) ?? 0 };
  } catch { /* GA4 remains unavailable */ }

  try {
    const events = ["calculator_used", "rfq_bill_add", "rfq_create_start", "signup_start"] as const;
    const report = await postJson(base, token, {
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: "eventName" }],
      metrics: [{ name: "eventCount" }],
      dimensionFilter: { andGroup: { expressions: [
        { filter: { fieldName: "pagePath", stringFilter: { matchType: "EXACT", value: PAGE } } },
        { filter: { fieldName: "eventName", inListFilter: { values: [...events] } } },
      ] } },
    });
    const values = Object.fromEntries(events.map(event => [event, 0])) as Record<typeof events[number],number>;
    for (const row of report.rows ?? []) {
      const key = row.dimensionValues?.[0]?.value as typeof events[number] | undefined;
      const count = number(row.metricValues?.[0]?.value);
      if (key && events.includes(key) && count !== null) values[key] = count;
    }
    snapshot.events = values;
  } catch { /* Funnel remains unavailable */ }
  return snapshot;
}
