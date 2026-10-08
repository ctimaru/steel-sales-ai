export type AnalyticsRangeKey = "1d" | "7d" | "30d";

export type AnalyticsPoint = {
  label: string;
  pageviews: number;
  visitors: number;
};

export type AnalyticsDimensionRow = {
  label: string;
  pageviews: number;
  visitors: number;
};

export type AnalyticsEventRow = {
  name: string;
  count: number;
  visitors: number;
};

export type AnalyticsFunnelStep = {
  key: string;
  label: string;
  value: number;
  conversionFromPrevious: number | null;
};

export type PlatformAnalyticsSnapshot = {
  configured: boolean;
  generatedAt: string;
  range: AnalyticsRangeKey;
  rangeLabel: string;
  error: string | null;
  ingestion: {
    collector: "an1.2";
    state: "receiving" | "partial_data" | "awaiting_data" | "api_error" | "token_missing";
  };
  totals: {
    pageviews: number | null;
    visitors: number | null;
    events: number | null;
    eventVisitors: number | null;
  };
  trend: AnalyticsPoint[];
  topPages: AnalyticsDimensionRow[];
  referrers: AnalyticsDimensionRow[];
  countries: AnalyticsDimensionRow[];
  events: AnalyticsEventRow[];
  acquisitionFunnel: AnalyticsFunnelStep[];
  activationFunnel: AnalyticsFunnelStep[];
};

const RANGE_CONFIG: Record<
  AnalyticsRangeKey,
  { days: number; label: string }
> = {
  "1d": { days: 1, label: "Ultime 24 ore" },
  "7d": { days: 7, label: "Ultimi 7 giorni" },
  "30d": { days: 30, label: "Ultimi 30 giorni" },
};

const ACQUISITION_FUNNEL = [
  ["company_search", "Ricerca azienda"],
  ["company_claim_start", "Avvio claim"],
  ["registration_account_created", "Account creato"],
  ["registration_submit", "Registrazione inviata"],
] as const;

const ACTIVATION_FUNNEL = [
  ["weight_calculation", "Calcolo peso usato"],
  ["distinta_save", "Distinta salvata"],
  ["rfq_start", "RFQ avviata"],
  ["rfq_dispatch_launch", "RFQ inviata"],
] as const;

function safeRange(value: string | undefined): AnalyticsRangeKey {
  return value === "1d" || value === "30d" ? value : "7d";
}

function dateRange(range: AnalyticsRangeKey) {
  const until = new Date();
  const since = new Date(until);
  since.setUTCDate(since.getUTCDate() - RANGE_CONFIG[range].days);
  return { since: since.toISOString(), until: until.toISOString() };
}

function analyticsConfig() {
  const token =
    process.env.VERCEL_ANALYTICS_TOKEN?.trim() ||
    process.env.VERCEL_TOKEN?.trim() ||
    "";
  const projectId =
    process.env.VERCEL_ANALYTICS_PROJECT_ID?.trim() ||
    process.env.VERCEL_PROJECT_ID?.trim() ||
    "prj_APnQ9rFMsFsU506v2YJ4EqXV3PVC";
  const teamId =
    process.env.VERCEL_ANALYTICS_TEAM_ID?.trim() ||
    process.env.VERCEL_TEAM_ID?.trim() ||
    "team_UOHjmeMwmplUldDocZfjBmns";

  return { token, projectId, teamId };
}

async function vercelAnalyticsQuery<T>(
  path: string,
  params: Record<string, string | number | undefined>,
) {
  const { token, projectId, teamId } = analyticsConfig();
  if (!token) {
    throw new Error("VERCEL_ANALYTICS_TOKEN_MISSING");
  }

  const query = new URLSearchParams();
  query.set("projectId", projectId);
  if (teamId) query.set("teamId", teamId);

  for (const [key, value] of Object.entries(params)) {
    if (value == null) continue;
    query.set(key, String(value));
  }

  const response = await fetch(
    `https://api.vercel.com/v1/query/web-analytics/${path}?${query.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    },
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Vercel Analytics API ${response.status}: ${text.slice(0, 240)}`,
    );
  }

  return (await response.json()) as T;
}

function countMetric(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : null;
}

function sumCountMetrics(rows: Array<{ pageviews?: number }>) {
  return rows.reduce((total, row) => total + (countMetric(row.pageviews) ?? 0), 0);
}

function conversion(value: number, previous: number | null) {
  if (previous == null || previous <= 0) return null;
  return Math.round((value / previous) * 1000) / 10;
}

function buildFunnel(
  definitions: ReadonlyArray<readonly [string, string]>,
  eventMap: Map<string, number>,
) {
  let previous: number | null = null;

  return definitions.map(([key, label]) => {
    const value = eventMap.get(key) ?? 0;
    const step: AnalyticsFunnelStep = {
      key,
      label,
      value,
      conversionFromPrevious: conversion(value, previous),
    };
    previous = value;
    return step;
  });
}

function emptySnapshot(
  range: AnalyticsRangeKey,
  error: string | null,
): PlatformAnalyticsSnapshot {
  return {
    configured: error !== "VERCEL_ANALYTICS_TOKEN_MISSING",
    generatedAt: new Date().toISOString(),
    range,
    rangeLabel: RANGE_CONFIG[range].label,
    error,
    ingestion: {
      collector: "an1.2",
      state: error === "VERCEL_ANALYTICS_TOKEN_MISSING" ? "token_missing" : "api_error",
    },
    totals: {
      pageviews: 0,
      visitors: 0,
      events: 0,
      eventVisitors: 0,
    },
    trend: [],
    topPages: [],
    referrers: [],
    countries: [],
    events: [],
    acquisitionFunnel: buildFunnel(ACQUISITION_FUNNEL, new Map()),
    activationFunnel: buildFunnel(ACTIVATION_FUNNEL, new Map()),
  };
}

export async function getPlatformAnalyticsSnapshot(
  rawRange?: string,
): Promise<PlatformAnalyticsSnapshot> {
  const range = safeRange(rawRange);
  const { since, until } = dateRange(range);

  type VisitCountResponse = {
    data?: { pageviews?: number; visitors?: number };
  };
  type EventCountResponse = {
    data?: { count?: number; visitors?: number };
  };
  type VisitAggregateResponse = {
    data?: Array<{
      timestamp?: string;
      requestPath?: string;
      referrerHostname?: string;
      country?: string;
      pageviews?: number;
      visitors?: number;
    }>;
  };
  type EventAggregateResponse = {
    data?: Array<{
      eventName?: string;
      count?: number;
      visitors?: number;
    }>;
  };

  try {
    const [
      visitCount,
      eventCount,
      trendResponse,
      pagesResponse,
      referrersResponse,
      countriesResponse,
      eventsResponse,
    ] = await Promise.all([
      vercelAnalyticsQuery<VisitCountResponse>("visits/count", {
        since,
        until,
      }),
      vercelAnalyticsQuery<EventCountResponse>("events/count", {
        since,
        until,
      }),
      vercelAnalyticsQuery<VisitAggregateResponse>("visits/aggregate", {
        since,
        until,
        by: range === "1d" ? "hour" : "day",
        limit: range === "1d" ? 24 : RANGE_CONFIG[range].days + 1,
      }),
      vercelAnalyticsQuery<VisitAggregateResponse>("visits/aggregate", {
        since,
        until,
        by: "requestPath",
        limit: 10,
      }),
      vercelAnalyticsQuery<VisitAggregateResponse>("visits/aggregate", {
        since,
        until,
        by: "referrerHostname",
        limit: 8,
      }),
      vercelAnalyticsQuery<VisitAggregateResponse>("visits/aggregate", {
        since,
        until,
        by: "country",
        limit: 8,
      }),
      vercelAnalyticsQuery<EventAggregateResponse>("events/aggregate", {
        since,
        until,
        by: "eventName",
        limit: 50,
      }),
    ]);

    const events = (eventsResponse.data ?? [])
      .map((row) => ({
        name: row.eventName ?? "unknown",
        count: row.count ?? 0,
        visitors: row.visitors ?? 0,
      }))
      .filter((row) => row.name !== "Others")
      .sort((a, b) => b.count - a.count);

    const eventMap = new Map(events.map((event) => [event.name, event.count]));

    // A successful HTTP response does not guarantee a populated count payload.
    // The page/time aggregations are independent evidence of actual traffic.
    const countedPageviews = countMetric(visitCount.data?.pageviews);
    const countedVisitors = countMetric(visitCount.data?.visitors);
    const countedEvents = countMetric(eventCount.data?.count);
    const countedEventVisitors = countMetric(eventCount.data?.visitors);
    const aggregatePageviews = sumCountMetrics(trendResponse.data ?? []);
    const aggregateEvents = events.reduce((total, event) => total + event.count, 0);
    const pagesHaveTraffic = (pagesResponse.data ?? []).some((row) => (row.pageviews ?? 0) > 0);
    const hasData =
      aggregatePageviews > 0 ||
      aggregateEvents > 0 ||
      pagesHaveTraffic ||
      (countriesResponse.data ?? []).some((row) => (row.pageviews ?? 0) > 0) ||
      (countedPageviews ?? 0) > 0 ||
      (countedVisitors ?? 0) > 0 ||
      (countedEvents ?? 0) > 0 ||
      (countedEventVisitors ?? 0) > 0;

    const inconsistentPageviews =
      aggregatePageviews > 0 && (countedPageviews === null || countedPageviews === 0);
    const inconsistentVisitors =
      aggregatePageviews > 0 && (countedVisitors === null || countedVisitors === 0);
    const inconsistentEvents =
      aggregateEvents > 0 && (countedEvents === null || countedEvents === 0);
    const inconsistentEventVisitors =
      aggregateEvents > 0 && (countedEventVisitors === null || countedEventVisitors === 0);

    // Pageviews are additive across time buckets, but unique visitors are NOT.
    // Never fabricate a unique-visitor total by summing bucket or country visitors.
    const pageviews = inconsistentPageviews ? aggregatePageviews : countedPageviews;
    const visitors = inconsistentVisitors ? null : countedVisitors;
    const eventTotal = inconsistentEvents ? aggregateEvents : countedEvents;
    const eventVisitors = inconsistentEventVisitors ? null : countedEventVisitors;
    const partialData =
      inconsistentPageviews ||
      inconsistentVisitors ||
      inconsistentEvents ||
      inconsistentEventVisitors ||
      (hasData && (pageviews === null || visitors === null || eventTotal === null || eventVisitors === null));

    return {
      configured: true,
      generatedAt: new Date().toISOString(),
      range,
      rangeLabel: RANGE_CONFIG[range].label,
      error: null,
      ingestion: {
        collector: "an1.2",
        state: partialData ? "partial_data" : hasData ? "receiving" : "awaiting_data",
      },
      totals: {
        pageviews,
        visitors,
        events: eventTotal,
        eventVisitors,
      },
      trend: (trendResponse.data ?? []).map((row) => ({
        label: row.timestamp ?? "",
        pageviews: row.pageviews ?? 0,
        visitors: row.visitors ?? 0,
      })),
      topPages: (pagesResponse.data ?? []).map((row) => ({
        label: row.requestPath ?? "—",
        pageviews: row.pageviews ?? 0,
        visitors: row.visitors ?? 0,
      })),
      referrers: (referrersResponse.data ?? [])
        .filter((row) => row.referrerHostname && row.referrerHostname !== "")
        .map((row) => ({
          label: row.referrerHostname ?? "Direct / none",
          pageviews: row.pageviews ?? 0,
          visitors: row.visitors ?? 0,
        })),
      countries: (countriesResponse.data ?? []).map((row) => ({
        label: row.country ?? "—",
        pageviews: row.pageviews ?? 0,
        visitors: row.visitors ?? 0,
      })),
      events,
      acquisitionFunnel: buildFunnel(ACQUISITION_FUNNEL, eventMap),
      activationFunnel: buildFunnel(ACTIVATION_FUNNEL, eventMap),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Analytics unavailable";
    return emptySnapshot(range, message);
  }
}
