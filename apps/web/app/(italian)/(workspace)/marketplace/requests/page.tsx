import Link from "next/link";

import { FirstUseEmptyState } from "@/components/first-use-empty-state";
import { canWriteWorkspace } from "@/lib/access-policy";
import { getMyMarketplaceRequests } from "@/lib/marketplace";
import { appRoutes } from "@/lib/routes";
import { getWorkspaceContext } from "@/lib/workspace-context";

export const dynamic = "force-dynamic";

function statusLabel(status: string) {
  if (status === "open") return "Pubblicata";
  if (status === "closing_soon") return "In scadenza";
  if (status === "closed") return "Scaduta";
  if (status === "withdrawn") return "Ritirata";
  return "Bozza";
}

function statusClasses(status: string) {
  if (status === "open") return "bg-emerald-50 text-emerald-700";
  if (status === "closing_soon") return "bg-amber-50 text-amber-700";
  if (status === "closed" || status === "withdrawn") return "bg-[#ecefed] text-[#66736e]";
  return "bg-[#edf5f2] text-[#173f35]";
}

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export default async function MarketplaceRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const [{ error, message }, context] = await Promise.all([
    searchParams,
    getWorkspaceContext(),
  ]);
  const requests = await getMyMarketplaceRequests(context.organizationId);
  const canWrite = canWriteWorkspace(context.role);

  const drafts = requests.filter((item) => item.status === "draft").length;
  const published = requests.filter((item) => item.status === "published").length;
  const active = requests.filter(
    (item) => item.effective_status === "open" || item.effective_status === "closing_soon",
  ).length;

  return (
    <div className="mx-auto max-w-7xl space-y-7">
      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}
      {message ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {message}
        </div>
      ) : null}

      <section className="overflow-hidden rounded-3xl border border-[#dce2df] bg-white shadow-[0_1px_2px_rgba(20,46,38,0.03)]">
        <div className="h-1 bg-[#1a5144]" />
        <div className="p-6 sm:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-[#edf5f2] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-[#1a5144]">
                  Buyer workspace
                </span>
                <span className="rounded-full bg-[#ecefed] px-3 py-1 text-[11px] font-semibold text-[#66736e]">
                  Buyer workspace
                </span>
              </div>
              <h1 className="mt-4 text-3xl font-semibold tracking-tight text-[#1d2824] sm:text-4xl">
                Marketplace
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-[#66736e] sm:text-base">
                Qui trovi le pubblicazioni Marketplace della tua azienda, comprese quelle provenienti da RFQ Hub. Le RFQ private e i confronti offerte si gestiscono in RFQ Hub, non nell’editor Marketplace.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link
                href={appRoutes.marketplace.responses}
                className="inline-flex h-11 items-center justify-center rounded-xl border border-[#c8d5d0] bg-white px-4 text-sm font-semibold text-[#173f35] hover:bg-[#f3f7f5]"
              >
                Risposte ricevute
              </Link>
              {canWrite ? (
                <Link
                  href={appRoutes.marketplace.newRequest}
                  className="inline-flex h-11 items-center justify-center rounded-xl bg-[#1a5144] px-5 text-sm font-semibold text-white transition hover:bg-[#226657]"
                >
                  + Nuova pubblicazione
                </Link>
              ) : null}
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {[
              ["Totali", requests.length],
              ["Bozze", drafts],
              ["Pubblicate attive", active],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-2xl border border-[#e2e7e4] bg-[#f7f9f8] p-4">
                <p className="metric-number text-2xl font-semibold text-[#1d2824]">{value}</p>
                <p className="mt-1 text-xs font-semibold text-[#66736e]">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-[#d9e8e2] bg-[#f3f7f5] px-5 py-4">
        <p className="text-sm font-semibold text-[#173f35]">Risposte dei fornitori</p>
        <p className="mt-1 text-sm leading-6 text-[#66736e]">
          Le richieste pubblicate possono ricevere risposte dai fornitori abilitati. Le risposte Marketplace restano separate dalle RFQ e offerte private della Commercial Memory.
        </p>
      </section>

      <section>
        <div className="mb-3">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#7b8782]">La tua azienda</p>
          <h2 className="mt-1 text-xl font-semibold text-[#1d2824]">Ricerche prodotto</h2>
        </div>

        {requests.length === 0 ? (
          <FirstUseEmptyState
            title="La tua azienda non ha ancora ricerche Marketplace"
            description="Le ricerche Marketplace nascono solo da un’azione esplicita: RFQ, email e richieste della Commercial Memory non vengono mai pubblicate automaticamente."
            primaryAction={
              canWrite
                ? {
                    href: appRoutes.marketplace.newRequest,
                    label: "Scegli come iniziare",
                  }
                : {
                    href: appRoutes.marketplace.home,
                    label: "Apri le opportunità",
                  }
            }
            secondaryAction={{
              href: appRoutes.marketplace.responses,
              label: "Apri risposte ricevute",
            }}
            note={canWrite ? "Potrai scegliere visibilità buyer, linee prodotto e scadenza prima della pubblicazione." : "Il tuo ruolo è in sola lettura: una ricerca potrà essere creata da un collega abilitato."}
          />
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {requests.map((item) => (
              <Link
                key={item.id}
                href={appRoutes.marketplace.request(item.id)}
                className="rounded-2xl border border-[#dce2df] bg-white p-5 transition hover:border-[#b8d2c8] hover:shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={"rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] " + statusClasses(item.effective_status)}>
                        {statusLabel(item.effective_status)}
                      </span>
                      <span className="rounded-full bg-[#f2f4f3] px-2.5 py-1 text-[10px] font-semibold text-[#66736e]">
                        {item.visibility_mode === "anonymous" ? "Anonima" : "Azienda visibile"}
                      </span>
                    </div>
                    <h3 className="mt-3 text-base font-semibold text-[#1d2824]">{item.title}</h3>
                  </div>
                  <span className="text-xs font-semibold text-[#173f35]">Apri →</span>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 border-t border-[#eef1ef] pt-4 text-xs">
                  <div>
                    <p className="text-[#87938e]">Linee prodotto</p>
                    <p className="mt-1 font-semibold text-[#43524c]">{item.line_count}</p>
                  </div>
                  <div>
                    <p className="text-[#87938e]">Scadenza</p>
                    <p className="mt-1 font-semibold text-[#43524c]">{formatDate(item.closes_at)}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {published > 0 ? (
        <p className="text-xs text-[#87938e]">
          {published} richieste sono pubblicate e visibili ai fornitori secondo le regole di accesso del Marketplace.
        </p>
      ) : null}
    </div>
  );
}
