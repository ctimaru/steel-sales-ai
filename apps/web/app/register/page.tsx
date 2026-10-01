import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { signup } from "@/app/login/actions";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { ProductBrand } from "@/components/product-brand";
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

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const { error, message } = await searchParams;
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  const user = authData.user;

  if (!user) {
    return (
      <main className="min-h-screen bg-[#f2f4f3] px-4 py-6 sm:px-6 sm:py-10">
        <div className="mx-auto max-w-6xl">
          <div className="mb-6 flex items-center justify-between gap-4">
            <ProductBrand href="/" />
            <Link
              href="/login"
              className="text-sm font-semibold text-[#52615b] hover:text-[#173f35]"
            >
              Hai già un account? Accedi
            </Link>
          </div>

          <div className="grid overflow-hidden rounded-[28px] border border-[#dce2df] bg-white shadow-[0_16px_48px_rgba(18,61,52,0.08)] lg:grid-cols-[1.02fr_0.98fr]">
            <section className="bg-[#123d34] p-7 text-white sm:p-10 lg:p-12">
              <span className="inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-[#d9e8e2]">
                Accesso aziendale
              </span>
              <h1 className="mt-6 max-w-xl text-4xl font-semibold leading-tight tracking-[-0.03em] sm:text-5xl">
                Porta la tua azienda dentro Smart Steel Sales.
              </h1>
              <p className="mt-5 max-w-xl text-base leading-7 text-[#c6d8d1]">
                Crea il tuo account, inserisci i dati essenziali dell’azienda e invia la richiesta.
                Il workspace viene attivato solo dopo revisione.
              </p>

              <div className="mt-9 rounded-2xl border border-white/10 bg-white/[0.06] p-5">
                <p className="text-sm font-semibold text-white">Cosa ti serve adesso</p>
                <ul className="mt-3 space-y-2 text-sm leading-6 text-[#c6d8d1]">
                  <li>• Un indirizzo email che controlli</li>
                  <li>• Ragione sociale e paese</li>
                  <li>• Il ruolo principale dell’azienda nel mercato</li>
                </ul>
              </div>

              <div className="mt-9 border-t border-white/10 pt-7">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#9fb9b0]">
                  I tuoi dati commerciali restano privati
                </p>
                <p className="mt-3 text-sm leading-6 text-[#c6d8d1]">
                  Email, offerte, prezzi, ordini e documenti non diventano dati pubblici del Network.
                </p>
              </div>
            </section>

            <section className="p-6 sm:p-9 lg:p-11">
              <RegistrationJourney current={1} compact />

              <div className="mt-8">
                <p className="app-kicker">Step 1 · Account</p>
                <h2 className="mt-2 text-3xl font-semibold tracking-[-0.02em] text-[#1d2824]">
                  Crea il tuo accesso
                </h2>
                <p className="mt-3 text-sm leading-6 text-[#66736e]">
                  Ti invieremo un link di verifica. Dopo la conferma potrai completare la richiesta
                  aziendale.
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

              <form action={signup} className="mt-7 space-y-5">
                <label className="block text-sm font-medium text-[#43524c]">
                  Email
                  <Input
                    className="mt-2 h-11"
                    name="email"
                    type="email"
                    autoComplete="email"
                    inputMode="email"
                    required
                  />
                </label>

                <label className="block text-sm font-medium text-[#43524c]">
                  Password
                  <Input
                    className="mt-2 h-11"
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    required
                  />
                  <span className="mt-1.5 block text-xs text-[#7b8782]">
                    Almeno 8 caratteri. Usa una password personale e non riutilizzata.
                  </span>
                </label>

                <PendingSubmitButton
                  pendingLabel="Creazione account…"
                  className="app-primary h-11 w-full rounded-xl px-5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Crea account e continua
                </PendingSubmitButton>
              </form>

              <p className="mt-6 text-center text-sm text-[#66736e]">
                Hai già un account?{" "}
                <Link
                  href="/login"
                  className="font-semibold text-[#173f35] underline decoration-[#b8d2c8] underline-offset-4"
                >
                  Accedi
                </Link>
              </p>
            </section>
          </div>
        </div>
      </main>
    );
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
      "id,application_status,legal_name,trading_name,country_code,vat_id,registration_id,website_url,primary_company_type,secondary_company_types,contact_name,contact_phone,short_description",
    )
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (application && !["draft", "needs_information"].includes(application.application_status)) {
    redirect("/registration/status");
  }

  return (
    <main className="min-h-screen bg-[#f2f4f3] px-4 py-6 sm:px-6 sm:py-9">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <ProductBrand href="/" />
          <form action={logoutRegistration}>
            <button
              type="submit"
              className="text-sm font-semibold text-[#66736e] hover:text-[#173f35]"
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
              <p className="mt-3 max-w-2xl text-sm leading-6 text-[#66736e]">
                Chiediamo solo i dati necessari per identificare l’azienda e capire come opera nel
                mercato. Il profilo potrà essere arricchito dopo l’attivazione.
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

          <CompanyRegistrationForm initial={application} />
        </div>
      </div>
    </main>
  );
}
