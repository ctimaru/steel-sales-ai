import "server-only";

import { legalIdentityConfigured } from "@/lib/legal";

/**
 * ONBOARDING-AUDIT2 · F1 — Registration pilot gate.
 *
 * Company self-registration asks applicants to accept the Privacy notice and
 * Terms. While the controller identity is not configured those documents name
 * no controller, so public self-registration stays closed: only emails on the
 * pilot allowlist can create an account and submit a company application.
 *
 * - Active in production (VERCEL_ENV=production) or when
 *   REGISTRATION_ACCESS_MODE=pilot_invite is set (local/CI testing).
 * - Turns off automatically with the first deployment that configures
 *   NEXT_PUBLIC_LEGAL_CONTROLLER_NAME, NEXT_PUBLIC_LEGAL_CONTROLLER_ADDRESS and
 *   NEXT_PUBLIC_LEGAL_PRIVACY_EMAIL — the same rule as RFQ-MAIL2.
 * - REGISTRATION_PILOT_ALLOWLIST (server-only): comma-separated emails or
 *   "@domain" entries, e.g. "mario.rossi@acciai.it,@tubiferro.it".
 *   Empty or missing = nobody can self-register (fail-closed).
 */
export const PILOT_CONTACT_EMAIL = "hello@smartsteelsales.com";

export function registrationPilotGateActive(): boolean {
  if (legalIdentityConfigured()) return false;
  return (
    process.env.VERCEL_ENV === "production" ||
    process.env.REGISTRATION_ACCESS_MODE === "pilot_invite"
  );
}

function pilotAllowlist(): string[] {
  return String(process.env.REGISTRATION_PILOT_ALLOWLIST ?? "")
    .split(/[,;\s]+/)
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry.length > 1 && entry.includes("@"));
}

export function pilotEmailAllowed(email: unknown): boolean {
  const value = String(email ?? "").trim().toLowerCase();
  const at = value.lastIndexOf("@");
  if (at < 1 || at === value.length - 1) return false;
  const domain = value.slice(at);
  return pilotAllowlist().some((entry) =>
    entry.startsWith("@") ? entry === domain : entry === value,
  );
}

/** True when this email may create an account or submit a new company application. */
export function registrationAllowedFor(email: unknown): boolean {
  return !registrationPilotGateActive() || pilotEmailAllowed(email);
}

export function pilotGateMessage(locale: "it" | "en"): string {
  return locale === "en"
    ? `During the pilot, company registration is by invitation only. Use the email address named in your invitation, or write to ${PILOT_CONTACT_EMAIL} to request access.`
    : `Durante la fase pilota la registrazione delle aziende è solo su invito. Usa l’indirizzo email indicato nell’invito oppure scrivi a ${PILOT_CONTACT_EMAIL} per richiedere l’accesso.`;
}
