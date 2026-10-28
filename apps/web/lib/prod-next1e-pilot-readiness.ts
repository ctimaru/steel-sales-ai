/**
 * PROD-NEXT1.E — superadmin-controlled pilot company admission, default-deny.
 * Documentation references only, never personal consent data or raw contracts.
 * This is an operator attestation gate, NOT a substitute for legal review or
 * server-side individual analytics consent. No telemetry is enabled here.
 */
export type PilotAdmissionCheck = {
  key: string;
  label: string;
  passed: boolean;
};

type AdmissionAttestation = {
  organization_id: string;
  signed_pilot_agreement_ref: string;
  approved_privacy_notice_ref: string;
  lawful_basis_review_ref: string;
  data_retention_and_deletion_ref: string;
  backup_restore_drill_ref: string;
  support_and_incident_plan_ref: string;
  founder_approval_ref: string;
  approved_at: string;
  expires_at: string;
};

const APPROVAL_FIELDS = [
  ["signed_pilot_agreement_ref", "Accordo di pilot firmato"],
  ["approved_privacy_notice_ref", "Informativa privacy approvata"],
  ["lawful_basis_review_ref", "Base giuridica e ruoli privacy verificati"],
  ["data_retention_and_deletion_ref", "Conservazione e cancellazione definite"],
  ["backup_restore_drill_ref", "Ripristino e backup collaudati"],
  ["support_and_incident_plan_ref", "Supporto, incident response e stop"],
  ["founder_approval_ref", "Approvazione esplicita del founder"],
] as const;

function approvedRef(value: unknown) {
  return typeof value === "string" &&
    /^[a-zA-Z0-9._:\/-]{6,120}$/.test(value);
}

function readApprovedOrganization(
  organizationId: string,
  env: NodeJS.ProcessEnv,
): AdmissionAttestation | null {
  if (!/^[0-9a-f-]{36}$/i.test(organizationId)) return null;
  const raw = env.PILOT_2027_APPROVALS_JSON;
  if (!raw || raw.length > 20000) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value) || value.length > 25) return null;
    const matches = value.filter((candidate): candidate is AdmissionAttestation =>
      Boolean(candidate && typeof candidate === "object" &&
        "organization_id" in candidate && candidate.organization_id === organizationId));
    return matches.length === 1 ? matches[0] : null;
  } catch {
    return null;
  }
}

export function evaluatePilot2027Admission(
  organizationId: string,
  technicalReady: boolean,
  env: NodeJS.ProcessEnv = process.env,
) {
  const evidence = readApprovedOrganization(organizationId, env);
  const now = Date.now();
  const evidenceWindowValid = Boolean(
    evidence &&
    typeof evidence.approved_at === "string" &&
    typeof evidence.expires_at === "string" &&
    Number.isFinite(Date.parse(evidence.approved_at)) &&
    Date.parse(evidence.approved_at) <= now &&
    Number.isFinite(Date.parse(evidence.expires_at)) &&
    Date.parse(evidence.expires_at) > now &&
    Date.parse(evidence.expires_at) - Date.parse(evidence.approved_at) <= 120 * 86400000,
  );
  const checks: PilotAdmissionCheck[] = [
    { key: "technical", label: "Readiness tecnica aziendale", passed: technicalReady },
    { key: "release_switch", label: "Attivazione pilot autorizzata (kill switch)", passed: env.PILOT_2027_ACTIVATION_ENABLED === "enabled" },
    { key: "approved_org", label: "Azienda esplicitamente approvata", passed: Boolean(evidence) },
    { key: "valid_window", label: "Finestra di approvazione valida (max 120 giorni)", passed: evidenceWindowValid },
    ...APPROVAL_FIELDS.map(([field, label]) => ({
      key: field,
      label,
      passed: evidenceWindowValid && approvedRef(evidence?.[field]),
    })),
  ];
  return { ready: checks.every(check => check.passed), checks };
}

/**
 * Real pilot business-event instrumentation is deliberately not available yet.
 * A company attestation is NOT an individual opt-in record. The event backend
 * needs authenticated per-user consent and server-verifiable withdrawal first.
 */
export const PILOT_2027_REAL_METRICS_ENABLED = false as const;

export const PILOT_2027_METRICS = [
  { key: "valid_bill_created", label: "Prima Distinta valida", detail: "Una distinta tecnicamente valida salvata; non un click della calcolatrice." },
  { key: "private_rfq_draft_saved", label: "Prima RFQ privata", detail: "Richiesta privata persistita con Distinta; non una visita alla pagina." },
  { key: "supplier_selection_reviewed", label: "Fornitori revisionati", detail: "Destinatari verificati dall'utente; non implica un invio." },
  { key: "qualified_quote_submitted", label: "Prima offerta qualificata", detail: "Quotazione inviata e normalizzata per una RFQ autorizzata." },
  { key: "po_confirmed", label: "Primo PO confermato", detail: "Risposta di conferma del fornitore su una versione immutabile di ordine." },
] as const;
