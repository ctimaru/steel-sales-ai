"use client";

import Link from "next/link";
import { useActionState } from "react";

import {
  initialPublicCompanyLookupState,
  lookupPublicCompany,
  type PublicCompanyLookupItem,
} from "@/app/public-company-lookup-actions";

function claimBadge(state: PublicCompanyLookupItem["claim_state"]) {
  if (state === "claimable") {
    return {
      label: "Claim disponibile",
      className: "bg-[#edf5f2] text-[#173f35]",
    };
  }
  if (state === "claim_in_progress") {
    return {
      label: "Claim in verifica",
      className: "bg-amber-50 text-amber-800",
    };
  }
  return {
    label: "Già rivendicata",
    className: "bg-[#ecefed] text-[#52615b]",
  };
}

function ResultAction({ item }: { item: PublicCompanyLookupItem }) {
  if (item.claim_state === "claimable") {
    const claimPath = `/register?claim_ref=${encodeURIComponent(item.claim_ref)}`;
    return (
      <Link
        href={claimPath}
        className="platform-primary inline-flex min-h-10 items-center justify-center rounded-xl px-3 text-xs font-semibold"
      >
        Rivendica questa azienda
      </Link>
    );
  }

  const nextPath =
    item.claim_state === "claimed" ? "/network/manage" : "/registration/status";

  return (
    <Link
      href={`/login?next=${encodeURIComponent(nextPath)}`}
      className="inline-flex min-h-10 items-center justify-center rounded-xl border border-[#d7dfdb] bg-white px-3 text-xs font-semibold text-[#52615b] hover:bg-[#f4f7f5] hover:text-[#173f35]"
    >
      {item.claim_state === "claimed" ? "Accedi per gestirla" : "Accedi per verificare"}
    </Link>
  );
}

export function PublicCompanyLookup() {
  const [state, formAction, pending] = useActionState(
    lookupPublicCompany,
    initialPublicCompanyLookupState,
  );

  return (
    <div className="rounded-[28px] border border-[#dce2df] bg-[#f8faf9] p-5 sm:p-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#1a5144]">
          Trova la tua azienda
        </p>
        <h3 className="mt-2 text-2xl font-semibold tracking-tight text-[#1d2824]">
          È già presente su Smart Steel Sales?
        </h3>
        <p className="mt-2 text-sm leading-6 text-[#66736e]">
          Cerca per ragione sociale o Partita IVA. Mostriamo solo l&apos;identità minima
          necessaria a verificare se il profilo può essere rivendicato.
        </p>
      </div>

      <form action={formAction} className="mt-5">
        <div className="sr-only" aria-hidden="true">
          <label>
            Sito aziendale
            <input name="company_website" tabIndex={-1} autoComplete="off" />
          </label>
        </div>
        <label className="block">
          <span className="sr-only">Ragione sociale o Partita IVA</span>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              name="company_query"
              type="search"
              required
              minLength={3}
              maxLength={120}
              autoComplete="organization"
              placeholder="Ragione sociale o Partita IVA"
              className="h-12 min-w-0 flex-1 rounded-xl border border-[#cfd9d5] bg-white px-4 text-sm text-[#1d2824] outline-none placeholder:text-[#87938e] focus:border-[#9cc5b7] focus:ring-4 focus:ring-[#e1ece8]"
            />
            <button
              type="submit"
              disabled={pending}
              className="platform-primary h-12 rounded-xl px-5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending ? "Ricerca…" : "Cerca azienda"}
            </button>
          </div>
        </label>
      </form>

      <div className="mt-4" aria-live="polite">
        {state.status === "invalid" ? (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Inserisci almeno 3 caratteri oppure una Partita IVA completa.
          </p>
        ) : null}

        {state.status === "error" ? (
          <p className="rounded-xl border border-[#efc5bd] bg-[#fff5f3] px-4 py-3 text-sm text-[#9f2f24]">
            La ricerca non è disponibile in questo momento. Riprova più tardi.
          </p>
        ) : null}

        {state.status === "not_found" ? (
          <div className="rounded-2xl border border-[#dce2df] bg-white p-4">
            <p className="text-sm font-semibold text-[#1d2824]">Azienda non trovata</p>
            <p className="mt-1 text-xs leading-5 text-[#66736e]">
              Puoi registrare l&apos;azienda e completare i dati durante l&apos;onboarding.
            </p>
            <Link
              href="/register"
              className="mt-3 inline-flex text-xs font-semibold text-[#1a5144] underline decoration-[#b8d2c8] underline-offset-4"
            >
              Registra la tua azienda →
            </Link>
          </div>
        ) : null}

        {state.status === "ok" ? (
          <div className="space-y-3">
            {state.items.map((item, index) => {
              const badge = claimBadge(item.claim_state);
              return (
                <article
                  key={item.legal_name + item.country_code + index}
                  className="rounded-2xl border border-[#dce2df] bg-white p-4"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="text-sm font-semibold text-[#1d2824]">
                          {item.legal_name}
                        </h4>
                        <span
                          className={[
                            "rounded-full px-2.5 py-1 text-[10px] font-bold",
                            badge.className,
                          ].join(" ")}
                        >
                          {badge.label}
                        </span>
                      </div>
                      {item.trading_name && item.trading_name !== item.legal_name ? (
                        <p className="mt-1 text-xs text-[#66736e]">{item.trading_name}</p>
                      ) : null}
                      <p className="mt-2 text-xs text-[#87938e]">
                        {item.country_code}
                        {item.vat_hint ? " · P.IVA " + item.vat_hint : ""}
                      </p>
                    </div>
                    <ResultAction item={item} />
                  </div>
                </article>
              );
            })}
          </div>
        ) : null}
      </div>

      <div className="mt-4 rounded-xl border border-[#d9e8e2] bg-[#edf5f2] px-4 py-3">
        <p className="text-xs leading-5 text-[#52615b]">
          <strong className="text-[#173f35]">Il Network completo non è pubblico.</strong>{" "}
          Directory, filtri, prodotti, capability, mercati e contatti restano un prodotto
          privato disponibile alle aziende registrate con accesso Network.
        </p>
      </div>
    </div>
  );
}
