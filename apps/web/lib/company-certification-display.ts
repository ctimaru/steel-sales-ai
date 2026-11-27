export type CertificationValidityState = "valid" | "expired" | "not_yet_valid" | "unknown";
export type CertificationVerificationTone = "confirmed" | "pending" | "attention" | "neutral";

type CertificationDates = { valid_from: string | null; valid_to: string | null };

function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + "T00:00:00.000Z");
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/** Same inclusive date rules as p3_7c_public_company_profile. The caller supplies
 * the current calendar day; verification and documentary references are unrelated.
 */
export function certificationValidityState(
  dates: CertificationDates,
  today: string,
): CertificationValidityState {
  if (!isCalendarDate(today) ||
      (dates.valid_from !== null && !isCalendarDate(dates.valid_from)) ||
      (dates.valid_to !== null && !isCalendarDate(dates.valid_to)) ||
      (dates.valid_from !== null && dates.valid_to !== null && dates.valid_to < dates.valid_from)) {
    return "unknown";
  }
  if (dates.valid_to !== null && dates.valid_to < today) return "expired";
  if (dates.valid_from !== null && dates.valid_from > today) return "not_yet_valid";
  if (dates.valid_from !== null || dates.valid_to !== null) return "valid";
  return "unknown";
}

export const certificationValidityLabels: Record<CertificationValidityState, string> = {
  valid: "Nel periodo indicato",
  expired: "Scaduta",
  not_yet_valid: "Non ancora valida",
  unknown: "Validità non indicata",
};

export function certificationVerification(status: string): {
  label: string;
  tone: CertificationVerificationTone;
} {
  switch (status) {
    case "verified": return { label: "Verificata dalla piattaforma", tone: "confirmed" };
    case "pending": return { label: "Verifica in corso", tone: "pending" };
    case "rejected": return { label: "Verifica respinta", tone: "attention" };
    case "expired": return { label: "Verifica scaduta", tone: "attention" };
    case "revoked": return { label: "Verifica revocata", tone: "attention" };
    case "unverified": return { label: "Non verificata", tone: "neutral" };
    default: return { label: "Stato di verifica non disponibile", tone: "neutral" };
  }
}

/** Format a SQL calendar date without browser or server timezone shifts. */
export function formatCertificationDate(value: string): string {
  return isCalendarDate(value) ? value.slice(8, 10) + "/" + value.slice(5, 7) + "/" + value.slice(0, 4) : "Data non disponibile";
}
