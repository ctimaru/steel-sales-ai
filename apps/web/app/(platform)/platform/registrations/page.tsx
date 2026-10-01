import Link from "next/link";

import { FirstUseEmptyState } from "@/components/first-use-empty-state";

import { getRegistrationQueue, requirePlatformPermission } from "@/lib/platform-admin";
import { isRegistrationApplicationStatus } from "@/lib/registration-state";

const FILTERS = [
  ["all", "Tutte"],
  ["pending_review", "Da revisionare"],
  ["needs_information", "In attesa dati"],
  ["approved", "Da attivare"],
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
};

const NEXT_ACTION_LABELS: Record<string, string> = {
  review_decision: "Decisione review",
  await_resubmission: "Attendi integrazione",
  activate_workspace: "Attiva workspace",
  none: "Nessuna azione",
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

function identityBadge(state: string, blocking: number, possible: number) {
  if (state === "controlled_conflict") {
    return {
      label: "Conflitto ownership",
      className: "border-rose-200 bg-rose-50 text-rose-700",
    };
  }
  if (state === "candidate") {
    return {
      label: `${blocking} match identità`,
      className: "border-indigo-200 bg-indigo-50 text-indigo-700",
    };
  }
  if (state === "shared_domain") {
    return {
      label: `${possible} dominio condiviso`,
      className: "border-amber-200 bg-amber-50 text-amber-800",
    };
  }
  return {
    label: "Identità libera",
    className: "border-[#dce2df] bg-[#f7f9f8] text-[#66736e]",
  };
}

function ageLabel(hours: number) {
  if (hours < 1) return "< 1h";
  if (hours < 24) return `${Math.round(hours)}h`;
  const days = Math.floor(hours / 24);
  const rest = Math.round(hours % 24);
  return rest ? `${days}g ${rest}h` : `${days}g`;
}

function queueHref(status: string, query: string) {
  const params = new URLSearchParams();
  if (status !== "all") params.set("status", status);
  if (query) params.set("q", query);
  const qs = params.toString();
  return qs ? `/platform/registrations?${qs}` : "/platform/registrations";
}

export default async function AdminRegistrationsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; error?: string; message?: string }>;
}) {
  await requirePlatformPermission("registrations.read");
  const { status, q, error, message } = await searchParams;
  const activeStatus = isRegistrationApplicationStatus(status) ? status : null;
  const query = q?.trim() ?? "";
  const queue = await getRegistrationQueue(activeStatus, query);

  const metrics = [
    ["Da revisionare", queue.summary.pending_review, "Richiedono una decisione"],
    ["Oltre 24h", queue.summary.pending_over_24h, "Review in ritardo"],
    ["Da attivare", queue.summary.ready_activation, "Approvate, workspace non attivo"],
    ["Conflitti identità", queue.summary.identity_conflicts, "Profilo già controllato"],
  ] as const;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <section className="platform-surface rounded-3xl p-6 sm:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="platform-kicker">HP6 · Registration operations</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#18263d] sm:text-4xl">
              Registrazioni aziende
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#66736e]">
              Una sola coda operativa per review, integrazioni, duplicate resolution, approvazione,
              attivazione e audit.
            </p>
          </div>

          <div className="min-w-[190px] rounded-2xl border border-[#d9e1dd] bg-[#f1f6ff] px-5 py-4">
            <p className="text-xs font-semibold text-[#71819a]">Pratiche visualizzate</p>
            <p className="metric-number mt-1 text-3xl font-semibold text-[#173468]">{queue.count}</p>
            <p className="mt-1 text-xs text-[#87938e]">
              {queue.total === queue.count ? `${queue.total} totali` : `${queue.count} di ${queue.total}`}
            </p>
          </div>
        </div>
      </section>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
          {error}
        </div>
      ) : null}
      {message ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
          {message}
        </div>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map(([label, value, hint]) => (
          <div key={label} className="rounded-2xl border border-[#dce2df] bg-white p-4">
            <p className="text-2xl font-semibold text-[#1d2824]">{value}</p>
            <p className="mt-1 text-xs font-bold uppercase tracking-[0.1em] text-[#52615b]">{label}</p>
            <p className="mt-1 text-xs text-[#87938e]">{hint}</p>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-[#dce2df] bg-white p-4">
        <form method="get" action="/platform/registrations" className="flex flex-col gap-3 sm:flex-row">
          {activeStatus ? <input type="hidden" name="status" value={activeStatus} /> : null}
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder="Cerca azienda, email, P.IVA o registro impresa"
            className="h-11 min-w-0 flex-1 rounded-xl border border-[#d7dfdb] bg-[#f7f9f8] px-4 text-sm text-[#1d2824] outline-none focus:border-[#8fb8aa] focus:bg-white"
          />
          <button className="h-11 rounded-xl bg-[#1a5144] px-5 text-sm font-semibold text-white hover:bg-[#226657]">
            Cerca
          </button>
          {query ? (
            <Link
              href={queueHref(activeStatus ?? "all", "")}
              className="inline-flex h-11 items-center justify-center rounded-xl border border-[#d7dfdb] bg-white px-4 text-sm font-semibold text-[#52615b]"
            >
              Pulisci
            </Link>
          ) : null}
        </form>
      </section>

      <nav className="flex gap-2 overflow-x-auto pb-1" aria-label="Filtri registrazioni">
        {FILTERS.map(([value, label]) => {
          const selected = (activeStatus ?? "all") === value;
          return (
            <Link
              key={value}
              href={queueHref(value, query)}
              aria-current={selected ? "page" : undefined}
              className={[
                "shrink-0 rounded-full border px-4 py-2.5 text-xs font-semibold",
                selected
                  ? "border-[#1a5144] bg-[#1a5144] text-white"
                  : "border-[#d7dfdb] bg-white text-[#43524c] hover:border-[#b8d2c8] hover:bg-[#f0f4f2]",
              ].join(" ")}
            >
              {label}
            </Link>
          );
        })}
      </nav>

      {queue.summary.oldest_pending_hours > 0 ? (
        <div className="rounded-2xl border border-[#d9e1dd] bg-[#f7f9f8] px-4 py-3 text-sm text-[#52615b]">
          La pratica più vecchia ancora da revisionare è in coda da{" "}
          <span className="font-semibold text-[#1d2824]">
            {ageLabel(queue.summary.oldest_pending_hours)}
          </span>.
        </div>
      ) : null}

      <section className="space-y-3">
        {queue.applications.length === 0 ? (
          <FirstUseEmptyState
            eyebrow={activeStatus || query ? "Coda senza risultati" : "Coda pulita"}
            title="Nessuna pratica in questa vista"
            description={
              activeStatus || query
                ? "Rimuovi filtro e ricerca per verificare l’intera coda di registrazione."
                : "Non ci sono pratiche aziendali da gestire in questo momento. Le nuove registrazioni compariranno automaticamente qui."
            }
            primaryAction={{
              href: "/platform/registrations",
              label: activeStatus || query ? "Mostra tutte le pratiche" : "Aggiorna la coda",
            }}
            secondaryAction={{
              href: "/platform",
              label: "Torna al control plane",
            }}
          />
        ) : (
          queue.applications.map((application) => {
            const identity = identityBadge(
              application.identity_state,
              application.blocking_candidate_count,
              application.possible_match_count,
            );

            return (
              <Link
                key={application.id}
                href={`/platform/registrations/${application.id}`}
                className={[
                  "block rounded-2xl border bg-white p-5 transition",
                  application.attention_required
                    ? "border-amber-300 shadow-[0_8px_28px_rgba(120,83,20,0.08)]"
                    : "border-[#dce2df] hover:border-[#b8d2c8] hover:shadow-[0_8px_24px_rgba(30,43,69,0.055)]",
                ].join(" ")}
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${statusClass(application.application_status)}`}>
                        {STATUS_LABELS[application.application_status] ?? application.application_status}
                      </span>
                      <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${identity.className}`}>
                        {identity.label}
                      </span>
                      {application.attention_required ? (
                        <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-800">
                          Attenzione
                        </span>
                      ) : null}
                    </div>

                    <h2 className="mt-3 truncate text-lg font-semibold text-[#1d2824]">
                      {application.legal_name}
                    </h2>
                    <p className="mt-1 text-sm text-[#66736e]">
                      {TYPE_LABELS[application.primary_company_type] ?? application.primary_company_type}
                      {" · "}
                      {application.country_code}
                    </p>
                    <p className="mt-1 break-all text-xs text-[#87938e]">
                      {application.applicant_email}
                      {application.vat_id ? ` · VAT ${application.vat_id}` : ""}
                      {application.registration_id ? ` · Registro ${application.registration_id}` : ""}
                    </p>
                  </div>

                  <div className="grid shrink-0 gap-3 sm:grid-cols-3 lg:min-w-[430px]">
                    <div className="rounded-xl bg-[#f7f9f8] px-3 py-3">
                      <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#87938e]">
                        Prossima azione
                      </p>
                      <p className="mt-1 text-xs font-semibold text-[#43524c]">
                        {NEXT_ACTION_LABELS[application.next_action] ?? application.next_action}
                      </p>
                    </div>
                    <div className="rounded-xl bg-[#f7f9f8] px-3 py-3">
                      <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#87938e]">
                        In stato da
                      </p>
                      <p className="mt-1 text-xs font-semibold text-[#43524c]">
                        {ageLabel(application.age_hours)}
                      </p>
                    </div>
                    <div className="rounded-xl bg-[#f7f9f8] px-3 py-3">
                      <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#87938e]">
                        Identità
                      </p>
                      <p className="mt-1 text-xs font-semibold text-[#43524c]">
                        {application.blocking_candidate_count
                          ? `${application.blocking_candidate_count} candidate`
                          : application.possible_match_count
                            ? `${application.possible_match_count} possibili`
                            : "Nessun blocco"}
                      </p>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })
        )}
      </section>
    </div>
  );
}
