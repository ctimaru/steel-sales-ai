import Link from "next/link";
import { notFound } from "next/navigation";

import { transitionMarketplaceBuyerResponse } from "@/app/(workspace)/marketplace/actions";
import { canWriteWorkspace } from "@/lib/access-policy";
import { getMarketplaceBuyerResponse } from "@/lib/marketplace";
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

function numberLabel(value: number | undefined) {
  if (value == null) return "—";
  return new Intl.NumberFormat("it-IT", {
    maximumFractionDigits: 3,
  }).format(value);
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export default async function MarketplaceResponseDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const [{ id }, { error, message }, context] = await Promise.all([
    params,
    searchParams,
    getWorkspaceContext(),
  ]);
  const detail = await getMarketplaceBuyerResponse(context.organizationId, id);
  if (!detail) notFound();

  const { response, request, supplier } = detail;
  const canWrite = canWriteWorkspace(context.role);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Link
        href={appRoutes.marketplace.responses}
        className="text-sm font-semibold text-[#66736e] hover:text-[#173f35]"
      >
        ← Torna alle risposte
      </Link>

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

      <section className="rounded-3xl border border-[#dce2df] bg-white p-6 sm:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-[#edf5f2] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-[#1a5144]">
                P5.4 · Buyer response
              </span>
              <span className="rounded-full bg-[#f2f4f3] px-3 py-1 text-[11px] font-semibold text-[#66736e]">
                {statusLabel(response.status)}
              </span>
            </div>
            <h1 className="mt-4 text-2xl font-semibold text-[#1d2824]">
              {supplier.display_name}
            </h1>
            <p className="mt-2 text-sm text-[#66736e]">
              {response.response_kind === "quote"
                ? "Quotazione strutturata"
                : "Manifestazione di interesse"}
            </p>
            {supplier.country_code ? (
              <p className="mt-1 text-xs text-[#87938e]">{supplier.country_code}</p>
            ) : null}
            {supplier.network_company_id ? (
              <Link
                href={appRoutes.network.company(supplier.network_company_id)}
                className="mt-3 inline-flex text-sm font-semibold text-[#173f35] hover:underline"
              >
                Apri Company Profile →
              </Link>
            ) : null}
          </div>

          <div className="rounded-2xl border border-[#e2e7e4] bg-[#f8faf9] px-4 py-3 text-xs text-[#66736e]">
            <p><strong className="text-[#43524c]">Inviata:</strong> {formatDate(response.submitted_at)}</p>
            <p className="mt-1"><strong className="text-[#43524c]">Valida fino:</strong> {formatDate(response.valid_until)}</p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-[#dce2df] bg-white p-5">
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#7b8782]">
          Ricerca collegata
        </p>
        <h2 className="mt-2 text-lg font-semibold text-[#1d2824]">{request.title}</h2>
        <p className="mt-2 text-sm text-[#66736e]">
          {request.visibility_mode === "anonymous" ? "Pubblicata anonima" : "Pubblicata con azienda visibile"}
          {" · "}
          Scadenza {formatDate(request.closes_at)}
        </p>
        <Link
          href={appRoutes.marketplace.request(request.request_id)}
          className="mt-3 inline-flex text-sm font-semibold text-[#173f35] hover:underline"
        >
          Apri ricerca buyer →
        </Link>
      </section>

      {response.message ? (
        <section className="rounded-2xl border border-[#dce2df] bg-white p-5">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#7b8782]">
            Messaggio supplier
          </p>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[#66736e]">
            {response.message}
          </p>
        </section>
      ) : null}

      <section>
        <div className="mb-3">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#7b8782]">
            Risposta strutturata
          </p>
          <h2 className="mt-1 text-xl font-semibold text-[#1d2824]">
            Linee commerciali · {detail.lines.length}
          </h2>
        </div>

        {detail.lines.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#c8d5d0] bg-white p-6 text-sm text-[#66736e]">
            Il supplier non ha allegato linee commerciali strutturate.
          </div>
        ) : (
          <div className="space-y-3">
            {detail.lines.map((line) => (
              <article
                key={line.request_line_id}
                className="rounded-2xl border border-[#dce2df] bg-white p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#173f35]">
                      Pos. {line.line_number} · {line.product_family_name}
                    </p>
                    <p className="mt-2 text-sm text-[#66736e]">
                      Richiesta: <strong className="text-[#43524c]">{numberLabel(line.request_quantity)} {line.request_quantity_unit}</strong>
                    </p>
                  </div>
                  {line.unit_price != null ? (
                    <span className="rounded-full bg-[#edf5f2] px-3 py-1 text-sm font-semibold text-[#173f35]">
                      {numberLabel(line.unit_price)} {line.currency_code ?? ""}
                    </span>
                  ) : null}
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#87938e]">Quantità offerta</p>
                    <p className="mt-1 text-sm font-semibold text-[#43524c]">
                      {line.offered_quantity != null
                        ? numberLabel(line.offered_quantity) + " " + (line.quantity_unit ?? "")
                        : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#87938e]">Lead time</p>
                    <p className="mt-1 text-sm font-semibold text-[#43524c]">
                      {line.lead_time_days != null ? line.lead_time_days + " giorni" : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#87938e]">Consegna proposta</p>
                    <p className="mt-1 text-sm font-semibold text-[#43524c]">
                      {formatDate(line.offered_delivery_date)}
                    </p>
                  </div>
                </div>
                {line.notes ? (
                  <p className="mt-4 text-sm leading-6 text-[#66736e]">{line.notes}</p>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </section>

      {canWrite && (response.status === "submitted" || response.status === "acknowledged") ? (
        <section className="rounded-2xl border border-[#d9e8e2] bg-[#f3f7f5] p-5">
          <h2 className="text-sm font-semibold text-[#173f35]">Gestisci risposta</h2>
          <p className="mt-1 text-xs leading-5 text-[#66736e]">
            Le decisioni sono registrate nell’audit ledger P5.4. Non viene creato
            automaticamente alcun ordine o offerta nella Commercial Memory.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {response.status === "submitted" ? (
              <form action={transitionMarketplaceBuyerResponse}>
                <input type="hidden" name="response_id" value={response.response_id} />
                <input type="hidden" name="action" value="acknowledge" />
                <button className="rounded-xl bg-[#1a5144] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#226657]">
                  Prendi in carico
                </button>
              </form>
            ) : null}
            <form action={transitionMarketplaceBuyerResponse}>
              <input type="hidden" name="response_id" value={response.response_id} />
              <input type="hidden" name="action" value="decline" />
              <button className="rounded-xl border border-rose-200 bg-white px-4 py-2.5 text-sm font-semibold text-rose-700 hover:bg-rose-50">
                Declina
              </button>
            </form>
            {response.status === "acknowledged" ? (
              <form action={transitionMarketplaceBuyerResponse}>
                <input type="hidden" name="response_id" value={response.response_id} />
                <input type="hidden" name="action" value="close" />
                <button className="rounded-xl border border-[#b8d2c8] bg-white px-4 py-2.5 text-sm font-semibold text-[#173f35] hover:bg-[#edf5f2]">
                  Chiudi
                </button>
              </form>
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}
