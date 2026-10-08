/**
 * NC1.1: never interpret a failed or malformed alert RPC as a healthy state.
 * These parsers are shared by the page and the workspace notification bell.
 */
export type OperationalAlertSummary = {
  open_count: number;
  acknowledged_count: number;
  resolved_count: number;
  critical_open_count: number;
  active_count: number;
  needs_attention: boolean;
  last_alert_at: string | null;
  generated_at: string;
};

export type OperationalAlert = {
  id: number;
  alert_type: string;
  severity: string;
  status: string;
  title: string;
  summary: string;
  occurrence_count: number;
  first_seen_at: string;
  last_seen_at: string;
  acknowledged_at: string | null;
  resolved_at: string | null;
  is_active: boolean;
  needs_attention: boolean;
};

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function count(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function validDate(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && Number.isFinite(Date.parse(value));
}

function optionalDate(value: unknown): value is string | null {
  return value === null || validDate(value);
}

export function parseOperationalAlertSummary(value: unknown): OperationalAlertSummary | null {
  if (!record(value)) return null;
  const s = value;
  if (
    !count(s.open_count) ||
    !count(s.acknowledged_count) ||
    !count(s.resolved_count) ||
    !count(s.critical_open_count) ||
    !count(s.active_count) ||
    s.critical_open_count > s.open_count ||
    s.active_count !== s.open_count + s.acknowledged_count ||
    typeof s.needs_attention !== "boolean" ||
    s.needs_attention !== (s.critical_open_count > 0) ||
    !optionalDate(s.last_alert_at) ||
    !validDate(s.generated_at)
  ) return null;

  return {
    open_count: s.open_count,
    acknowledged_count: s.acknowledged_count,
    resolved_count: s.resolved_count,
    critical_open_count: s.critical_open_count,
    active_count: s.active_count,
    needs_attention: s.needs_attention,
    last_alert_at: s.last_alert_at,
    generated_at: s.generated_at,
  };
}

export function parseOperationalAlertRows(value: unknown): OperationalAlert[] | null {
  if (!Array.isArray(value)) return null;
  for (const item of value) {
    if (
      !record(item) ||
      !count(item.id) || item.id === 0 ||
      typeof item.alert_type !== "string" ||
      !["critical", "warning"].includes(String(item.severity)) ||
      !["open", "acknowledged", "resolved"].includes(String(item.status)) ||
      typeof item.title !== "string" ||
      typeof item.summary !== "string" ||
      !count(item.occurrence_count) || item.occurrence_count === 0 ||
      !validDate(item.first_seen_at) ||
      !validDate(item.last_seen_at) ||
      !optionalDate(item.acknowledged_at) ||
      !optionalDate(item.resolved_at) ||
      typeof item.is_active !== "boolean" ||
      typeof item.needs_attention !== "boolean"
    ) return null;
  }
  return value as OperationalAlert[];
}
