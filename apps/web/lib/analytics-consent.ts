export const ANALYTICS_CONSENT_STORAGE_KEY = "sss.analytics-consent.v2";
export const LEGACY_ANALYTICS_CONSENT_STORAGE_KEY = "sss.google-analytics-consent.v1";
export const ANALYTICS_CONSENT_VERSION = "lr2-2026-10-04-v1";
export const ANALYTICS_NOTICE_VERSION = "2026-10-04";
export const ANALYTICS_REPROMPT_MONTHS = 6;

export type AnalyticsConsentDecision = "granted" | "denied";

export type AnalyticsConsentRecord = {
  decision: AnalyticsConsentDecision;
  consentVersion: string;
  noticeVersion: string;
  decidedAt: string;
};

export function createAnalyticsConsentRecord(
  decision: AnalyticsConsentDecision,
  decidedAt = new Date(),
): AnalyticsConsentRecord {
  return {
    decision,
    consentVersion: ANALYTICS_CONSENT_VERSION,
    noticeVersion: ANALYTICS_NOTICE_VERSION,
    decidedAt: decidedAt.toISOString(),
  };
}

export function analyticsConsentExpiresAt(record: AnalyticsConsentRecord) {
  const decidedAt = new Date(record.decidedAt);
  if (Number.isNaN(decidedAt.getTime())) return null;

  const expiresAt = new Date(decidedAt);
  expiresAt.setMonth(expiresAt.getMonth() + ANALYTICS_REPROMPT_MONTHS);
  return expiresAt;
}

export function analyticsConsentRecordIsCurrent(
  record: AnalyticsConsentRecord,
  now = new Date(),
) {
  if (
    record.consentVersion !== ANALYTICS_CONSENT_VERSION ||
    record.noticeVersion !== ANALYTICS_NOTICE_VERSION
  ) {
    return false;
  }

  const expiresAt = analyticsConsentExpiresAt(record);
  return Boolean(expiresAt && expiresAt.getTime() > now.getTime());
}

export function parseAnalyticsConsentRecord(raw: string | null) {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<AnalyticsConsentRecord>;
    if (
      (parsed.decision === "granted" || parsed.decision === "denied") &&
      typeof parsed.consentVersion === "string" &&
      typeof parsed.noticeVersion === "string" &&
      typeof parsed.decidedAt === "string"
    ) {
      return parsed as AnalyticsConsentRecord;
    }
  } catch {
    return null;
  }

  return null;
}
