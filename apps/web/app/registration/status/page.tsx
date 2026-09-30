import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { ProductBrand } from "@/components/product-brand";
import { RegistrationJourney } from "@/components/registration-journey";
import {
  isRegistrationApplicationStatus,
  type RegistrationApplicationStatus,
} from "@/lib/registration-state";
import { privateNoIndexRobots } from "@/lib/seo";
import { createClient } from "@/lib/supabase/server";

import { logoutRegistration } from "@/app/register/actions";

export const metadata: Metadata = {
  title: "Stato registrazione",
  robots: privateNoIndexRobots,
};

const STATUS_COPY: Record<
  RegistrationApplicationStatus,
  { title: string; body: string; tone: string; label: string; journeyStep: 1 | 2 | 3 | 4 }
> = {
  draft: {
    title: "La richiesta è ancora in bozza",
    body: "Completa i dati aziendali e invia la richiesta quando sei pronto.",
    tone: "border-[#dce2df] bg-[#f8faf9] text-[#43524c]",
    label: "Bozza",
    journeyStep: 2,
  },
  pending_review: {
    title: "La richiesta è in revisione",
    body: "Stiamo controllando i dati dell’azienda e l’identità corretta nel Network. Non devi fare nulla in questo momento.",
    tone: "border-[#b8d2c8] bg-[#edf5f2] text-[#173f35]",
    label: "In revisione",
    journeyStep: 3,
  },
  needs_information: {
    title: "Serve un aggiornamento",
    body: "La revisione richiede alcune informazioni aggiuntive. Aggiorna la richiesta e inviala nuovamente.",
    tone: "border-[#ead7aa] bg-[#fff9e8] text-[#77551c]",
    label: "Da integrare",
    journeyStep: 2,
  },
  approved: {
    title: "Registrazione approvata",
    body: "La revisione è completata. Stiamo finalizzando l’attivazione del workspace e il collegamento al profilo aziendale.",
    tone: "border-[#b8d2c8] bg-[#edf5f2] text-[#173f35]",
    label: "Approvata",
    journeyStep: 4,
  },
  rejected: {
    title: "Richiesta non approvata",
    body: "La richiesta non può essere attivata nello stato attuale. In una prossima iterazione renderemo disponibile qui anche il dettaglio della motivazione e il percorso di recupero.",
    tone: "border-[#efc5bd] bg-[#fff5f3] text-[#9f2f24]",
    label: "Non approvata",
    journeyStep: 3,
  },
  activated: {
    title: "Workspace attivato",
    body: "La tua azienda è attiva. Puoi completare la configurazione iniziale e iniziare a usare il workspace.",
    tone: "border-[#b8d2c8] bg-[#edf5f2] text-[#173f35]",
    label: "Attivata",
    journeyStep: 4,
  },
};

export default async function RegistrationStatusPage({
  searchParams,
}: {
  searchParams: Promise<{ submitted?: string }>;
}) {
  const { submitted } = await searchParams;
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();

  if (!authData.user) {
    redirect("/login");
  }

  const { data: application } = await supabase
    .from("company_registration_applications")
    .select(
      "id,legal_name,primary_company_type,application_status,submitted_at,reviewed_at,rejection_reason_code,activated_organization_id,updated_at",
    )
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!application) {
    redirect("/register");
  }

  const copy = isRegistrationApplicationStatus(application.application_status)
    ? STATUS_COPY[application.application_status]
    : {
        title: "Registrazione in elaborazione",
        body: "La richiesta è stata registrata. Aggiorneremo questa pagina quando cambia lo stato.",
        tone: "border-[#dce2df] bg-[#f8faf9] text-[#43524c]",
        label: "In elaborazione",
        journeyStep: 3 as const,
      };

  return (
    <main className="min-h-screen bg-[#f2f4f3] px-4 py-6 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-4xl">
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
          <RegistrationJourney current={copy.journeyStep} />

          <div className="mt-8">
            <p className="app-kicker">Registrazione aziendale</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.02em] text-[#1d2824] sm:text-4xl">
              {application.legal_name}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[#66736e]">
              Qui trovi lo stato aggiornato della richiesta. Quando sarà necessario un tuo
              intervento, troverai una CTA chiara in questa pagina.
            </p>
          </div>

          {submitted === "1" ? (
            <div className="mt-6 rounded-xl border border-[#b8d2c8] bg-[#edf5f2] px-4 py-3 text-sm font-medium text-[#173f35]">
              Richiesta inviata correttamente. Puoi uscire: lo stato resterà disponibile al
              prossimo accesso.
            </div>
          ) : null}

          <section className={`mt-6 rounded-2xl border p-5 ${copy.tone}`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.12em] opacity-70">
                  Stato attuale
                </p>
                <h2 className="mt-2 text-lg font-semibold">{copy.title}</h2>
              </div>
              <span className="rounded-full border border-current/15 bg-white/60 px-3 py-1 text-xs font-semibold">
                {copy.label}
              </span>
            </div>
            <p className="mt-3 max-w-2xl text-sm leading-6">{copy.body}</p>
          </section>

          <dl className="mt-6 overflow-hidden rounded-2xl border border-[#dce2df] bg-white">
            <div className="grid gap-1 border-b border-[#eef1ef] px-4 py-3 sm:grid-cols-[170px_1fr] sm:gap-4">
              <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-[#7b8782]">
                Azienda
              </dt>
              <dd className="text-sm font-medium text-[#1d2824]">{application.legal_name}</dd>
            </div>
            <div className="grid gap-1 border-b border-[#eef1ef] px-4 py-3 sm:grid-cols-[170px_1fr] sm:gap-4">
              <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-[#7b8782]">
                Stato
              </dt>
              <dd className="text-sm font-medium text-[#1d2824]">{copy.label}</dd>
            </div>
            <div className="grid gap-1 px-4 py-3 sm:grid-cols-[170px_1fr] sm:gap-4">
              <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-[#7b8782]">
                Ultimo aggiornamento
              </dt>
              <dd className="text-sm font-medium text-[#1d2824]">
                {new Intl.DateTimeFormat("it-IT", {
                  dateStyle: "medium",
                  timeStyle: "short",
                }).format(new Date(application.updated_at))}
              </dd>
            </div>
          </dl>

          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            {application.application_status === "needs_information" ||
            application.application_status === "draft" ? (
              <Link
                href="/register"
                className="app-primary inline-flex h-11 items-center justify-center rounded-xl px-5 text-sm font-semibold"
              >
                Aggiorna la richiesta
              </Link>
            ) : null}

            {application.application_status === "activated" ? (
              <Link
                href="/onboarding"
                className="app-primary inline-flex h-11 items-center justify-center rounded-xl px-5 text-sm font-semibold"
              >
                Continua la configurazione
              </Link>
            ) : null}

            <Link
              href="/"
              className="app-secondary inline-flex h-11 items-center justify-center rounded-xl px-5 text-sm font-semibold"
            >
              Torna al sito
            </Link>
          </div>

          <p className="mt-6 text-xs leading-5 text-[#8b9792]">
            L’approvazione della registrazione consente l’accesso al prodotto; non rappresenta una
            certificazione o una valutazione commerciale dell’azienda.
          </p>
        </div>
      </div>
    </main>
  );
}
