import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Stato registrazione",
};

const STATUS_COPY: Record<string, { title: string; body: string; tone: string }> = {
  draft: {
    title: "Bozza non inviata",
    body: "Completa i dati aziendali e invia la richiesta.",
    tone: "border-slate-200 bg-slate-50 text-slate-800",
  },
  pending_review: {
    title: "Richiesta in revisione",
    body: "La richiesta è stata ricevuta. Il Platform Superadmin la esaminerà prima dell’attivazione del workspace.",
    tone: "border-blue-200 bg-blue-50 text-blue-900",
  },
  needs_information: {
    title: "Servono altre informazioni",
    body: "Aggiorna i dati richiesti e invia nuovamente la registrazione.",
    tone: "border-amber-200 bg-amber-50 text-amber-900",
  },
  approved: {
    title: "Richiesta approvata",
    body: "La registrazione è approvata. L’attivazione del workspace aziendale è il passaggio successivo.",
    tone: "border-emerald-200 bg-emerald-50 text-emerald-900",
  },
  rejected: {
    title: "Richiesta non approvata",
    body: "La richiesta non è stata approvata. Se ritieni che manchino informazioni utili, contatta il supporto della piattaforma.",
    tone: "border-red-200 bg-red-50 text-red-900",
  },
  activated: {
    title: "Workspace attivato",
    body: "La tua azienda è stata attivata. Puoi continuare con la configurazione del workspace.",
    tone: "border-emerald-200 bg-emerald-50 text-emerald-900",
  },
  suspended: {
    title: "Registrazione sospesa",
    body: "L’accesso aziendale è temporaneamente sospeso.",
    tone: "border-slate-300 bg-slate-100 text-slate-800",
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

  const copy = STATUS_COPY[application.application_status] ?? {
    title: "Registrazione aziendale",
    body: "La richiesta è in elaborazione.",
    tone: "border-slate-200 bg-slate-50 text-slate-800",
  };

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto max-w-2xl">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-9">
          <p className="text-xs font-bold tracking-[0.16em] text-slate-400">STEEL SALES AI</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">Stato registrazione</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Qui puoi controllare lo stato della richiesta per <span className="font-semibold text-slate-800">{application.legal_name}</span>.
          </p>

          {submitted === "1" ? (
            <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
              Richiesta inviata correttamente.
            </div>
          ) : null}

          <div className={`mt-6 rounded-2xl border p-5 ${copy.tone}`}>
            <p className="text-sm font-semibold">{copy.title}</p>
            <p className="mt-2 text-sm leading-6">{copy.body}</p>
          </div>

          <dl className="mt-8 divide-y divide-slate-100 rounded-2xl border border-slate-200">
            <div className="grid grid-cols-[130px_1fr] gap-4 px-4 py-3 text-sm">
              <dt className="text-slate-500">Azienda</dt>
              <dd className="font-medium text-slate-900">{application.legal_name}</dd>
            </div>
            <div className="grid grid-cols-[130px_1fr] gap-4 px-4 py-3 text-sm">
              <dt className="text-slate-500">Stato</dt>
              <dd className="font-medium text-slate-900">{application.application_status}</dd>
            </div>
            <div className="grid grid-cols-[130px_1fr] gap-4 px-4 py-3 text-sm">
              <dt className="text-slate-500">Aggiornato</dt>
              <dd className="font-medium text-slate-900">
                {new Intl.DateTimeFormat("it-IT", {
                  dateStyle: "medium",
                  timeStyle: "short",
                }).format(new Date(application.updated_at))}
              </dd>
            </div>
          </dl>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            {application.application_status === "needs_information" || application.application_status === "draft" ? (
              <Link
                href="/register"
                className="inline-flex h-11 items-center justify-center rounded-xl bg-slate-950 px-5 text-sm font-semibold text-white"
              >
                Completa la richiesta
              </Link>
            ) : null}

            {application.application_status === "activated" ? (
              <Link
                href="/onboarding"
                className="inline-flex h-11 items-center justify-center rounded-xl bg-slate-950 px-5 text-sm font-semibold text-white"
              >
                Configura il workspace
              </Link>
            ) : null}

            <Link
              href="/login"
              className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-300 px-5 text-sm font-semibold text-slate-700"
            >
              Torna al login
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
