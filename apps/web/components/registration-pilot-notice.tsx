import Link from "next/link";

import { PILOT_CONTACT_EMAIL } from "@/lib/registration-access";

/**
 * ONBOARDING-AUDIT2 · F1 — shown on /register and /en/register while the
 * registration pilot gate is active. `blocking` replaces the company form for a
 * signed-in user whose email is not on the pilot allowlist.
 */
export function RegistrationPilotNotice({
  locale = "it",
  blocking = false,
}: {
  locale?: "it" | "en";
  blocking?: boolean;
}) {
  const en = locale === "en";
  const mailto = `mailto:${PILOT_CONTACT_EMAIL}?subject=${encodeURIComponent(
    en ? "Pilot access request" : "Richiesta di accesso al pilota",
  )}`;

  return (
    <div
      role={blocking ? "alert" : "note"}
      data-testid="registration-pilot-gate"
      className="mt-4 rounded-xl border border-[#ead7aa] bg-[#fff9e8] px-4 py-3 text-sm leading-6 text-[#77551c]"
    >
      <p className="font-semibold">
        {en ? "Registration by invitation during the pilot" : "Registrazione su invito durante il pilota"}
      </p>
      <p className="mt-1">
        {blocking
          ? en
            ? "This email address is not on the pilot invitation list, so the company application cannot be submitted yet."
            : "Questo indirizzo email non è nell’elenco degli inviti del pilota: la richiesta aziendale non può ancora essere inviata."
          : en
            ? "We are opening Smart Steel Sales to a small group of companies. If you were invited, create your account with the email address named in your invitation."
            : "Stiamo aprendo Smart Steel Sales a un gruppo ristretto di aziende. Se hai ricevuto un invito, crea l’account con l’indirizzo email indicato nell’invito."}
      </p>
      <p className="mt-1">
        {en ? "To request access, write to " : "Per richiedere l’accesso scrivi a "}
        <a href={mailto} className="font-semibold underline underline-offset-4">
          {PILOT_CONTACT_EMAIL}
        </a>
        .
      </p>
      {blocking ? (
        <p className="mt-2">
          <Link
            href={en ? "/en/knowledge" : "/knowledge"}
            className="font-semibold underline underline-offset-4"
          >
            {en ? "Meanwhile, use the free public tools" : "Nel frattempo usa gli strumenti pubblici gratuiti"}
          </Link>
        </p>
      ) : null}
    </div>
  );
}
