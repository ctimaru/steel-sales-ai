import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Input } from "@/components/ui/input";
import { ProductBrand } from "@/components/product-brand";
import { createClient } from "@/lib/supabase/server";
import { signup } from "@/app/login/actions";

import { CompanyRegistrationForm } from "./registration-form";

export const metadata: Metadata = {
  title: "Registra la tua azienda",
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
      <main className="min-h-screen bg-[#f3f5f7] px-5 py-8 sm:px-8 sm:py-12">
        <div className="mx-auto grid max-w-5xl overflow-hidden rounded-3xl border border-[#d9e0e4] bg-white shadow-sm lg:grid-cols-[0.9fr_1.1fr]">
          <section className="bg-[#0b171e] p-8 text-white sm:p-10">
            <ProductBrand href="/" inverse />
            <h1 className="mt-10 text-3xl font-semibold tracking-tight sm:text-4xl">
              Registra la tua azienda.
            </h1>
            <p className="mt-4 text-sm leading-7 text-[#8fa1a9]">
              Crea prima il tuo account personale. Dopo la verifica email potrai completare il profilo aziendale e inviarlo per approvazione.
            </p>
            <div className="mt-10 space-y-4 text-sm text-[#b6c3c8]">
              <p>1. Crea e verifica il tuo account</p>
              <p>2. Compila i dati dell’azienda</p>
              <p>3. Invia la richiesta</p>
              <p>4. Dopo l’approvazione viene attivato il workspace</p>
            </div>
          </section>

          <section className="p-7 sm:p-10">
            <p className="text-sm font-semibold text-[#66737d]">Passaggio 1 di 2</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[#17232d]">Crea il tuo account</h2>
            <p className="mt-2 text-sm leading-6 text-[#66737d]">
              Usa un indirizzo email aziendale a cui hai accesso.
            </p>

            {error ? (
              <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
            ) : null}
            {message ? (
              <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</div>
            ) : null}

            <form action={signup} className="mt-7 space-y-5">
              <label className="block text-sm font-medium text-[#33454e]">
                Email
                <Input className="mt-2 h-11" name="email" type="email" autoComplete="email" required />
              </label>
              <label className="block text-sm font-medium text-[#33454e]">
                Password
                <Input
                  className="mt-2 h-11"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
              </label>
              <button className="h-11 w-full rounded-xl bg-[#1b4c5d] text-sm font-semibold text-white hover:bg-[#153542]">
                Crea account
              </button>
            </form>

            <p className="mt-6 text-sm text-[#66737d]">
              Hai già un account?{" "}
              <Link href="/login" className="font-semibold text-[#22313a] underline underline-offset-4">
                Accedi
              </Link>
            </p>
          </section>
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
    <main className="min-h-screen bg-[#f3f5f7] px-4 py-7 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-3xl rounded-3xl border border-[#d9e0e4] bg-white p-6 shadow-sm sm:p-9">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <ProductBrand href="/" compact />
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[#17232d]">
              {application?.application_status === "needs_information"
                ? "Completa le informazioni richieste"
                : "Profilo aziendale"}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#66737d]">
              Inserisci i dati essenziali della tua azienda. Potrai arricchire il profilo Network dopo l’attivazione.
            </p>
          </div>
          <Link href="/login" className="text-sm font-semibold text-[#66737d] hover:text-[#17232d]">
            Esci
          </Link>
        </div>

        {error ? (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        ) : null}

        {application?.application_status === "needs_information" ? (
          <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
            La richiesta richiede informazioni aggiuntive. Aggiorna i dati e inviala nuovamente.
          </div>
        ) : null}

        <CompanyRegistrationForm initial={application} />
      </div>
    </main>
  );
}
