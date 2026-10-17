import type { InternationalRfqLocaleCounts } from "@/lib/international-rfq-funnel";

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

export type Bd17CtaArmSnapshot = {
  label: string;
  views: number;
  clicks: number;
  clickRatePercent: number | null;
  consistency: "ok" | "invalid_counts";
};

export type Bd17ExperimentSnapshot = {
  control: Bd17CtaArmSnapshot;
  clarity: Bd17CtaArmSnapshot;
  minimumViewsPerArm: number;
  sampleSufficient: boolean;
};


export type Bd18ReadinessState =
  | "token_missing" | "api_error" | "partial_data" | "awaiting_data"
  | "awaiting_exposure" | "invalid_counts" | "sample_imbalance"
  | "collecting" | "exploratory_ready";

export type Bd18ReadinessCheck = {
  label: string;
  status: "ok" | "pending" | "warning";
  detail: string;
};

export type Bd18Readiness = {
  state: Bd18ReadinessState;
  usableForComparison: boolean;
  observedFunnelSteps: number;
  funnelSteps: number;
  totalExposures: number;
  balanceZ: number | null;
  deltaClickRatePp: number | null;
  checks: Bd18ReadinessCheck[];
  nextAction: string;
};

export type CalculatorFunnelQuality = {
  state: "unavailable" | "awaiting_events" | "partial" | "observed";
  observedSteps: number;
  totalSteps: number;
  registrationAccounts: number;
  registrationSubmissions: number;
  note: string;
};

function calculatorFunnelQuality(
  eventMap: ReadonlyMap<string, number>,
  ingestion: PlatformAnalyticsSnapshot["ingestion"]["state"],
): CalculatorFunnelQuality {
  const events = CALCULATOR_FUNNEL.map(([key]) => eventMap.get(key) ?? 0);
  const observedSteps = events.filter(value => Number.isSafeInteger(value) && value > 0).length;
  const unavailable = ingestion === "token_missing" || ingestion === "api_error" || ingestion === "partial_data";
  return {
    state: unavailable ? "unavailable" : observedSteps === 0 ? "awaiting_events" :
      observedSteps === events.length ? "observed" : "partial",
    observedSteps,
    totalSteps: events.length,
    registrationAccounts: eventMap.get("registration_account_created") ?? 0,
    registrationSubmissions: eventMap.get("registration_submit") ?? 0,
    note: unavailable
      ? "Aggregazioni non affidabili: verificare prima accesso API e completezza dei conteggi."
      : observedSteps === 0
        ? "Nessun evento del nuovo funnel rilevato: controllare consenso, traffico e data di rilascio."
        : "Conteggi eventi indipendenti: registrazioni e RFQ non sono attribuibili agli utenti del calcolatore.",
  };
}

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
  rfqConversionFunnel: AnalyticsFunnelStep[];
  calculatorFunnel: AnalyticsFunnelStep[];
  calculatorFunnelQuality: CalculatorFunnelQuality;
  rfqBillCopies: number;
  internationalRfqFunnel: InternationalRfqLocaleCounts[];
  bd17CtaExperiment: Bd17ExperimentSnapshot;
  bd18Readiness: Bd18Readiness;
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

const CALCULATOR_FUNNEL = [
  ["calc_funnel_bill_line_added", "Righe aggiunte"],
  ["calc_funnel_rfq_create_click", "Tentativi creazione RFQ"],
  ["calc_funnel_guest_handoff", "Passaggi ospite"],
  ["calc_funnel_registration_click", "Clic registrazione"],
  ["calc_funnel_login_click", "Clic login"],
  ["calc_funnel_rfq_created", "RFQ private create"],
] as const;

const RFQ_CONVERSION_FUNNEL = [
  ["rfq_calculator_line_added", "Articolo aggiunto dal calcolatore"],
  ["distinta_save", "Distinta salvata"],
  ["rfq_start", "RFQ privata creata"],
  ["rfq_supplier_added", "Selezione fornitori"],
  ["rfq_recipient_reviewed", "Destinatari verificati"],
  ["rfq_dispatch_launch", "RFQ inviata"],
] as const;

/** CALC-INT3E.4 — event totals by locale, not linked visitors or cohorts. */
const INTERNATIONAL_RFQ_LOCALES=["en","de","fr","es"] as const;
function internationalRfqFunnel(eventMap:ReadonlyMap<string,number>):InternationalRfqLocaleCounts[]{
  const count=(stage:"handoff"|"bill_opened"|"email_copied"|"registration_click",locale:typeof INTERNATIONAL_RFQ_LOCALES[number])=>{
    const value=eventMap.get("intl_rfq_"+stage+"_"+locale);
    return typeof value==="number" && Number.isSafeInteger(value) && value>=0?value:0;
  };
  return INTERNATIONAL_RFQ_LOCALES.map(locale=>({
    locale,
    handoff:count("handoff",locale),
    billOpened:count("bill_opened",locale),
    emailCopied:count("email_copied",locale),
    registrationClicks:count("registration_click",locale),
  }));
}

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

function bd17Experiment(eventMap: Map<string, number>): Bd17ExperimentSnapshot {
  const arm = (key: "control" | "clarity", label: string): Bd17CtaArmSnapshot => {
    const views = eventMap.get("bd17_cta_" + key + "_view") ?? 0;
    const clicks = eventMap.get("bd17_cta_" + key + "_click") ?? 0;
    // Counts span calendar windows; a click's exposure may lie just outside
    // the range. Don't display >100% or falsely truncate it to 100%.
    const valid = views >= clicks;
    return {
      label, views, clicks,
      clickRatePercent: views > 0 && valid ? Math.round((clicks / views) * 1000) / 10 : null,
      consistency: valid ? "ok" : "invalid_counts",
    };
  };
  const control = arm("control", "Testo attuale");
  const clarity = arm("clarity", "Messaggio esplicito");
  const minimumViewsPerArm = 100;
  return { control, clarity, minimumViewsPerArm,
    sampleSufficient: control.views >= minimumViewsPerArm &&
      clarity.views >= minimumViewsPerArm &&
      control.consistency === "ok" && clarity.consistency === "ok" };
}


/**
 * BD18 decision guard — no extra Vercel requests, no visitor identifiers.
 * The experiment unit is one consenting browser TAB, not a person / customer.
 * 50:50 mismatch uses a conservative normal approximation z threshold 2.576.
 * A ready result permits DESCRIPTIVE comparison only; no winner/statistical
 * significance because visitors are not linked and consent may bias samples.
 */
export function assessBd18Readiness(input: {
  state: PlatformAnalyticsSnapshot["ingestion"]["state"];
  experiment: Bd17ExperimentSnapshot;
  funnel: AnalyticsFunnelStep[];
}): Bd18Readiness {
  const { state: collector, experiment, funnel } = input;
  const a = experiment.control;
  const b = experiment.clarity;
  const totalExposures = a.views + b.views;
  const hasAnyExposure = totalExposures > 0;
  const badCounts = a.consistency === "invalid_counts" || b.consistency === "invalid_counts" ||
    !Number.isSafeInteger(a.views) || !Number.isSafeInteger(b.views) ||
    !Number.isSafeInteger(a.clicks) || !Number.isSafeInteger(b.clicks) ||
    a.views < 0 || b.views < 0 || a.clicks < 0 || b.clicks < 0;
  const balanceZ = totalExposures >= 100 && Number.isSafeInteger(totalExposures)
    ? Math.round(((a.views - b.views) / Math.sqrt(totalExposures)) * 100) / 100
    : null;
  const imbalanced = balanceZ !== null && Math.abs(balanceZ) > 2.576;
  const enoughSample = a.views >= experiment.minimumViewsPerArm &&
    b.views >= experiment.minimumViewsPerArm;
  const observedFunnelSteps = funnel.filter(s => s.value > 0).length;
  let result: Bd18ReadinessState;
  if (collector === "token_missing") result = "token_missing";
  else if (collector === "api_error") result = "api_error";
  else if (collector === "partial_data") result = "partial_data";
  else if (collector === "awaiting_data") result = "awaiting_data";
  else if (badCounts) result = "invalid_counts";
  else if (!hasAnyExposure) result = "awaiting_exposure";
  else if (imbalanced) result = "sample_imbalance";
  else if (!enoughSample) result = "collecting";
  else result = "exploratory_ready";

  const ready = result === "exploratory_ready";
  const delta = ready && a.clickRatePercent !== null && b.clickRatePercent !== null
    ? Math.round((b.clickRatePercent - a.clickRatePercent) * 10) / 10
    : null;
  const nextAction: Record<Bd18ReadinessState, string> = {
    token_missing: "Verifica la disponibilità del token Vercel Analytics sul server. Non inserire credenziali nella pagina.",
    api_error: "Controlla accesso e permessi alla Web Analytics API, senza interpretare i contatori mancanti come zero.",
    partial_data: "Riconcilia i contatori Vercel e le aggregazioni eventi prima di valutare l’esperimento.",
    awaiting_data: "Verifica che Web Analytics sia attiva e che il dominio stia ricevendo visite nel periodo selezionato.",
    awaiting_exposure: "Verifica l’attivazione dell’esperimento su /distinta, la visibilità del CTA e il consenso analytics. Nessun dato A/B osservato.",
    invalid_counts: "Verifica intervallo temporale e qualità dell’aggregazione: i clic superano le impression o i conteggi non sono validi.",
    sample_imbalance: "Verifica randomizzazione 50/50, consenso, traffico e filtri: le esposizioni mostrano uno sbilanciamento anomalo.",
    collecting: "Continua a raccogliere esposizioni: servono almeno 100 visualizzazioni misurate per ciascuna variante.",
    exploratory_ready: "Confronta i rapporti clic/visualizzazioni come segnale esplorativo. Non scegliere un vincitore senza un disegno sperimentale più rigoroso.",
  };
  const check = (label: string, status: Bd18ReadinessCheck["status"], detail: string): Bd18ReadinessCheck =>
    ({ label, status, detail });
  const checks: Bd18ReadinessCheck[] = [
    check("API Analytics", collector === "receiving" ? "ok" : collector === "awaiting_data" ? "pending" : "warning",
      collector === "receiving" ? "Dati raccolti nel periodo" : "Connessione o completezza del flusso da verificare"),
    check("Eventi funnel BD16", observedFunnelSteps > 0 ? "ok" : "pending",
      observedFunnelSteps + "/" + funnel.length + " passaggi con eventi osservati (non coorti individuali)"),
    check("Esposizione esperimento BD17", hasAnyExposure ? "ok" : "pending",
      totalExposures + " visualizzazioni misurate, ripartite fra due varianti"),
    check("Integrità dei conteggi", badCounts ? "warning" : "ok",
      badCounts ? "Clic maggiori delle visualizzazioni o contatori invalidi" : "Nessuna anomalia di conteggio rilevata"),
    check("Allocazione 50/50", imbalanced ? "warning" : balanceZ === null ? "pending" : "ok",
      balanceZ === null ? "Diagnosi dopo almeno 100 esposizioni complessive" :
        "Z della ripartizione = " + balanceZ.toFixed(2) + (imbalanced ? " · possibile sbilanciamento" : " · nessun allarme")),
    check("Campione A/B", enoughSample ? "ok" : "pending",
      a.views + " / " + b.views + " visualizzazioni, minimo " + experiment.minimumViewsPerArm + " per variante"),
  ];
  return {
    state: result, usableForComparison: ready,
    observedFunnelSteps, funnelSteps: funnel.length, totalExposures,
    balanceZ, deltaClickRatePp: delta, checks, nextAction: nextAction[result],
  };
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
    rfqConversionFunnel: buildFunnel(RFQ_CONVERSION_FUNNEL, new Map()),
    calculatorFunnel: buildFunnel(CALCULATOR_FUNNEL, new Map()),
    calculatorFunnelQuality: calculatorFunnelQuality(new Map(), error === "VERCEL_ANALYTICS_TOKEN_MISSING" ? "token_missing" : "api_error"),
    rfqBillCopies: 0,
    internationalRfqFunnel: internationalRfqFunnel(new Map()),
    bd17CtaExperiment: bd17Experiment(new Map()),
    bd18Readiness: assessBd18Readiness({
      state: error === "VERCEL_ANALYTICS_TOKEN_MISSING" ? "token_missing" : "api_error",
      experiment: bd17Experiment(new Map()),
      funnel: buildFunnel(RFQ_CONVERSION_FUNNEL, new Map()),
    }),
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
        limit: 100,
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
      (aggregateEvents > 0 && (countedEvents === null || countedEvents === 0 || aggregateEvents > countedEvents)) ||
      ((countedEvents ?? 0) > 0 && (!Array.isArray(eventsResponse.data) || eventsResponse.data.length === 0));
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
      pageviews === null ||
      visitors === null ||
      eventTotal === null ||
      eventVisitors === null;

    const ingestionState: PlatformAnalyticsSnapshot["ingestion"]["state"] =
      partialData ? "partial_data" : hasData ? "receiving" : "awaiting_data";
    const rfqFunnel = buildFunnel(RFQ_CONVERSION_FUNNEL, eventMap);
    const bd17 = bd17Experiment(eventMap);
    const bd18 = assessBd18Readiness({
      state: ingestionState, experiment: bd17, funnel: rfqFunnel,
    });

    return {
      configured: true,
      generatedAt: new Date().toISOString(),
      range,
      rangeLabel: RANGE_CONFIG[range].label,
      error: null,
      ingestion: {
        collector: "an1.2",
        state: ingestionState,
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
      rfqConversionFunnel: rfqFunnel,
      calculatorFunnel: buildFunnel(CALCULATOR_FUNNEL, eventMap),
      calculatorFunnelQuality: calculatorFunnelQuality(eventMap, ingestionState),
      rfqBillCopies: eventMap.get("rfq_bill_copied") ?? 0,
      internationalRfqFunnel: internationalRfqFunnel(eventMap),
      bd17CtaExperiment: bd17,
      bd18Readiness: bd18,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Analytics unavailable";
    return emptySnapshot(range, message);
  }
}
