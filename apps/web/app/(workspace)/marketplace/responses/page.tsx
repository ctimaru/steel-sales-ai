import Link from "next/link";

import { getMarketplaceBuyerResponses } from "@/lib/marketplace";
import { appRoutes } from "@/lib/routes";
import { getWorkspaceContext } from "@/lib/workspace-context";

export const dynamic = "force-dynamic";

function statusLabel(status: string) {
  if (status === "submitted") return "Nuova";
  if (status === "acknowledged") return "Presa in carico";
  if (status === "declined") return "Declinata";
  if (status === "withdrawn") return "Ritirata";
  if (status === "closed") return "Chiusa";
  return status;
}

function statusClasses(status: string) {
  if (status === "submitted") return "bg-emerald-50 text-emerald-700";
  if (status === "acknowledged") return "bg-[#edf5f2] text-[#173f35]";
  if (status === "declined") return "bg-rose-50 text-rose-700";
  return "bg-[#ecefed] text-[#66736e]";
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

export default async function MarketplaceResponsesPage() {
  const context = await getWorkspaceContext();
  const inbox = await getMarketplaceBuyerResponses(context.organizationId);

  const newCount = inbox.items.filter((item) => item.status === "submitted").length;
  const activeCount = inbox.items.filter(
    (item) => item.status === "submitted" || item.status === "acknowledged",
  ).length;

  return (
    <div className="mx-auto max-w-7xl space-y-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href={appRoutes.marketplace.myRequests}
          className="text-sm font-semibold text-[#66736e] hover:text-[#173f35]"
        >
          ← Torna alle mie ricerche
        </Link>
        <Link
          href={appRoutes.marketplace.home}
          className="text-sm font-semibold text-[#173f35] hover:underline"
        >
          Demand Board →
        </Link>
      </div>

      <section className="overflow-hidden rounded-3xl border border-[#dce2df] bg-white">
        <div className="h-1 bg-[#1a5144]" />
        <div className="p-6 sm:p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <span className="rounded-full bg-[#edf5f2] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-[#1a5144]">
                P5.4 · Buyer inbox
              </span>
              <h1 className="mt-4 text-3xl font-semibold tracking-tight text-[#1d2824]">
                Risposte Marketplace
              </h1>
              <p className="mt-3 text-sm leading-6 text-[#66736e]">
                Qui arrivano solo risposte effettivamente inviate dai supplier alle
                ricerche della tua organizzazione. Le bozze supplier non sono visibili
                al buyer.
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-[#e2e7e4] bg-[#f7f9f8] p-4">
              <p className="metric-number text-2xl font-semibold text-[#1d2824]">
                {inbox.total}
              </p>
              <p className="mt-1 text-xs font-semibold text-[#66736e]">Risposte totali</p>
            </div>
            <div className="rounded-2xl border border-[#e2e7e4] bg-[#f7f9f8] p-4">
              <p className="metric-number text-2xl font-semibold text-[#1d2824]">
                {newCount}
              </p>
              <p className="mt-1 text-xs font-semibold text-[#66736e]">Nuove</p>
            </div>
            <div className="rounded-2xl border border-[#e2e7e4] bg-[#f7f9f8] p-4">
              <p className="metric-number text-2xl font-semibold text-[#1d2824]">
                {activeCount}
              </p>
              <p className="mt-1 text-xs font-semibold text-[#66736e]">Da gestire</p>
            </div>
          </div>
        </div>
      </section>

      {inbox.items.length === 0 ? (
        <section className="rounded-3xl border border-dashed border-[#c8d5d0] bg-white p-8 text-center">
          <h2 className="font-semibold text-[#1d2824]">Nessuna risposta ricevuta</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[#66736e]">
            Quando un supplier autorizzato invierà una risposta governata a una tua
            ricerca, comparirà qui.
          </p>
        </section>
      ) : (
        <section className="grid gap-3 lg:grid-cols-2">
          {inbox.items.map((item) => (
            <Link
              key={item.response_id}
              href={appRoutes.marketplace.response(item.response_id)}
              className="rounded-2xl border border-[#dce2df] bg-white p-5 transition hover:border-[#b8d2c8] hover:shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <span className={"rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] " + statusClasses(item.status)}>
                    {statusLabel(item.status)}
                  </span>
                  <h2 className="mt-3 text-base font-semibold text-[#1d2824]">
                    {item.supplier.display_name}
                  </h2>
                  <p className="mt-1 text-sm text-[#66736e]">
                    {item.response_kind === "quote" ? "Quotazione" : "Manifestazione di interesse"}
                    {" · "}
                    {item.line_count} {item.line_count === 1 ? "linea" : "linee"}
                  </p>
                </div>
                <span className="text-xs font-semibold text-[#173f35]">Apri →</span>
              </div>

              <div className="mt-4 border-t border-[#eef1ef] pt-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#87938e]">
                  Ricerca
                </p>
                <p className="mt-1 text-sm font-semibold text-[#43524c]">
                  {item.request_title}
                </p>
                <p className="mt-2 text-xs text-[#87938e]">
                  Inviata: {formatDate(item.submitted_at)}
                </p>
              </div>
            </Link>
          ))}
        </section>
      )}
    </div>
  );
}
