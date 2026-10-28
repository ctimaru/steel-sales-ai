import { createClient } from "@/lib/supabase/server";

/**
 * PROD-NEXT1.E1: readiness is NOT production analytics.
 * Future event ingestion must independently verify successful commercial state,
 * organization admission, user permission and consent at the server boundary.
 * No event emitter is provided by this module.
 */
export const PILOT_ACTIVATION_TELEMETRY_ENABLED = false as const;
export const PILOT_ACTIVATION_EVENT_NAMES = [
  "valid_bill_created",
  "private_rfq_draft_saved",
  "supplier_selection_reviewed",
  "qualified_quote_submitted",
  "po_confirmed",
] as const;

export type PilotActivationEvent = (typeof PILOT_ACTIVATION_EVENT_NAMES)[number];
export type PilotAdmissionState = "review" | "verified" | "approved" | "suspended" | "withdrawn";

export type PilotAdmission = {
  organization_id: string;
  state: PilotAdmissionState;
  legal_basis_reference: string | null;
  notice_version: string | null;
  terms_version: string | null;
  reviewed_at: string | null;
};

export type PilotActivationGovernance = {
  gate: "NO-GO";
  telemetry_enabled: false;
  admissions: PilotAdmission[];
};

export const PILOT_ACTIVATION_KPIS: ReadonlyArray<{
  event: PilotActivationEvent;
  label: string;
  definition: string;
}> = [
  { event: "valid_bill_created", label: "Distinte valide", definition: "Distinta tecnicamente valida e persistita" },
  { event: "private_rfq_draft_saved", label: "RFQ private", definition: "Bozza privata salvata da buyer autorizzato" },
  { event: "supplier_selection_reviewed", label: "Fornitori esaminati", definition: "Selezione destinatari confermata, senza invio" },
  { event: "qualified_quote_submitted", label: "Offerte qualificate", definition: "Offerta normalizzata accettata dal sistema" },
  { event: "po_confirmed", label: "Ordini confermati", definition: "Conferma fornitore su PO immutabile" },
];

export function isPilotAnalyticsEventPermitted(input: {
  launchApproved: boolean;
  admissionApproved: boolean;
  organizationMembershipActive: boolean;
  userAnalyticsOptInCurrent: boolean;
  successfulServerTransition: boolean;
  event: string;
}): boolean {
  return PILOT_ACTIVATION_TELEMETRY_ENABLED &&
    input.launchApproved &&
    input.admissionApproved &&
    input.organizationMembershipActive &&
    input.userAnalyticsOptInCurrent &&
    input.successfulServerTransition &&
    PILOT_ACTIVATION_EVENT_NAMES.some((event) => event === input.event);
}

export async function getPilotActivationGovernance(): Promise<PilotActivationGovernance> {
  const client = await createClient();
  const { data, error } = await client.rpc("prod_next1e_governance");
  if (error) throw new Error("Stato governance pilot non disponibile; nessun dato live può essere mostrato.");
  if (!data || data.gate !== "NO-GO" || data.telemetry_enabled !== false ||
      !Array.isArray(data.admissions)) {
    throw new Error("Risposta governance pilot non valida; blocco in sicurezza.");
  }
  return data as PilotActivationGovernance;
}
