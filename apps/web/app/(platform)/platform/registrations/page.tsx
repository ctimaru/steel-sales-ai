import Link from "next/link";

import { getRegistrationQueue, requirePlatformPermission } from "@/lib/platform-admin";

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

function statusClass(status: string) {
  if (status === "approved" || status === "activated") {
    return "border border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (status === "rejected") {
    return "border border-rose-200 bg-rose-50 text-rose-700";
  }
  if (status === "needs_information") {
    return "border border-amber-200 bg-amber-50 text-amber-800";
  }
  return "border border-[#d9e8e2] bg-[#e1ece8] text-[#1a5144]";
}

export default async function AdminRegistrationsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; error?: string }>;
}) {
  await requirePlatformPermission("registrations.read");
  const { status, error } = await searchParams;
  const activeStatus = status && status !== "all" ? status : null;
  const queue = await getRegistrationQueue(activeStatus);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <section className="platform-surface rounded-3xl p-6 sm:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="platform-kicker">Platform control plane</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#18263d] sm:text-4xl">
              Registrazioni aziende
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#66736e]">
              Revisiona le richieste aziendali, richiedi integrazioni, approva o rifiuta e attiva il workspace dopo l&apos;approvazione.
            </p>
          </div>

          <div className="min-w-[180px] rounded-2xl border border-[#d9e1dd] bg-[#f1f6ff] px-5 py-4">
            <div className="flex items-center justify-between gap-5">
              <div>
                <p className="text-xs font-semibold text-[#71819a]">Richieste visualizzate</p>
                <p className="metric-number mt-1 text-3xl font-semibold text-[#173468]">{queue.count}</p>
              </div>
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-[#4d8cf1] shadow-sm" aria-hidden="true">
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M5 20V8l7-4 7 4v12M8 20v-5h8v5M8 10h.01M12 10h.01M16 10h.01" />
                </svg>
              </span>
            </div>
          </div>
        </div>
      </section>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
          {error}
        </div>
      ) : null}

      <nav className="flex gap-2 overflow-x-auto pb-1" aria-label="Filtri registrazioni">
        {FILTERS.map(([value, label]) => {
          const selected = (activeStatus ?? "all") === value;
          return (
            <Link
              key={value}
              href={value === "all" ? "/platform/registrations" : `/platform/registrations?status=${value}`}
              aria-current={selected ? "page" : undefined}
              className={[
                "shrink-0 rounded-full border px-4 py-2.5 text-xs font-semibold shadow-[0_1px_2px_rgba(30,43,69,0.02)]",
                selected
                  ? "border-[#1a5144] bg-[#1a5144] text-white hover:border-[#226657] hover:bg-[#226657]"
                  : "border-[#d7dfdb] bg-white text-[#43524c] hover:border-[#b8d2c8] hover:bg-[#f0f4f2] hover:text-[#1a5144]",
              ].join(" ")}
            >
              {label}
            </Link>
          );
        })}
      </nav>

      <section className="space-y-3">
        {queue.applications.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-[#cfdbea] bg-white/80 px-6 py-12 text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#edf5f2] text-[#5b95ef]" aria-hidden="true">
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M5 20V8l7-4 7 4v12M8 20v-5h8v5M8 10h.01M12 10h.01M16 10h.01" />
              </svg>
            </span>
            <p className="mt-4 font-semibold text-[#1d2824]">Nessuna richiesta in questa vista</p>
            <p className="mt-2 text-sm text-[#7a899d]">Le nuove application compariranno automaticamente qui.</p>
          </div>
        ) : (
          queue.applications.map((application) => (
            <Link
              key={application.id}
              href={`/platform/registrations/${application.id}`}
              className="block rounded-2xl border border-[#dce2df] bg-white p-5 shadow-[0_1px_2px_rgba(30,43,69,0.025)] hover:border-[#b8d2c8] hover:shadow-[0_8px_24px_rgba(30,43,69,0.055)]"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${statusClass(application.application_status)}`}>
                      {STATUS_LABELS[application.application_status] ?? application.application_status}
                    </span>
                    <span className="text-xs font-medium text-[#8b98aa]">{application.country_code}</span>
                  </div>
                  <h2 className="mt-3 text-lg font-semibold text-[#1d2824]">{application.legal_name}</h2>
                  <p className="mt-1 text-sm text-[#66736e]">
                    {TYPE_LABELS[application.primary_company_type] ?? application.primary_company_type} · {application.applicant_email}
                  </p>
                  {application.vat_id ? (
                    <p className="mt-1 text-xs text-[#87938e]">VAT / P.IVA: {application.vat_id}</p>
                  ) : null}
                </div>
                <div className="text-left sm:text-right">
                  <p className="text-xs text-[#87938e]">Aggiornata</p>
                  <p className="mt-1 text-sm font-medium text-[#42516a]">
                    {new Intl.DateTimeFormat("it-IT", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    }).format(new Date(application.updated_at))}
                  </p>
                  <p className="mt-3 text-xs font-semibold text-[#1a5144]">Apri dettaglio →</p>
                </div>
              </div>
            </Link>
          ))
        )}
      </section>
    </div>
  );
}
