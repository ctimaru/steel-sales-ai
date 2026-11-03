import { legalIdentity, legalIdentityConfigured } from "@/lib/legal";
import { absoluteUrl } from "@/lib/site";

/**
 * ONBOARDING-AUDIT2 · F2 — outcome emails to the registration applicant.
 *
 * Sent after a platform staff decision so the applicant no longer has to log
 * in to discover it. The email carries no review notes or company data beyond
 * the legal name: the details stay on /registration/status behind login.
 */
export type RegistrationOutcomeKind = "needs_information" | "rejected" | "activated";
export type RegistrationOutcomeLocale = "it" | "en";

export const REGISTRATION_OUTCOME_CONTACT = "hello@smartsteelsales.com";

const STATUS_FOR_KIND: Record<RegistrationOutcomeKind, string> = {
  needs_information: "needs_information",
  rejected: "rejected",
  activated: "activated",
};

/** The email is sent only when the application really is in the matching state. */
export function outcomeMatchesStatus(kind: RegistrationOutcomeKind, status: unknown): boolean {
  return STATUS_FOR_KIND[kind] === status;
}

/** No locale is stored on the application: Italian companies get Italian, everyone else English. */
export function outcomeLocale(countryCode: unknown): RegistrationOutcomeLocale {
  return String(countryCode ?? "").trim().toUpperCase() === "IT" ? "it" : "en";
}

/** Resend accepts idempotency keys up to 256 characters; one key per decision. */
export function outcomeIdempotencyKey(
  applicationId: string,
  kind: RegistrationOutcomeKind,
  decidedAt: string,
): string {
  return `registration-outcome/${applicationId}/${kind}/${decidedAt}`.slice(0, 256);
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function legalLine() {
  const identity = legalIdentity();
  if (!legalIdentityConfigured(identity)) return null;
  return [identity.controllerName, identity.address, identity.vatId ? "P.IVA " + identity.vatId : null]
    .filter(Boolean)
    .join(" · ");
}

function actionUrl(kind: RegistrationOutcomeKind, locale: RegistrationOutcomeLocale) {
  const login = locale === "en" ? "/en/login" : "/login";
  if (kind === "activated") return absoluteUrl(login);
  const status = locale === "en" ? "/en/registration/status" : "/registration/status";
  return absoluteUrl(login + "?next=" + encodeURIComponent(status));
}

type Copy = { subject: string; preheader: string; title: string; body: string; cta: string };

function copyFor(kind: RegistrationOutcomeKind, locale: RegistrationOutcomeLocale, legalName: string): Copy {
  if (locale === "en") {
    switch (kind) {
      case "needs_information":
        return {
          subject: `Update needed for the ${legalName} application`,
          preheader: "The review team needs a few more details.",
          title: "We need a few more details",
          body: `We reviewed the registration application for ${legalName} and need some additional information. Sign in to see what to update, then resubmit the application.`,
          cta: "Update the application",
        };
      case "rejected":
        return {
          subject: `Outcome of the ${legalName} registration application`,
          preheader: "The application was not approved.",
          title: "The application was not approved",
          body: `The registration application for ${legalName} was not approved. Sign in to see the reason and, where allowed, correct the details and resubmit.`,
          cta: "See the outcome",
        };
      case "activated":
        return {
          subject: `The ${legalName} workspace is active`,
          preheader: "Your company workspace is ready.",
          title: "Your company workspace is active",
          body: `The application was approved and the company workspace for ${legalName} is now active. Sign in to complete the initial setup.`,
          cta: "Sign in to Smart Steel Sales",
        };
    }
  }

  switch (kind) {
    case "needs_information":
      return {
        subject: `Serve un aggiornamento alla richiesta di ${legalName}`,
        preheader: "La revisione richiede qualche informazione in più.",
        title: "Ci serve qualche informazione in più",
        body: `Abbiamo esaminato la richiesta di registrazione di ${legalName} e ci servono alcune informazioni aggiuntive. Accedi per vedere cosa aggiornare, poi invia di nuovo la richiesta.`,
        cta: "Aggiorna la richiesta",
      };
    case "rejected":
      return {
        subject: `Esito della richiesta di registrazione di ${legalName}`,
        preheader: "La richiesta non è stata approvata.",
        title: "La richiesta non è stata approvata",
        body: `La richiesta di registrazione di ${legalName} non è stata approvata. Accedi per vedere la motivazione e, quando possibile, correggere i dati e ripresentarla.`,
        cta: "Vedi l’esito",
      };
    case "activated":
      return {
        subject: `Il workspace di ${legalName} è attivo`,
        preheader: "Il workspace aziendale è pronto.",
        title: "Il workspace aziendale è attivo",
        body: `La richiesta è stata approvata e il workspace aziendale di ${legalName} è attivo. Accedi per completare la configurazione iniziale.`,
        cta: "Entra in Smart Steel Sales",
      };
  }
}

export function buildRegistrationOutcomeEmail(input: {
  kind: RegistrationOutcomeKind;
  locale: RegistrationOutcomeLocale;
  legalName: string;
}) {
  const legalName = input.legalName.trim().slice(0, 255) || (input.locale === "en" ? "your company" : "la tua azienda");
  const copy = copyFor(input.kind, input.locale, legalName);
  const url = actionUrl(input.kind, input.locale);
  const privacyUrl = absoluteUrl("/privacy");
  const legal = legalLine();
  const en = input.locale === "en";
  const why = en
    ? "You are receiving this email because you submitted a company registration application on Smart Steel Sales with this address."
    : "Ricevi questa email perché hai inviato una richiesta di registrazione aziendale su Smart Steel Sales con questo indirizzo.";
  const questions = en
    ? `Questions? Write to ${REGISTRATION_OUTCOME_CONTACT}.`
    : `Domande? Scrivi a ${REGISTRATION_OUTCOME_CONTACT}.`;
  const privacyLabel = en ? "Privacy notice (IT)" : "Informativa privacy";

  const html = `<!doctype html>
<html lang="${input.locale}">
  <head><meta charset="utf-8"><title>${escapeHtml(copy.subject)}</title></head>
  <body style="margin:0;background:#f3f5f4;font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
    <div style="display:none;max-height:0;overflow:hidden;">${escapeHtml(copy.preheader)}</div>
    <div style="max-width:600px;margin:0 auto;padding:28px 16px;">
      <div style="background:#123d34;border-radius:16px 16px 0 0;padding:24px;color:#ffffff;">
        <div style="font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#a8cfc1;">Smart Steel Sales</div>
        <h1 style="margin:10px 0 0;font-size:22px;line-height:1.3;">${escapeHtml(copy.title)}</h1>
      </div>
      <div style="background:#ffffff;border:1px solid #dce2df;border-top:0;border-radius:0 0 16px 16px;padding:24px;">
        <p style="margin:0 0 20px;font-size:15px;line-height:1.6;">${escapeHtml(copy.body)}</p>
        <a href="${escapeHtml(url)}" style="display:inline-block;box-sizing:border-box;background:#173f35;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 20px;border-radius:10px;">${escapeHtml(copy.cta)}</a>
        <div style="margin:24px 0 0;padding:16px 0 0;border-top:1px solid #e5e7eb;font-size:12px;line-height:1.6;color:#6b7280;">
          <p style="margin:0 0 8px;">${escapeHtml(why)}</p>
          <p style="margin:0;">${escapeHtml(questions)} · <a href="${escapeHtml(privacyUrl)}" style="color:#173f35;">${escapeHtml(privacyLabel)}</a></p>
          ${legal ? `<p style="margin:8px 0 0;">${escapeHtml(legal)}</p>` : ""}
        </div>
      </div>
    </div>
  </body>
</html>`;

  const text = [
    copy.title,
    "",
    copy.body,
    "",
    copy.cta + ": " + url,
    "",
    "—",
    why,
    questions,
    privacyLabel + ": " + privacyUrl,
    ...(legal ? [legal] : []),
  ].join("\n");

  return { subject: copy.subject, html, text };
}
