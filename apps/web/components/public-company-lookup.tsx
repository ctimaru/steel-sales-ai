"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

import {
  initialPublicCompanyLookupState,
  type PublicCompanyLookupItem,
  type PublicCompanyLookupState,
} from "@/lib/public-company-lookup-contract";
import { trackProductEvent } from "@/lib/product-analytics-events.client";

function claimBadge(state: PublicCompanyLookupItem["claim_state"], locale: "it" | "en") {
  if (state === "claimable") {
    return {
      label: locale === "en" ? "Available to claim" : "Claim disponibile",
      className: "bg-[#edf5f2] text-[#173f35]",
    };
  }
  if (state === "claim_in_progress") {
    return {
      label: locale === "en" ? "Claim under review" : "Claim in verifica",
      className: "bg-amber-50 text-amber-800",
    };
  }
  return {
    label: locale === "en" ? "Already claimed" : "Già rivendicata",
    className: "bg-[#ecefed] text-[#52615b]",
  };
}

function ResultAction({ item, locale }: { item: PublicCompanyLookupItem; locale: "it" | "en" }) {
  if (item.claim_state === "claimable") {
    const claimPath = locale === "en"
      ? `/en/register?claim_ref=${encodeURIComponent(item.claim_ref)}`
      : `/register?claim_ref=${encodeURIComponent(item.claim_ref)}`;
    return (
      <Link
        href={claimPath}
        onClick={() => trackProductEvent("company_claim_start", { source: "company_lookup" })}
        className="platform-primary inline-flex min-h-10 items-center justify-center rounded-xl px-3 text-xs font-semibold"
      >
        {locale === "en" ? "Claim this company" : "Rivendica questa azienda"}
      </Link>
    );
  }

  const nextPath =
    item.claim_state === "claimed" ? "/network/manage" : "/registration/status";

  const loginPath = locale === "en"
    ? `/en/login?next=${encodeURIComponent(nextPath)}`
    : `/login?next=${encodeURIComponent(nextPath)}`;
  return (
    <Link
      href={loginPath}
      className="inline-flex min-h-10 items-center justify-center rounded-xl border border-[#d7dfdb] bg-white px-3 text-xs font-semibold text-[#52615b] hover:bg-[#f4f7f5] hover:text-[#173f35]"
    >
      {locale === "en" ? (item.claim_state === "claimed" ? "Sign in to manage" : "Sign in to check") : (item.claim_state === "claimed" ? "Accedi per gestirla" : "Accedi per verificare")}
    </Link>
  );
}

type PublicCompanyLookupProps = {
  context?: "default" | "registration";
  notFoundHref?: string;
  notFoundLabel?: string;
  showNetworkNote?: boolean;
  locale?: "it" | "en";
};

export function PublicCompanyLookup({
  context = "default",
  notFoundHref = "/register",
  notFoundLabel = "Registra la tua azienda →",
  showNetworkNote = true,
  locale = "it",
}: PublicCompanyLookupProps = {}) {
  const registrationContext = context === "registration";
  const [state, setState] = useState<PublicCompanyLookupState>(
    initialPublicCompanyLookupState,
  );
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    setPending(true);

    try {
      const response = await fetch("/api/public/company-lookup", {
        method: "POST",
        body: new FormData(event.currentTarget),
        cache: "no-store",
      });

      if (!response.ok) {
        setState({ status: "error", mode: null, items: [] });
        return;
      }

      const payload = (await response.json()) as PublicCompanyLookupState;

      if (
        !payload ||
        !["idle", "invalid", "error", "not_found", "ok"].includes(payload.status) ||
        !Array.isArray(payload.items)
      ) {
        setState({ status: "error", mode: null, items: [] });
        return;
      }

      trackProductEvent("company_search", {
        context,
        result: payload.status,
        matches: payload.items.length,
      });
      setState(payload);
    } catch {
      setState({ status: "error", mode: null, items: [] });
    } finally {
      setPending(false);
    }
  }

  return (
    <div
      className={
        registrationContext
          ? "rounded-2xl border border-[#dce2df] bg-[#f8faf9] p-5 sm:p-6"
          : "rounded-[28px] border border-[#dce2df] bg-[#f8faf9] p-5 sm:p-6"
      }
    >
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#1a5144]">
          {locale === "en" ? (registrationContext ? "Before you register" : "Find your company") : (registrationContext ? "Prima di registrarti" : "Trova la tua azienda")}
        </p>
        <h3 className="mt-2 text-2xl font-semibold tracking-tight text-[#1d2824]">
          {locale === "en" ? (registrationContext ? "Check if your company is already listed" : "Is your company on Smart Steel Sales?") : (registrationContext ? "Verifica se la tua azienda è già presente" : "È già presente su Smart Steel Sales?")}
        </h3>
        <p className="mt-2 text-sm leading-6 text-[#5d6a65]">
          {locale === "en" ? "Search by legal company name or VAT number. If your company already has a claimable profile, link it to this application instead of creating a duplicate." : (registrationContext ? "Cerca per ragione sociale o Partita IVA. Se esiste già un profilo claimable, lo colleghiamo alla registrazione invece di creare un duplicato." : "Cerca per ragione sociale o Partita IVA. Mostriamo solo l’identità minima necessaria a verificare se il profilo può essere rivendicato.")}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mt-5">
        <div className="sr-only" aria-hidden="true">
          <label>
            Sito aziendale
            <input name="company_website" tabIndex={-1} autoComplete="off" />
          </label>
        </div>
        <label className="block">
          <span className="sr-only">{locale === "en" ? "Company name or VAT number" : "Ragione sociale o Partita IVA"}</span>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              name="company_query"
              type="search"
              required
              minLength={3}
              maxLength={120}
              autoComplete="organization"
              placeholder={locale === "en" ? "Company name or VAT number" : "Ragione sociale o Partita IVA"}
              className="h-12 min-w-0 flex-1 rounded-xl border border-[#cfd9d5] bg-white px-4 text-sm text-[#1d2824] outline-none placeholder:text-[#87938e] focus:border-[#9cc5b7] focus:ring-4 focus:ring-[#e1ece8]"
            />
            <button
              type="submit"
              disabled={pending}
              className="platform-primary h-12 rounded-xl px-5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
            >
              {locale === "en" ? (pending ? "Searching…" : "Search companies") : (pending ? "Ricerca…" : "Cerca azienda")}
            </button>
          </div>
        </label>
      </form>

      <div className="mt-4" aria-live="polite">
        {state.status === "invalid" ? (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {locale === "en" ? "Enter at least 3 characters or a complete VAT number." : "Inserisci almeno 3 caratteri oppure una Partita IVA completa."}
          </p>
        ) : null}

        {state.status === "error" ? (
          <p className="rounded-xl border border-[#efc5bd] bg-[#fff5f3] px-4 py-3 text-sm text-[#9f2f24]">
            {locale === "en" ? "Company search is temporarily unavailable. Try again later." : "La ricerca non è disponibile in questo momento. Riprova più tardi."}
          </p>
        ) : null}

        {state.status === "not_found" ? (
          <div className="rounded-2xl border border-[#dce2df] bg-white p-4">
            <p className="text-sm font-semibold text-[#1d2824]">{locale === "en" ? "Company not found" : "Azienda non trovata"}</p>
            <p className="mt-1 text-xs leading-5 text-[#66736e]">
              {locale === "en" ? "You can register a new company and complete the application during onboarding." : "Puoi registrare l’azienda e completare i dati durante l’onboarding."}
            </p>
            <Link
              href={notFoundHref}
              className="mt-3 inline-flex text-xs font-semibold text-[#1a5144] underline decoration-[#b8d2c8] underline-offset-4"
            >
              {notFoundLabel}
            </Link>
          </div>
        ) : null}

        {state.status === "ok" ? (
          <div className="space-y-3">
            {state.items.map((item, index) => {
              const badge = claimBadge(item.claim_state, locale);
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
                        {item.vat_hint ? (locale === "en" ? " · VAT " : " · P.IVA ") + item.vat_hint : ""}
                      </p>
                    </div>
                    <ResultAction item={item} locale={locale} />
                  </div>
                </article>
              );
            })}
          </div>
        ) : null}
      </div>

      {showNetworkNote ? (
        <div className="mt-4 rounded-xl border border-[#d9e8e2] bg-[#edf5f2] px-4 py-3">
          <p className="text-xs leading-5 text-[#52615b]">
            <strong className="text-[#173f35]">{locale === "en" ? "The full Network is not public." : "Il Network completo non è pubblico."}</strong>{" "}
            {locale === "en" ? "Company details and contacts are private to authorized members." : "Directory, filtri, prodotti, capability, mercati e contatti restano un prodotto privato disponibile alle aziende registrate con accesso Network."}{" "}
            <Link
              href="/company-data"
              className="font-semibold text-[#1a5144] underline decoration-[#b8d2c8] underline-offset-4"
            >
              {locale === "en" ? "Sources, corrections and removals (IT)" : "Fonti, correzioni e rimozioni"}
            </Link>
          </p>
        </div>
      ) : null}
    </div>
  );
}
