import Link from "next/link";
import { notFound } from "next/navigation";

import { getRegistrationDetail, requirePlatformSuperadmin } from "@/lib/platform-admin";

import {
  activateRegistrationApplication,
  approveRegistrationApplication,
  rejectRegistrationApplication,
  requestRegistrationInformation,
} from "../actions";

const TYPE_LABELS: Record<string, string> = {
  producer: "Produttore",
  trader_distributor: "Commerciante / distributore",
  processor_service_provider: "Terzista / service provider",
  end_user: "Utilizzatore",
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Bozza",
  pending_review: "Da revisionare",
  needs_information: "In attesa dati",
  approved: "Approvata",
  rejected: "Rifiutata",
  activated: "Attivata",
  suspended: "Sospesa",
};

const EVENT_LABELS: Record<string, string> = {
  application_created: "Application creata",
  application_submitted: "Application inviata",
  email_verified: "Email verificata",
  information_requested: "Informazioni richieste",
  application_approved: "Application approvata",
  application_rejected: "Application rifiutata",
  activation_started: "Activation avviata",
  organization_created: "Organization creata",
  activation_completed: "Activation completata",
};

function display(value: string | null | undefined) {
  return value?.trim() ? value : "—";
}

export default async function AdminRegistrationDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  await requirePlatformSuperadmin();
  const { id } = await params;
  const { error, message } = await searchParams;
  const detail = await getRegistrationDetail(id);

  if (!detail) notFound();

  const { application, events } = detail;
  const canReview = application.application_status === "pending_review";
  const canActivate = application.application_status === "approved";

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <Link href="/admin/registrations" className="text-sm font-semibold text-slate-500 hover:text-slate-950">
          ← Torna alle registrazioni
        </Link>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : null}
      {message ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</div>
      ) : null}

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-slate-950 px-3 py-1 text-xs font-semibold text-white">
                {STATUS_LABELS[application.application_status] ?? application.application_status}
              </span>
              <span className="text-xs text-slate-400">{application.country_code}</span>
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">{application.legal_name}</h1>
            <p className="mt-2 text-sm text-slate-500">
              {TYPE_LABELS[application.primary_company_type] ?? application.primary_company_type}
            </p>
          </div>

          {application.activated_organization_id ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
              <p className="font-semibold">Workspace attivato</p>
              <p className="mt-1 break-all text-xs">{application.activated_organization_id}</p>
            </div>
          ) : null}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
        <div className="space-y-6">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
            <h2 className="text-base font-semibold text-slate-950">Dati azienda</h2>
            <dl className="mt-5 grid gap-x-6 gap-y-5 sm:grid-cols-2">
              {[
                ["Ragione sociale", application.legal_name],
                ["Nome commerciale", application.trading_name],
                ["Paese", application.country_code],
                ["Partita IVA", application.vat_id],
                ["Registro impresa", application.registration_id],
                ["Sito web", application.website_url],
                ["Referente", application.contact_name],
                ["Telefono", application.contact_phone],
                ["Email applicant", application.applicant_email_snapshot],
                ["Email verificata", application.email_verified_at ? "Sì" : "No"],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">{label}</dt>
                  <dd className="mt-1 break-words text-sm font-medium text-slate-800">{display(value)}</dd>
                </div>
              ))}
            </dl>

            {application.secondary_company_types?.length ? (
              <div className="mt-6">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Attività secondarie</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {application.secondary_company_types.map((type) => (
                    <span key={type} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                      {TYPE_LABELS[type] ?? type}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            {application.short_description ? (
              <div className="mt-6">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Descrizione</p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">{application.short_description}</p>
              </div>
            ) : null}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
            <h2 className="text-base font-semibold text-slate-950">Timeline audit</h2>
            <div className="mt-5 space-y-4">
              {events.map((event) => (
                <div key={event.id} className="relative border-l-2 border-slate-200 pl-5">
                  <div className="absolute -left-[5px] top-1 h-2 w-2 rounded-full bg-slate-500" />
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm font-semibold text-slate-900">
                      {EVENT_LABELS[event.event_type] ?? event.event_type}
                    </p>
                    <p className="text-xs text-slate-400">
                      {new Intl.DateTimeFormat("it-IT", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      }).format(new Date(event.occurred_at))}
                    </p>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {event.actor_type}
                    {event.from_status || event.to_status
                      ? ` · ${event.from_status ?? "—"} → ${event.to_status ?? "—"}`
                      : ""}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </div>

        <aside className="space-y-4">
          {canReview ? (
            <>
              <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
                <h2 className="font-semibold text-amber-950">Richiedi integrazione</h2>
                <p className="mt-1 text-sm leading-6 text-amber-800">
                  Rimanda la richiesta all’azienda per una correzione mirata.
                </p>
                <form action={requestRegistrationInformation} className="mt-4 space-y-3">
                  <input type="hidden" name="application_id" value={application.id} />
                  <textarea
                    name="note"
                    maxLength={1000}
                    rows={4}
                    required
                    placeholder="Indica cosa deve essere chiarito o completato."
                    className="w-full rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none"
                  />
                  <button className="h-10 w-full rounded-xl bg-amber-900 px-4 text-sm font-semibold text-white">
                    Richiedi informazioni
                  </button>
                </form>
              </section>

              <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
                <h2 className="font-semibold text-emerald-950">Approva</h2>
                <p className="mt-1 text-sm leading-6 text-emerald-800">
                  Autorizza la registrazione. L’attivazione del workspace resta un passaggio separato.
                </p>
                <form action={approveRegistrationApplication} className="mt-4">
                  <input type="hidden" name="application_id" value={application.id} />
                  <button className="h-10 w-full rounded-xl bg-emerald-700 px-4 text-sm font-semibold text-white">
                    Approva richiesta
                  </button>
                </form>
              </section>

              <section className="rounded-2xl border border-red-200 bg-red-50 p-5">
                <h2 className="font-semibold text-red-950">Rifiuta</h2>
                <form action={rejectRegistrationApplication} className="mt-4 space-y-3">
                  <input type="hidden" name="application_id" value={application.id} />
                  <select
                    name="reason_code"
                    required
                    className="h-10 w-full rounded-xl border border-red-200 bg-white px-3 text-sm text-slate-900"
                    defaultValue=""
                  >
                    <option value="" disabled>Seleziona motivo</option>
                    <option value="duplicate_application">Application duplicata</option>
                    <option value="unverifiable_identity">Identità non verificabile</option>
                    <option value="incomplete_information">Informazioni incomplete</option>
                    <option value="unsupported_business">Business non supportato</option>
                    <option value="abuse_or_spam">Abuso / spam</option>
                    <option value="other">Altro</option>
                  </select>
                  <textarea
                    name="note"
                    maxLength={1000}
                    rows={3}
                    placeholder="Nota interna opzionale"
                    className="w-full rounded-xl border border-red-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none"
                  />
                  <button className="h-10 w-full rounded-xl bg-red-700 px-4 text-sm font-semibold text-white">
                    Rifiuta richiesta
                  </button>
                </form>
              </section>
            </>
          ) : null}

          {canActivate ? (
            <section className="rounded-2xl border border-indigo-200 bg-indigo-50 p-5">
              <h2 className="font-semibold text-indigo-950">Attiva workspace</h2>
              <p className="mt-1 text-sm leading-6 text-indigo-800">
                Crea l’organization e assegna l’applicant come Organization Admin. Il link Network resterà pending fino a M2/M4.
              </p>
              <form action={activateRegistrationApplication} className="mt-4">
                <input type="hidden" name="application_id" value={application.id} />
                <button className="h-10 w-full rounded-xl bg-indigo-700 px-4 text-sm font-semibold text-white">
                  Attiva workspace
                </button>
              </form>
            </section>
          ) : null}

          {!canReview && !canActivate ? (
            <section className="rounded-2xl border border-slate-200 bg-white p-5">
              <h2 className="font-semibold text-slate-950">Nessuna azione disponibile</h2>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                Lo stato attuale non prevede decisioni manuali in questo pannello.
              </p>
            </section>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
