import Link from "next/link";

import { FirstUseEmptyState } from "@/components/first-use-empty-state";
import { MarketplaceCountdown } from "@/components/marketplace-countdown";
import { MarketplaceReadinessPanel } from "@/components/marketplace-readiness";
import { canWriteWorkspace } from "@/lib/access-policy";
import {
  getMarketplaceFeed,
  getMarketplaceTaxonomy,
  type MarketplaceFeedItem,
} from "@/lib/marketplace";
import { getMarketplaceEntryReadiness } from "@/lib/marketplace-readiness";
import { appRoutes } from "@/lib/routes";
import { getWorkspaceContext } from "@/lib/workspace-context";

export const dynamic = "force-dynamic";

function teaserHeadline(item: MarketplaceFeedItem) {
  const first = item.teaser_lines[0];
  if (!first) return "Ricerca prodotto";
  if (item.line_count <= 1) return first.product_family_name;
  return `${first.product_family_name} + ${item.line_count - 1} linee`;
}

function buyerLabel(item: MarketplaceFeedItem) {
  if (item.buyer.visibility_mode === "anonymous") return "Buyer anonimo";
  return item.buyer.display_name || "Azienda visibile";
}

function deliveryLabel(item: MarketplaceFeedItem) {
  const countries = Array.from(
    new Set(item.teaser_lines.map((line) => line.delivery_country_code)),
  );
  return countries.join(" · ") || "Consegna da definire";
}

export default async function MarketplaceFeedPage({
  searchParams,
}: {
  searchParams: Promise<{
    product?: string;
    country?: string;
    closing?: string;
  }>;
}) {
  const [params, context] = await Promise.all([
    searchParams,
    getWorkspaceContext(),
  ]);

  const closingWithinHours =
    params.closing === "24"
      ? 24
      : params.closing === "72"
        ? 72
        : params.closing === "168"
          ? 168
          : undefined;

  const [feed, taxonomy, readiness] = await Promise.all([
    getMarketplaceFeed(context.organizationId, {
      productKey: params.product || undefined,
      countryCode: params.country || undefined,
      closingWithinHours,
      limit: 25,
      offset: 0,
    }),
    getMarketplaceTaxonomy(),
    getMarketplaceEntryReadiness(context.role),
  ]);

  const canWrite = canWriteWorkspace(context.role);
  const canAdmin = context.role === "admin";
  const hasFilters = Boolean(params.product || params.country || params.closing);
  const closingSoon = feed.items.filter(
    (item) => item.effective_status === "closing_soon",
  ).length;

  return (
    <div className="mx-auto max-w-7xl space-y-7">
      <section className="overflow-hidden rounded-3xl border border-[#dce2df] bg-white shadow-[0_1px_2px_rgba(20,46,38,0.03)]">
        <div className="h-1 bg-[#1a5144]" />
        <div className="p-6 sm:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-[#edf5f2] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-[#1a5144]">
                  P5.2 · Live Demand Board
                </span>
                <span className="rounded-full bg-[#ecefed] px-3 py-1 text-[11px] font-semibold text-[#66736e]">
                  Free teaser
                </span>
              </div>
              <h1 className="mt-4 text-3xl font-semibold tracking-tight text-[#1d2824] sm:text-4xl">
                Opportunità dal Network
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-[#66736e] sm:text-base">
                Scopri ricerche prodotto pubblicate da altre aziende. Il feed mostra soltanto un teaser
                privacy-safe: categoria, macro-specifica, area consentita, fascia quantità e countdown.
                Dettagli tecnici completi e risposta restano fuori da P5.2.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link
                href={appRoutes.marketplace.responses}
                className="inline-flex h-11 items-center justify-center rounded-xl border border-[#c8d5d0] bg-white px-4 text-sm font-semibold text-[#173f35] hover:bg-[#f3f7f5]"
              >
                Risposte ricevute
              </Link>
              <Link
                href={appRoutes.marketplace.myRequests}
                className="inline-flex h-11 items-center justify-center rounded-xl border border-[#c8d5d0] bg-white px-4 text-sm font-semibold text-[#173f35] hover:bg-[#f3f7f5]"
              >
                Le mie ricerche
              </Link>
              {canWrite ? (
                <Link
                  href={appRoutes.marketplace.newRequest}
                  className="inline-flex h-11 items-center justify-center rounded-xl bg-[#1a5144] px-5 text-sm font-semibold text-white transition hover:bg-[#226657]"
                >
                  + Nuova ricerca
                </Link>
              ) : null}
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-[#e2e7e4] bg-[#f7f9f8] p-4">
              <p className="metric-number text-2xl font-semibold text-[#1d2824]">{feed.total}</p>
              <p className="mt-1 text-xs font-semibold text-[#66736e]">Opportunità aperte</p>
            </div>
            <div className="rounded-2xl border border-[#e2e7e4] bg-[#f7f9f8] p-4">
              <p className="metric-number text-2xl font-semibold text-[#1d2824]">{closingSoon}</p>
              <p className="mt-1 text-xs font-semibold text-[#66736e]">In scadenza entro 24h nella pagina</p>
            </div>
          </div>
        </div>
      </section>

      <form method="get" className="grid gap-3 rounded-2xl border border-[#dce2df] bg-white p-4 md:grid-cols-[1.4fr_0.7fr_0.8fr_auto] md:items-end">
        <div>
          <label className="text-xs font-bold uppercase tracking-[0.12em] text-[#7b8782]">
            Prodotto
          </label>
          <select
            name="product"
            defaultValue={params.product || ""}
            className="mt-2 h-11 w-full rounded-xl border border-[#d7dfdb] bg-white px-3 text-sm text-[#43524c] outline-none focus:border-[#438d7a] focus:ring-4 focus:ring-[#e1ece8]"
          >
            <option value="">Tutte le famiglie</option>
            {taxonomy.product_families.map((item) => (
              <option key={item.id} value={item.key}>{item.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs font-bold uppercase tracking-[0.12em] text-[#7b8782]">
            Paese consegna
          </label>
          <input
            name="country"
            defaultValue={params.country || ""}
            maxLength={2}
            placeholder="IT"
            className="mt-2 h-11 w-full rounded-xl border border-[#d7dfdb] px-3 text-sm uppercase text-[#43524c] outline-none focus:border-[#438d7a] focus:ring-4 focus:ring-[#e1ece8]"
          />
        </div>

        <div>
          <label className="text-xs font-bold uppercase tracking-[0.12em] text-[#7b8782]">
            Scadenza
          </label>
          <select
            name="closing"
            defaultValue={params.closing || ""}
            className="mt-2 h-11 w-full rounded-xl border border-[#d7dfdb] bg-white px-3 text-sm text-[#43524c] outline-none focus:border-[#438d7a]"
          >
            <option value="">Tutte aperte</option>
            <option value="24">Entro 24 ore</option>
            <option value="72">Entro 3 giorni</option>
            <option value="168">Entro 7 giorni</option>
          </select>
        </div>

        <button className="h-11 rounded-xl bg-[#1a5144] px-5 text-sm font-semibold text-white hover:bg-[#226657]">
          Filtra
        </button>
      </form>

      <section>
        <div className="mb-3 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#7b8782]">
              Demand Board
            </p>
            <h2 className="mt-1 text-xl font-semibold text-[#1d2824]">
              Ricerche aperte
            </h2>
          </div>
          <p className="text-xs text-[#87938e]">
            Stato e tempo residuo derivano dal database.
          </p>
        </div>

        {feed.items.length === 0 ? (
          hasFilters ? (
            <FirstUseEmptyState
              eyebrow="Filtri senza risultati"
              title="Nessuna opportunità corrisponde ai filtri"
              description="Azzera prodotto, paese e scadenza per tornare all’intero Demand Board. Le ricerche della tua azienda restano comunque escluse dal feed supplier."
              primaryAction={{
                href: appRoutes.marketplace.home,
                label: "Azzera filtri",
              }}
              secondaryAction={{
                href: appRoutes.marketplace.notifications,
                label: "Apri opportunità per te",
              }}
            />
          ) : (
            <FirstUseEmptyState
              title="Il Demand Board è pronto per le prime opportunità"
              description="Al momento non ci sono ricerche esterne aperte visibili alla tua organizzazione. Puoi creare una ricerca buyer oppure preparare il profilo tecnico per il matching supplier."
              primaryAction={
                canWrite
                  ? {
                      href: appRoutes.marketplace.newRequest,
                      label: "Crea una ricerca",
                    }
                  : {
                      href: appRoutes.marketplace.notifications,
                      label: "Apri opportunità per te",
                    }
              }
              secondaryAction={
                canAdmin
                  ? {
                      href: appRoutes.network.manage,
                      label: "Completa Company Profile",
                    }
                  : {
                      href: appRoutes.network.directory,
                      label: "Esplora il Network",
                    }
              }
              note="Commercial Memory e Marketplace restano separati: nessuna RFQ privata viene pubblicata automaticamente."
            />
          )
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {feed.items.map((item) => {
              const firstLine = item.teaser_lines[0];
              const namedBuyer = item.buyer.visibility_mode === "named";

              return (
                <Link
                  key={item.request_id}
                  href={appRoutes.marketplace.opportunity(item.request_id)}
                  className="group rounded-2xl border border-[#dce2df] bg-white p-5 transition hover:border-[#b8d2c8] hover:shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={[
                          "rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em]",
                          item.effective_status === "closing_soon"
                            ? "bg-amber-50 text-amber-700"
                            : "bg-emerald-50 text-emerald-700",
                        ].join(" ")}>
                          {item.effective_status === "closing_soon" ? "In scadenza" : "Aperta"}
                        </span>
                        <span className="rounded-full bg-[#f2f4f3] px-2.5 py-1 text-[10px] font-semibold text-[#66736e]">
                          {namedBuyer ? "Named" : "Anonymous"}
                        </span>
                        <span className="rounded-full bg-[#edf5f2] px-2.5 py-1 text-[10px] font-semibold text-[#173f35]">
                          Teaser gratuito
                        </span>
                      </div>

                      <h3 className="mt-3 text-lg font-semibold text-[#1d2824]">
                        {teaserHeadline(item)}
                      </h3>
                      <p className="mt-1 text-sm text-[#66736e]">
                        {buyerLabel(item)}
                        {" · "}
                        {deliveryLabel(item)}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#87938e]">
                        Tempo residuo
                      </p>
                      <div className="mt-1">
                        <MarketplaceCountdown initialSeconds={item.seconds_remaining} compact />
                      </div>
                    </div>
                  </div>

                  {firstLine ? (
                    <div className="mt-5 grid gap-3 border-t border-[#eef1ef] pt-4 sm:grid-cols-3">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#87938e]">Macro-specifica</p>
                        <p className="mt-1 text-sm font-semibold text-[#43524c]">
                          {firstLine.manufacturing_process || "Non specificata"}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#87938e]">Fascia quantità</p>
                        <p className="mt-1 text-sm font-semibold text-[#43524c]">
                          {firstLine.quantity_band}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#87938e]">Consegna</p>
                        <p className="mt-1 text-sm font-semibold text-[#43524c]">
                          {firstLine.delivery_country_code}
                          {firstLine.delivery_region ? ` · ${firstLine.delivery_region}` : ""}
                        </p>
                      </div>
                    </div>
                  ) : null}

                  <div className="mt-4 flex items-center justify-between text-xs">
                    <span className="text-[#87938e]">
                      {item.line_count} {item.line_count === 1 ? "linea prodotto" : "linee prodotto"}
                    </span>
                    <span className="font-semibold text-[#173f35] group-hover:underline">
                      Apri teaser →
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-[#d9e8e2] bg-[#f3f7f5] px-5 py-4">
        <p className="text-sm font-semibold text-[#173f35]">Privacy boundary P5.2</p>
        <p className="mt-1 text-sm leading-6 text-[#66736e]">
          Nel feed non vengono esposti titolo libero, norma, grado, dimensioni, quantità esatta,
          certificazione, note o data di consegna. Per le richieste anonymous non vengono esposti
          nemmeno identità buyer, Company Profile o regione.
        </p>
      </section>
    </div>
  );
}
