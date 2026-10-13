export const DASH_FEED7_EVENTS = [
  { key: "news_source", label: "Fonti editoriali aperte" },
  { key: "interests", label: "Preferenze aperte" },
  { key: "network_profiles", label: "Profili Network aperti" },
  { key: "opportunities", label: "Opportunità aperte" },
] as const;

export type DashFeed7EventKey = typeof DASH_FEED7_EVENTS[number]["key"];
export type DashFeed7Actions = Record<DashFeed7EventKey,number>;
export type DashFeed7Cohort = { eligible: number; returned: number; rate_percent: number | null };
export type DashFeed7Day = DashFeed7Actions & { day: string; home_views: number; active_users: number };
export type DashFeed7Snapshot = {
  contract: "DASH-FEED7-v1";
  window_days: 7 | 30;
  as_of_day: string;
  first_observed_home_day: string | null;
  home_views: number;
  unique_home_users: number;
  returning_home_users: number;
  observed_home_days: number;
  actions: DashFeed7Actions;
  d1: DashFeed7Cohort;
  d7: DashFeed7Cohort;
  daily: DashFeed7Day[];
};
const validCount = (x: unknown): x is number => Number.isSafeInteger(x) && (x as number) >= 0;
const validDay = (x: unknown): x is string =>
  typeof x === "string" && /^\d{4}-\d{2}-\d{2}$/.test(x) &&
  !Number.isNaN(Date.parse(x + "T00:00:00Z"));
const fields = DASH_FEED7_EVENTS.map((e) => e.key);

function parseActions(x: unknown): DashFeed7Actions | null {
  if (!x || typeof x !== "object" || Array.isArray(x)) return null;
  const row = x as Record<string,unknown>;
  if (!fields.every((key) => validCount(row[key]))) return null;
  return {
    news_source: row.news_source as number, interests: row.interests as number,
    network_profiles: row.network_profiles as number,
    opportunities: row.opportunities as number,
  };
}
function parseCohort(x: unknown): DashFeed7Cohort | null {
  if (!x || typeof x !== "object" || Array.isArray(x)) return null;
  const row = x as Record<string,unknown>;
  if (!validCount(row.eligible) || !validCount(row.returned) || row.returned > row.eligible) return null;
  const rate = row.rate_percent;
  if (row.eligible < 10 && rate !== null) return null;
  if (row.eligible >= 10 && (
    typeof rate !== "number" || !Number.isFinite(rate) || rate < 0 || rate > 100
  )) return null;
  return { eligible: row.eligible, returned: row.returned, rate_percent: rate as number | null };
}
export function parseDashFeed7Snapshot(data: unknown, days: 7 | 30): DashFeed7Snapshot | null {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const x = data as Record<string,unknown>;
  if (x.contract !== "DASH-FEED7-v1" || x.window_days !== days ||
      !validDay(x.as_of_day) ||
      (x.first_observed_home_day !== null && !validDay(x.first_observed_home_day)) ||
      !validCount(x.home_views) || !validCount(x.unique_home_users) ||
      !validCount(x.returning_home_users) || !validCount(x.observed_home_days) ||
      x.returning_home_users > x.unique_home_users || x.observed_home_days > days ||
      x.unique_home_users > x.home_views || !Array.isArray(x.daily) ||
      x.daily.length !== days) return null;
  const actions = parseActions(x.actions);
  const d1 = parseCohort(x.d1), d7 = parseCohort(x.d7);
  if (!actions || !d1 || !d7) return null;
  const daily: DashFeed7Day[] = [];
  for (const row of x.daily) {
    if (!row || typeof row !== "object" || Array.isArray(row)) return null;
    const y = row as Record<string,unknown>;
    const action = parseActions(y);
    if (!action || !validDay(y.day) || !validCount(y.home_views) ||
        !validCount(y.active_users) || y.active_users > y.home_views) return null;
    daily.push({ day: y.day, home_views: y.home_views, active_users: y.active_users, ...action });
  }
  if (new Set(daily.map((d) => d.day)).size !== days ||
      daily.some((r,i) => i>0 && r.day <= daily[i-1].day)) return null;
  if (daily.reduce((sum,r) => sum+r.home_views,0) !== x.home_views) return null;
  for (const key of fields) {
    if (daily.reduce((sum,r) => sum+r[key],0) !== actions[key]) return null;
  }
  return {
    contract: "DASH-FEED7-v1",window_days:days,
    as_of_day:x.as_of_day,first_observed_home_day:x.first_observed_home_day as string|null,
    home_views:x.home_views,unique_home_users:x.unique_home_users,
    returning_home_users:x.returning_home_users,observed_home_days:x.observed_home_days,
    actions,d1,d7,daily,
  };
}
export type DashFeed7Readiness = "no_data" | "insufficient_sample" | "awaiting_actions" | "cohort_maturing" | "exploratory";
export function assessDashFeed7(snapshot:DashFeed7Snapshot):{state:DashFeed7Readiness;message:string} {
  if (snapshot.home_views === 0) return {state:"no_data",message:"Nessuna apertura Home registrata nel periodo: verifica raccolta e account di prova."};
  if (snapshot.unique_home_users < 10) return {state:"insufficient_sample",message:"Campione insufficiente: servono almeno 10 account distinti per interpretare le tendenze; le visite ripetute dello stesso account non dimostrano retention."};
  if (Object.values(snapshot.actions).every((n) => n === 0)) return {state:"awaiting_actions",message:"La Home è stata visitata, ma non risultano ancora azioni esplicite sul feed. Verifica la raccolta dei clic prima di modificare il ranking."};
  if (snapshot.d1.eligible < 10 || snapshot.d7.eligible < 10) return {state:"cohort_maturing",message:"Le interazioni sono presenti, ma le coorti D+1 e D+7 devono ancora maturare con almeno 10 utenti eleggibili ciascuna."};
  return {state:"exploratory",message:"Dati disponibili per un confronto descrittivo. Non rappresentano una prova causale di retention o di conversione commerciale."};
}
