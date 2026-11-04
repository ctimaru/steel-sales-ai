import Link from "next/link";

import { requestCompanyVerification } from "@/app/(workspace)/dashboard/verification-actions";
import {
  canRequestManualVerification,
  verificationReasonCopy,
  type CompanyVerificationState,
} from "@/lib/company-verification-model";

/**
 * SELFVER1 (point 4 of the first-access audit): the company sees whether it
 * carries the "Azienda verificata" badge, why not yet, and how to get it.
 * Server component; the only write is the admin-only manual request form.
 */
export function CompanyVerificationCard({
  state,
  isAdmin,
  flash,
  profileHref,
}: {
  state: CompanyVerificationState | null;
  isAdmin: boolean;
  flash: "requested" | "error" | null;
  profileHref: string;
}) {
  if (!state) return null;
  const reasons = verificationReasonCopy(state.reasons);
  const verified = state.status === "verified";
  const pending = state.status === "pending";

  return (
    <section
      id="home-verification"
      aria-labelledby="home-verification-heading"
      data-testid="home-verification"
      data-status={state.status}
      className={"scroll-mt-24 rounded-2xl border p-4 " + (verified ? "border-[#a9ccbb] bg-[#f2f8f4]" : "border-[#dce5df] bg-white")}
    >
      <div className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className={"flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold " +
            (verified ? "bg-[#176045] text-white" : pending ? "border-2 border-[#c9a35a] text-[#815017]" : "border border-[#b9c9bf] text-[#53675b]")}
        >
          {verified ? "✓" : pending ? "…" : "?"}
        </span>
        <h2 id="home-verification-heading" className="text-sm font-semibold text-[#173f35]">
          {verified ? "Azienda verificata" : pending ? "Verifica in corso" : "Azienda non ancora verificata"}
        </h2>
      </div>

      {verified ? (
        <p className="mt-1.5 text-xs leading-5 text-[#3f5248]">
          La spunta compare sul tuo profilo e nei risultati del Network
          {state.method === "automatic_domain" ? " (verifica automatica dal dominio aziendale)." : "."}
        </p>
      ) : pending ? (
        <p className="mt-1.5 text-xs leading-5 text-[#3f5248]">
          Lo staff sta verificando la tua azienda. Intanto puoi usare la piattaforma normalmente.
        </p>
      ) : (
        <>
          <p className="mt-1.5 text-xs leading-5 text-[#3f5248]">
            Puoi lavorare normalmente; la spunta rende la tua azienda riconoscibile a fornitori e clienti.
          </p>
          {reasons.length ? (
            <ul className="mt-2 space-y-1 text-[11px] leading-4 text-[#52615b]">
              {reasons.map((reason) => (
                <li key={reason}>• {reason}</li>
              ))}
            </ul>
          ) : null}
          {state.reasons.includes("no_website") ? (
            <Link href={profileHref} className="mt-2 inline-flex min-h-9 items-center text-xs font-semibold text-[#175640] underline underline-offset-4">
              Aggiungi il sito al profilo <span aria-hidden="true">&nbsp;→</span>
            </Link>
          ) : null}
          {canRequestManualVerification(state, isAdmin) ? (
            <form action={requestCompanyVerification} className="mt-3 space-y-2">
              <label htmlFor="home-verification-note" className="block text-[11px] font-semibold text-[#4d6156]">
                Richiedi la verifica allo staff
              </label>
              <textarea
                id="home-verification-note"
                name="note"
                rows={2}
                maxLength={1000}
                placeholder="Facoltativo: es. visura camerale disponibile, sito in aggiornamento…"
                className="w-full resize-y rounded-lg border border-[#c8dccf] bg-[#fafcfb] px-2.5 py-1.5 text-xs text-[#143f30] placeholder:text-[#72877a] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#175640]"
              />
              <button
                type="submit"
                data-testid="home-verification-request"
                className="inline-flex min-h-10 items-center justify-center rounded-full bg-[#176045] px-4 text-xs font-semibold !text-white hover:bg-[#114b36] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#176045]"
              >
                Richiedi la verifica
              </button>
            </form>
          ) : null}
        </>
      )}

      {flash === "requested" ? (
        <p role="status" className="mt-2 text-[11px] font-semibold text-[#175640]">Richiesta inviata allo staff.</p>
      ) : flash === "error" ? (
        <p role="alert" className="mt-2 text-[11px] text-[#9d4e28]">Non è stato possibile inviare la richiesta. Riprova più tardi.</p>
      ) : null}
    </section>
  );
}
