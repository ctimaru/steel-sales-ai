import Link from "next/link";

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
                Gestisci le ricerche prodotto create dalla tua azienda. Le richieste restano separate dalle RFQ private della Commercial Memory e, quando pubblicate, entrano nel Demand Board con il teaser privacy-safe di P5.2.
              </p>
            </div>

            {canWrite ? (
              <Link
                href={appRoutes.marketplace.newRequest}
                className="inline-flex h-11 items-center justify-center rounded-xl bg-[#1a5144] px-5 text-sm font-semibold text-white transition hover:bg-[#226657]"
              >
                + Nuova ricerca
              </Link>
            ) : null}
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
        <p className="text-sm font-semibold text-[#173f35]">P5.2 attivo</p>
        <p className="mt-1 text-sm leading-6 text-[#66736e]">
          Le richieste pubblicate entrano ora nel feed supplier con countdown e teaser privacy-safe. Norma, grado, dimensioni, quantità esatta, certificazioni e note restano locked fino al blocco P5.3.
        </p>
      </section>

      <section>
        <div className="mb-3">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#7b8782]">La tua azienda</p>
          <h2 className="mt-1 text-xl font-semibold text-[#1d2824]">Ricerche prodotto</h2>
        </div>

        {requests.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-[#c8d5d0] bg-white p-8 text-center">
            <h3 className="font-semibold text-[#1d2824]">Nessuna ricerca Marketplace</h3>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[#66736e]">
              P5.1 parte da un’azione esplicita: nessuna RFQ, email o richiesta della Commercial Memory
              viene pubblicata automaticamente.
            </p>
            {canWrite ? (
              <Link
                href={appRoutes.marketplace.newRequest}
                className="mt-5 inline-flex rounded-xl bg-[#1a5144] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#226657]"
              >
                Crea la prima ricerca
              </Link>
            ) : null}
          </div>
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
          {published} richieste hanno raggiunto lo stato pubblicato e sono visibili nel feed supplier secondo le regole P5.2.
        </p>
      ) : null}
    </div>
  );
}
