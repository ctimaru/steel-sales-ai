import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { signup } from "@/app/login/actions";
import { safeCommercialReturnTo, withCommercialReturnTo } from "@/lib/auth-next";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { ProductBrand } from "@/components/product-brand";
import { PublicCompanyLookup } from "@/components/public-company-lookup";
import { RegistrationJourney } from "@/components/registration-journey";
import { Input } from "@/components/ui/input";
import { privateNoIndexRobots } from "@/lib/seo";
import { createClient } from "@/lib/supabase/server";

import { logoutRegistration } from "./actions";
import { CompanyRegistrationForm } from "./registration-form";

export const metadata: Metadata = {
  title: "Registra la tua azienda",
  robots: privateNoIndexRobots,
};

type ClaimRegistrationContext = {
  ok?: boolean;
  code?: string;
  claim_ref?: string;
  legal_name?: string;
  trading_name?: string | null;
  country_code?: string;
  vat_hint?: string | null;
  claim_state?: "claimable" | "claim_in_progress" | "claimed";
  can_start_registration?: boolean;
  network_access_included?: boolean;
};

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string; claim_ref?: string; company?: string; return_to?: string }>; 
}) {
  const { error, message, claim_ref: rawClaimRef, company: companyHint, return_to: requestedReturn } = await searchParams;
  const returnTo = safeCommercialReturnTo(requestedReturn);
  const initialCompanySearch = String(companyHint ?? "").trim().slice(0, 120);
  const normalizedClaimRef = String(rawClaimRef ?? "").trim().toLowerCase();
  const claimRef = /^[0-9a-f]{64}$/.test(normalizedClaimRef)
    ? normalizedClaimRef
    : null;

  if (normalizedClaimRef && !claimRef) {
    redirect("/#aziende");
  }

  const registrationPath = withCommercialReturnTo(
    claimRef ? "/register?claim_ref=" + encodeURIComponent(claimRef) : "/register",
    returnTo,
  );
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  const user = authData.user;

  if (!user) {
    return (
      <main className="min-h-screen bg-[#f2f4f3] px-4 py-6 sm:px-6 sm:py-9">
        <div className="mx-auto max-w-[1080px]">
          <div className="flex items-center justify-between gap-4">
            <ProductBrand href="/" showDescriptor={false} />
            <Link
              href={"/login?next=" + encodeURIComponent(registrationPath)}
              className="app-secondary inline-flex min-h-10 items-center justify-center rounded-xl px-4 text-sm font-semibold"
            >
              Accedi
            </Link>
          </div>

          <div className="mt-4 max-w-3xl">
            <p className="app-kicker">Registrazione aziendale · Accesso gratuito</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-[-0.02em] text-[#123d34] sm:text-3xl">
              {claimRef ? "Continua con il profilo selezionato" : "Crea il tuo account aziendale"}
            </h1>
            <p className="mt-1 hidden text-sm leading-5 text-[#52615b] sm:block">
              Inizia dall’account. Puoi controllare se l’azienda è già presente prima o dopo la verifica email.
            </p>
          </div>
          <div className="mt-4 grid min-w-0 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.92fr)] lg:gap-6">
              <section
                id="account"
                className="min-w-0 scroll-mt-4 rounded-[24px] border border-[#cbded5] bg-white p-4 shadow-[0_14px_44px_rgba(18,61,52,0.05)] sm:p-6" data-testid="onboarding-ux2-account"
              >
                <div className="hidden sm:block"><RegistrationJourney current={1} compact /></div>

                <div className="mt-1 sm:mt-5">
                  <p className="app-kicker">Passo 1 di 4 · Account</p>
                  <h2 className="mt-1 text-2xl font-semibold tracking-[-0.02em] text-[#1d2824]">
                    {claimRef ? "Crea l’account per la tua azienda" : "Crea account"}
                  </h2>
                  <p className="mt-1 text-sm leading-5 text-[#5d6a65]">
                    Riceverai un link via email. La richiesta aziendale si completa dopo la verifica.
                  </p>
                </div>

                {error ? (
                  <div
                    role="alert"
                    className="mt-6 rounded-xl border border-[#efc5bd] bg-[#fff5f3] px-4 py-3 text-sm text-[#9f2f24]"
                  >
                    {error}
                  </div>
                ) : null}

                {message ? (
                  <div className="mt-6 rounded-xl border border-[#b8d2c8] bg-[#edf5f2] px-4 py-3 text-sm leading-6 text-[#173f35]">
                    {message}
                  </div>
                ) : null}

                {returnTo ? <p role="status" className="mt-4 rounded-xl border border-[#b8d2c8] bg-[#edf5f2] px-4 py-3 text-sm text-[#173f35]">Il percorso verso la tua attività commerciale sarà conservato. I dati della distinta restano nel browser, non nell’email.</p> : null}
                <form action={signup} className="mt-4 space-y-3">
                  <input type="hidden" name="next" value={registrationPath} />
                  <label className="block text-sm font-semibold text-[#43524c]">
                    Email
                    <Input
                      className="mt-1.5 h-12"
                      name="email"
                      type="email"
                      autoComplete="email"
                      inputMode="email"
                      required
                    />
                  </label>

                  <label className="block text-sm font-semibold text-[#43524c]">
                    Password
                    <Input
                      className="mt-2 h-12"
                      name="password"
                      type="password"
                      autoComplete="new-password"
                      minLength={8}
                      required
                    />
                    <span className="mt-1 block text-xs leading-5 text-[#5d6a65]">
                      Almeno 8 caratteri. Usa una password personale e non riutilizzata.
                    </span>
                  </label>

                  <p className="text-xs leading-5 text-[#66736e]">
                    Leggi l’{" "}
                    <Link
                      href="/privacy"
                      target="_blank"
                      className="font-semibold text-[#173f35] underline underline-offset-4"
                    >
                      Informativa privacy
                    </Link>{" "}
                    e i{" "}
                    <Link
                      href="/terms"
                      target="_blank"
                      className="font-semibold text-[#173f35] underline underline-offset-4"
                    >
                      Termini d’uso
                    </Link>.
                    I consensi aziendali sono richiesti prima dell’invio della domanda.
                  </p>

                  <PendingSubmitButton
                    pendingLabel="Creazione account…"
                    className="app-primary h-12 w-full rounded-xl px-5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Crea account
                  </PendingSubmitButton>
                </form>

                <div className="mt-3 rounded-xl border border-[#e2e7e4] bg-[#f7f9f8] px-3 py-2 text-xs leading-5 text-[#5d6a65]">
                  L’azienda si attiva solo dopo la verifica email e l’approvazione della richiesta.
                </div>
              </section>
              <section
                id="company-check"
                className="min-w-0 scroll-mt-4 rounded-[24px] border border-[#dce2df] bg-white p-4 shadow-[0_14px_44px_rgba(18,61,52,0.05)] sm:p-6" data-testid="onboarding-ux2-company-check"
              >
                {claimRef ? (
                  <div className="rounded-2xl border border-[#b8d2c8] bg-[#edf5f2] p-5">
                    <div className="flex items-start gap-4">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#123d34] text-lg font-bold text-white">
                        ✓
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#1a5144]">
                          Profilo selezionato
                        </p>
                        <h2 className="mt-1 text-xl font-semibold text-[#1d2824]">
                          Claim collegato alla registrazione
                        </h2>
                        <p className="mt-2 text-sm leading-6 text-[#52615b]">
                          Hai già scelto un profilo claimable nella ricerca pubblica. Manteniamo il
                          riferimento durante creazione account e verifica email.
                        </p>
                        <Link
                          href="/register#company-check"
                          className="mt-3 inline-flex text-xs font-semibold text-[#173f35] underline decoration-[#9cc5b7] underline-offset-4"
                        >
                          Cambia azienda
                        </Link>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                  {initialCompanySearch ? (
                    <p className="mb-3 rounded-xl border border-[#cde1d5] bg-[#f0f7f3] px-4 py-3 text-xs leading-5 text-[#285b45]">
                      Hai aperto una scheda aziendale dal Network. Verifica ragione sociale e Partita IVA:
                      le aziende ancora da confermare non vengono rivendicate automaticamente.
                      Se non compare un profilo pubblicato, puoi proseguire con la registrazione.
                    </p>
                  ) : null}
                  <PublicCompanyLookup
                    context="registration"
                    returnTo={returnTo}
                    initialQuery={initialCompanySearch}
                    notFoundHref="#account"
                    notFoundLabel="Nessun risultato? Puoi creare l’account ↑"
                    showNetworkNote={false}
                  />
                  </>
                )}
              </section>


          </div>
        </div>
      </main>
    );
  }

  const { data: lifecycleData } = await supabase.rpc("lr5_account_lifecycle_state");
  const lifecycle = (lifecycleData ?? {}) as { access_suspended?: boolean };
  if (lifecycle.access_suspended === true) {
    await supabase.auth.signOut({ scope: "global" });
    redirect("/account-closure?requested=1");
  }

  const { data: memberships } = await supabase
    .from("organization_memberships")
    .select("organization_id,status")
    .eq("status", "active")
    .limit(1);

  if (memberships?.length) {
    redirect("/dashboard");
  }

  const { data: application } = await supabase
    .from("company_registration_applications")
    .select(
      "id,application_status,legal_name,trading_name,country_code,vat_id,registration_id,website_url,primary_company_type,secondary_company_types,contact_name,contact_phone,short_description,claim_target_network_company_id",
    )
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (application && !["draft", "needs_information"].includes(application.application_status)) {
    redirect(withCommercialReturnTo("/registration/status", returnTo));
  }

  let claimContext: ClaimRegistrationContext | null = null;
  let claimContextError: string | null = null;

  if (application?.claim_target_network_company_id) {
    const { data, error: contextError } = await supabase.rpc(
      "pa1_4_registration_claim_context",
      { p_application_id: application.id },
    );
    if (contextError) {
      claimContextError = "Non è stato possibile ripristinare il profilo selezionato per il claim.";
    } else {
      claimContext = (data ?? null) as ClaimRegistrationContext | null;
    }
  } else if (claimRef) {
    const { data, error: contextError } = await supabase.rpc(
      "pa1_4_company_claim_context",
      { p_claim_ref: claimRef },
    );
    if (contextError) {
      claimContextError = "Non è stato possibile verificare il profilo selezionato.";
    } else {
      claimContext = (data ?? null) as ClaimRegistrationContext | null;
    }
  }

  const activeClaim =
    claimContext?.ok === true &&
    claimContext.code === "ok" &&
    claimContext.claim_ref &&
    claimContext.legal_name &&
    claimContext.country_code
      ? {
          claim_ref: claimContext.claim_ref,
          legal_name: claimContext.legal_name,
          trading_name: claimContext.trading_name ?? null,
          country_code: claimContext.country_code,
          vat_hint: claimContext.vat_hint ?? null,
        }
      : null;

  const claimBlocked =
    Boolean(claimRef || application?.claim_target_network_company_id) &&
    (!activeClaim ||
      claimContext?.claim_state !== "claimable" ||
      claimContext?.can_start_registration !== true);

  const formInitial = activeClaim
    ? {
        ...application,
        legal_name: activeClaim.legal_name,
        trading_name: application?.trading_name || activeClaim.trading_name,
        country_code: activeClaim.country_code,
      }
    : application;

  return (
    <main className="min-h-screen bg-[#f2f4f3] px-4 py-6 sm:px-6 sm:py-9">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <ProductBrand href="/" showDescriptor={false} />
          <form action={logoutRegistration}>
            <button
              type="submit"
              className="app-secondary inline-flex min-h-10 items-center justify-center rounded-xl px-4 text-sm font-semibold"
            >
              Esci
            </button>
          </form>
        </div>

        <div className="mt-6 rounded-[28px] border border-[#dce2df] bg-white p-5 shadow-[0_14px_44px_rgba(18,61,52,0.06)] sm:p-8 lg:p-10">
          <RegistrationJourney current={2} />

          <div className="mt-8 flex flex-col gap-4 border-b border-[#e7ece9] pb-7 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="app-kicker">Step 2 · Azienda</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-[-0.02em] text-[#1d2824] sm:text-4xl">
                {application?.application_status === "needs_information"
                  ? "Aggiorna la richiesta aziendale"
                  : "Raccontaci chi siete"}
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-[#5d6a65]">
                Chiediamo solo i dati necessari per identificare l’azienda e capire come opera nel
                mercato. Se non hai ancora verificato se esiste già nei nostri dati, puoi farlo
                subito prima di compilare una nuova scheda.
              </p>
            </div>

            <div className="rounded-xl border border-[#dce2df] bg-[#f8faf9] px-4 py-3 text-xs text-[#66736e]">
              Account verificato
              <span className="mt-1 block font-semibold text-[#1d2824]">{user.email}</span>
            </div>
          </div>

          {error ? (
            <div
              role="alert"
              className="mt-6 rounded-xl border border-[#efc5bd] bg-[#fff5f3] px-4 py-3 text-sm text-[#9f2f24]"
            >
              {error}
            </div>
          ) : null}

          {application?.application_status === "needs_information" ? (
            <div className="mt-6 rounded-xl border border-[#ead7aa] bg-[#fff9e8] px-4 py-3 text-sm leading-6 text-[#77551c]">
              La revisione richiede un aggiornamento. Modifica i dati necessari e invia nuovamente
              la richiesta.
            </div>
          ) : null}

          {claimContextError ? (
            <div className="mt-6 rounded-xl border border-[#efc5bd] bg-[#fff5f3] px-4 py-3 text-sm text-[#9f2f24]">
              {claimContextError}
            </div>
          ) : null}

          {!application && !claimRef && !activeClaim ? (
            <div className="mt-6">
              {initialCompanySearch ? (
                <p className="mb-3 rounded-xl border border-[#cde1d5] bg-[#f0f7f3] px-4 py-3 text-xs leading-5 text-[#285b45]">
                  Hai aperto una scheda aziendale dal Network. Verifica ragione sociale e Partita IVA:
                  le aziende ancora da confermare non vengono rivendicate automaticamente.
                  Se non compare un profilo pubblicato, puoi proseguire con la registrazione.
                </p>
                  ) : null}
              <PublicCompanyLookup
                context="registration"
                    returnTo={returnTo}
                initialQuery={initialCompanySearch}
                notFoundHref="#company-form"
                notFoundLabel="Non è presente: compila una nuova azienda ↓"
                showNetworkNote={false}
              />
            </div>
          ) : null}

          <div id="company-form" className="scroll-mt-6">
          {claimBlocked ? (
            <div className="mt-8 rounded-2xl border border-[#ead7aa] bg-[#fff9e8] p-5">
              <p className="text-sm font-semibold text-[#77551c]">
                Il profilo selezionato non è più disponibile per questo claim.
              </p>
              <p className="mt-2 text-sm leading-6 text-[#77551c]">
                Lo stato dell’azienda è cambiato oppure il riferimento non è più valido. Non
                creiamo una registrazione parallela: torna alla ricerca pubblica e verifica lo
                stato aggiornato.
              </p>
              <Link
                href="/#aziende"
                className="app-secondary mt-4 inline-flex h-10 items-center justify-center rounded-xl px-4 text-sm font-semibold"
              >
                Torna alla ricerca azienda
              </Link>
            </div>
          ) : (
            <CompanyRegistrationForm initial={formInitial} claim={activeClaim} returnTo={returnTo} />
          )}
          </div>
        </div>
      </div>
    </main>
  );
}
