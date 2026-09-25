import Link from "next/link";

import { getRegistrationQueue, requirePlatformSuperadmin } from "@/lib/platform-admin";

const FILTERS = [
  ["all", "Tutte"],
  ["pending_review", "Da revisionare"],
  ["needs_information", "In attesa dati"],
  ["approved", "Approvate"],
  ["activated", "Attivate"],
  ["rejected", "Rifiutate"],
] as const;

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

export default async function AdminRegistrationsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; error?: string }>;
}) {
  await requirePlatformSuperadmin();
  const { status, error } = await searchParams;
  const activeStatus = status && status !== "all" ? status : null;
  const queue = await getRegistrationQueue(activeStatus);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-indigo-600">Platform control plane</p>
        <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-950">Registrazioni aziende</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              Revisiona le richieste aziendali, richiedi integrazioni, approva o rifiuta e attiva il workspace dopo l’approvazione.
            </p>
          </div>
          <div className="rounded-2xl bg-slate-950 px-4 py-3 text-white">
            <p className="text-xs text-slate-400">Richieste visualizzate</p>
            <p className="mt-1 text-2xl font-semibold">{queue.count}</p>
          </div>
        </div>
      </section>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : null}

      <nav className="flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map(([value, label]) => {
          const selected = (activeStatus ?? "all") === value;
          return (
            <Link
              key={value}
              href={value === "all" ? "/admin/registrations" : `/admin/registrations?status=${value}`}
              className={[
                "shrink-0 rounded-full px-4 py-2 text-xs font-semibold",
                selected ? "bg-slate-950 text-white" : "border border-slate-200 bg-white text-slate-600",
              ].join(" ")}
            >
              {label}
            </Link>
          );
        })}
      </nav>

      <section className="space-y-3">
        {queue.applications.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
            <p className="font-semibold text-slate-900">Nessuna richiesta in questa vista</p>
            <p className="mt-2 text-sm text-slate-500">Le nuove application compariranno automaticamente qui.</p>
          </div>
        ) : (
          queue.applications.map((application) => (
            <Link
              key={application.id}
              href={`/admin/registrations/${application.id}`}
              className="block rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-slate-400 hover:shadow-sm"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-700">
                      {STATUS_LABELS[application.application_status] ?? application.application_status}
                    </span>
                    <span className="text-xs text-slate-400">{application.country_code}</span>
                  </div>
                  <h2 className="mt-3 text-lg font-semibold text-slate-950">{application.legal_name}</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {TYPE_LABELS[application.primary_company_type] ?? application.primary_company_type} · {application.applicant_email}
                  </p>
                  {application.vat_id ? (
                    <p className="mt-1 text-xs text-slate-400">VAT / P.IVA: {application.vat_id}</p>
                  ) : null}
                </div>
                <div className="text-left sm:text-right">
                  <p className="text-xs text-slate-400">Aggiornata</p>
                  <p className="mt-1 text-sm font-medium text-slate-700">
                    {new Intl.DateTimeFormat("it-IT", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    }).format(new Date(application.updated_at))}
                  </p>
                  <p className="mt-3 text-xs font-semibold text-indigo-600">Apri dettaglio →</p>
                </div>
              </div>
            </Link>
          ))
        )}
      </section>
    </div>
  );
}
