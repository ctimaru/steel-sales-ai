import "server-only";

import {
  buildRegistrationOutcomeEmail,
  outcomeIdempotencyKey,
  outcomeLocale,
  outcomeMatchesStatus,
  REGISTRATION_OUTCOME_CONTACT,
  type RegistrationOutcomeKind,
} from "@/lib/registration-outcome-email";
import { createClient } from "@/lib/supabase/server";

export type RegistrationOutcomeEmailResult =
  | { sent: true }
  | { sent: false; reason: "not_configured" | "application_unavailable" | "status_mismatch" | "provider_error" };

/**
 * ONBOARDING-AUDIT2 · F2 — best effort, after the decision RPC has committed.
 * A failed email never undoes or blocks the staff decision; the caller shows
 * the outcome to the operator. The applicant email is read through the same
 * permission-checked RPC the console already uses (registrations.read).
 */
export async function sendRegistrationOutcomeEmail(
  applicationId: string,
  kind: RegistrationOutcomeKind,
): Promise<RegistrationOutcomeEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { sent: false, reason: "not_configured" };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("p0a_admin_registration_detail", {
    p_application_id: applicationId,
  });
  const application = (data as {
    application?: {
      id?: string;
      applicant_email_snapshot?: string;
      legal_name?: string;
      country_code?: string;
      application_status?: string;
      updated_at?: string;
    };
  } | null)?.application;

  if (error || !application?.applicant_email_snapshot || !application.updated_at) {
    return { sent: false, reason: "application_unavailable" };
  }
  if (!outcomeMatchesStatus(kind, application.application_status)) {
    return { sent: false, reason: "status_mismatch" };
  }

  const email = buildRegistrationOutcomeEmail({
    kind,
    locale: outcomeLocale(application.country_code),
    legalName: application.legal_name ?? "",
  });
  const from =
    process.env.REGISTRATION_EMAIL_FROM ||
    "Smart Steel Sales <registrazioni@smartsteelsales.com>";

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + apiKey,
        "Content-Type": "application/json",
        "Idempotency-Key": outcomeIdempotencyKey(applicationId, kind, application.updated_at),
      },
      body: JSON.stringify({
        from,
        to: [application.applicant_email_snapshot],
        reply_to: [REGISTRATION_OUTCOME_CONTACT],
        subject: email.subject,
        html: email.html,
        text: email.text,
        tags: [{ name: "category", value: "registration_outcome" }],
      }),
      cache: "no-store",
    });
    const body = (await response.json().catch(() => ({}))) as { id?: string; message?: string };
    if (!response.ok || !body.id) {
      // No recipient address in logs.
      console.error("Registration outcome email failed:", kind, response.status, body.message ?? "");
      return { sent: false, reason: "provider_error" };
    }
    return { sent: true };
  } catch (sendError) {
    console.error("Registration outcome email failed:", kind, sendError instanceof Error ? sendError.message : "");
    return { sent: false, reason: "provider_error" };
  }
}

export function outcomeEmailOperatorNote(result: RegistrationOutcomeEmailResult): string {
  if (result.sent) return " Email di notifica inviata al richiedente.";
  switch (result.reason) {
    case "not_configured":
      return " Email al richiedente non inviata: canale email non configurato (RESEND_API_KEY).";
    case "status_mismatch":
      return " Email al richiedente non inviata: lo stato della pratica non corrisponde.";
    case "application_unavailable":
      return " Email al richiedente non inviata: dati della pratica non leggibili.";
    default:
      return " Email al richiedente non inviata: errore del provider. Avvisa il richiedente manualmente.";
  }
}
