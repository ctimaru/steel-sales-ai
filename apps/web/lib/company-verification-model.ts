/**
 * SELFVER1: presentation of the "Azienda verificata" badge state.
 * Pure: parses the selfver1-state-v1 contract and maps reason codes to Italian
 * copy. Never grants anything; an unknown or missing payload hides the card.
 */

export type CompanyVerificationStatus = "unverified" | "pending" | "verified" | "rejected" | "expired" | "revoked";

export type CompanyVerificationState = {
  status: CompanyVerificationStatus;
  method: "automatic_domain" | "staff_review" | "company_request" | null;
  verifiedAt: string | null;
  reasons: string[];
  manualRequestPending: boolean;
  autoEligible: boolean;
};

const STATUSES = new Set(["unverified", "pending", "verified", "rejected", "expired", "revoked"]);
const METHODS = new Set(["automatic_domain", "staff_review", "company_request"]);

export function parseCompanyVerificationState(value: unknown): CompanyVerificationState | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (v.contract !== "selfver1-state-v1" || v.has_company !== true) return null;
  const status = typeof v.verification_status === "string" && STATUSES.has(v.verification_status)
    ? (v.verification_status as CompanyVerificationStatus)
    : null;
  if (!status) return null;
  return {
    status,
    method: typeof v.method === "string" && METHODS.has(v.method) ? (v.method as CompanyVerificationState["method"]) : null,
    verifiedAt: typeof v.verified_at === "string" ? v.verified_at : null,
    reasons: Array.isArray(v.reasons) ? v.reasons.filter((r): r is string => typeof r === "string").slice(0, 12) : [],
    manualRequestPending: v.manual_request_pending === true,
    autoEligible: v.auto_eligible === true,
  };
}

const REASON_COPY: Record<string, string> = {
  email_not_confirmed: "Conferma l’email con cui hai registrato l’azienda.",
  no_website: "Aggiungi il sito aziendale al profilo.",
  generic_email_domain: "Ti sei registrato con un’email personale o PEC: la verifica automatica richiede un’email sul dominio del sito aziendale.",
  email_domain_mismatch: "L’email di registrazione non è sul dominio del sito aziendale.",
  shared_website_domain: "Il dominio del sito è usato anche da un’altra azienda del Network.",
  vat_invalid: "La partita IVA non supera il controllo formale.",
  non_italian_manual_review: "Per le aziende fuori dall’Italia la verifica è fatta dallo staff.",
  staff_decision: "Lo stato di verifica è stato deciso dallo staff: per rivederlo contatta l’assistenza.",
  no_linked_company: "Il profilo Network dell’azienda non è ancora collegato.",
};

/** Italian sentences for the reasons we can explain; unknown codes are dropped. */
export function verificationReasonCopy(reasons: readonly string[]): string[] {
  const out: string[] = [];
  for (const reason of reasons) {
    const copy = REASON_COPY[reason];
    if (copy && !out.includes(copy)) out.push(copy);
  }
  return out;
}

/** The manual request is useful only when automation cannot verify and staff has not decided. */
export function canRequestManualVerification(state: CompanyVerificationState, isAdmin: boolean): boolean {
  return isAdmin &&
    (state.status === "unverified" || state.status === "expired") &&
    !state.manualRequestPending &&
    !state.reasons.includes("staff_decision");
}
