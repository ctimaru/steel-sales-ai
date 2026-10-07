import Link from "next/link";

import { FirstUseEmptyState } from "@/components/first-use-empty-state";
import { FocusHeader, FocusPage, FocusSectionHeader } from "@/components/focus-ui";
import { MarketplaceCountdown } from "@/components/marketplace-countdown";
import { PilotEvent } from "@/components/pilot-event";
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

function opportunityHeadline(item: MarketplaceFeedItem) {
  const first = item.teaser_lines[0];
  if (!first) return "Richiesta prodotto";
  if (item.line_count <= 1) return first.product_family_name;
  return `${first.product_family_name} + ${item.line_count - 1} linee`;
}

function buyerLabel(item: MarketplaceFeedItem) {
  if (item.buyer.visibility_mode === "anonymous") return "Buyer riservato";
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
    getMarketplaceEntryReadiness(context.organizationId, context.role),
  ]);

  const canWrite = canWriteWorkspace(context.role);
  const canAdmin = context.role === "admin";
  const hasFilters = Boolean(params.product || params.country || params.closing);
  const closingSoon = feed.items.filter(
    (item) => item.effective_status === "closing_soon",
  ).length;

  return (
    <FocusPage>
      <PilotEvent eventName="marketplace_home_viewed" metadata={{ surface: "marketplace_home" }} />
      <FocusHeader
        eyebrow="Marketplace"
        title="Compra o vendi, in un unico spazio"
        description={
          <>
            Usa il Marketplace per cercare fornitori, gestire RFQ multi-fornitore oppure intercettare
            richieste compatibili con ciò che la tua azienda vende.
            <span className="mt-2 block text-xs font-semibold text-[#5d6a65]">
              {feed.total} opportunità aperte · {closingSoon} in scadenza entro 24h nella pagina
            </span>
          </>
        }
      />

      <section className="grid gap-4 lg:grid-cols-2" aria-label="Modalità Marketplace">
        <div className="rounded-3xl border border-[#b8d2c8] bg-[#edf5f2] p-5 sm:p-6">
          <p className="app-kicker">Compra</p>
          <h2 className="mt-2 text-2xl font-semibold text-[#173f35]">
            Chiedi offerte a più fornitori
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-[#52615b]">
            Prepara una richiesta, seleziona i supplier, invia, raccogli le risposte e confronta le
            offerte nello stesso flusso.
          </p>

          <div className="mt-5 grid gap-2 text-sm text-[#43524c] sm:grid-cols-3">
            <div className="rounded-xl border border-[#cfe0d9] bg-white/80 p-3">
              <span className="font-semibold text-[#173f35]">1. Crea</span>
              <p className="mt-1 text-xs leading-5 text-[#5d6a65]">Distinta o RFQ strutturata.</p>
            </div>
            <div className="rounded-xl border border-[#cfe0d9] bg-white/80 p-3">
              <span className="font-semibold text-[#173f35]">2. Invia</span>
              <p className="mt-1 text-xs leading-5 text-[#5d6a65]">Uno o più fornitori.</p>
            </div>
            <div className="rounded-xl border border-[#cfe0d9] bg-white/80 p-3">
              <span className="font-semibold text-[#173f35]">3. Confronta</span>
              <p className="mt-1 text-xs leading-5 text-[#5d6a65]">Risposte e condizioni.</p>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {canWrite ? (
              <Link
                href={appRoutes.marketplace.rfqHub}
                className="app-primary inline-flex min-h-11 items-center rounded-xl px-4 text-sm font-semibold"
              >
                Apri RFQ Hub
              </Link>
            ) : (
              <Link
                href={appRoutes.marketplace.procurementInbox}
                className="app-primary inline-flex min-h-11 items-center rounded-xl px-4 text-sm font-semibold"
              >
                Apri Acquisti
              </Link>
            )}
            <Link
              href={appRoutes.marketplace.myRequests}
              className="app-secondary inline-flex min-h-11 items-center rounded-xl px-4 text-sm font-semibold"
            >
              Le mie richieste
            </Link>
            <Link
              href={appRoutes.marketplace.suppliers}
              className="app-secondary inline-flex min-h-11 items-center rounded-xl px-4 text-sm font-semibold"
            >
              Fornitori
            </Link>
            {canWrite ? (
              <Link
                href={appRoutes.marketplace.procurementIntelligence}
                className="app-secondary inline-flex min-h-11 items-center rounded-xl px-4 text-sm font-semibold"
              >
                Intelligence acquisti
              </Link>
            ) : null}
          </div>
        </div>

        <div className="rounded-3xl border border-[#dce2df] bg-white p-5 sm:p-6">
          <p className="app-kicker">Vendi</p>
          <h2 className="mt-2 text-2xl font-semibold text-[#1d2824]">
            Trova richieste a cui puoi rispondere
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-[#52615b]">
            Esplora le richieste aperte del Network e apri il dettaglio quando una famiglia prodotto,
            l&apos;area o la scadenza sono interessanti per la tua azienda.
          </p>

          <div className="mt-5 rounded-2xl border border-[#e1e7e4] bg-[#f8faf9] p-4">
            <p className="text-sm font-semibold text-[#1d2824]">Non perdere le opportunità rilevanti</p>
            <p className="mt-1 text-xs leading-5 text-[#5d6a65]">
              Usa “Per te” per vedere i match governati dal profilo aziendale e dal perimetro di
              accesso disponibile.
            </p>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <Link
              href="#opportunita"
              className="app-primary inline-flex min-h-11 items-center rounded-xl px-4 text-sm font-semibold"
            >
              Esplora opportunità
            </Link>
            <Link
              href={appRoutes.marketplace.notifications}
              className="app-secondary inline-flex min-h-11 items-center rounded-xl px-4 text-sm font-semibold"
            >
              Opportunità per te
            </Link>
          </div>
        </div>
      </section>

      <details className="rounded-2xl border border-[#dce2df] bg-white">
        <summary className="cursor-pointer list-none px-5 py-3.5 text-sm font-semibold text-[#43524c]">
          Verifica accesso e profilo Marketplace
        </summary>
        <div className="border-t border-[#e7ece9] p-3">
          <MarketplaceReadinessPanel readiness={readiness} />
        </div>
      </details>

      <section id="opportunita" className="scroll-mt-36">
        <FocusSectionHeader
          eyebrow="Vendi"
          title="Opportunità aperte"
          description="Filtra il mercato per prodotto, consegna e tempo residuo."
          action={
            <Link
              href={appRoutes.marketplace.notifications}
              className="text-sm font-semibold text-[#173f35] hover:underline"
            >
              Vedi quelle per te →
            </Link>
          }
        />

        <form
          method="get"
          className="grid gap-3 rounded-2xl border border-[#dce2df] bg-white p-4 md:grid-cols-[1.4fr_0.7fr_0.8fr_auto] md:items-end"
        >
          <div>
            <label
              htmlFor="marketplace-product-filter"
              className="text-xs font-bold uppercase tracking-[0.12em] text-[#5d6a65]"
            >
              Prodotto
            </label>
            <select
              id="marketplace-product-filter"
              name="product"
              defaultValue={params.product || ""}
              className="mt-2 h-11 w-full rounded-xl border border-[#d7dfdb] bg-white px-3 text-sm text-[#43524c] outline-none focus:border-[#438d7a] focus:ring-4 focus:ring-[#e1ece8]"
            >
              <option value="">Tutte le famiglie</option>
              {taxonomy.product_families.map((item) => (
                <option key={item.id} value={item.key}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="marketplace-country-filter"
              className="text-xs font-bold uppercase tracking-[0.12em] text-[#5d6a65]"
            >
              Paese consegna
            </label>
            <input
              id="marketplace-country-filter"
              name="country"
              defaultValue={params.country || ""}
              maxLength={2}
              placeholder="IT"
              className="mt-2 h-11 w-full rounded-xl border border-[#d7dfdb] px-3 text-sm uppercase text-[#43524c] outline-none focus:border-[#438d7a] focus:ring-4 focus:ring-[#e1ece8]"
            />
          </div>

          <div>
            <label
              htmlFor="marketplace-closing-filter"
              className="text-xs font-bold uppercase tracking-[0.12em] text-[#5d6a65]"
            >
              Scadenza
            </label>
            <select
              id="marketplace-closing-filter"
              name="closing"
              defaultValue={params.closing || ""}
              className="mt-2 h-11 w-full rounded-xl border border-[#d7dfdb] bg-white px-3 text-sm text-[#43524c] outline-none focus:border-[#438d7a] focus:ring-4 focus:ring-[#e1ece8]"
            >
              <option value="">Tutte aperte</option>
              <option value="24">Entro 24 ore</option>
              <option value="72">Entro 3 giorni</option>
              <option value="168">Entro 7 giorni</option>
            </select>
          </div>

          <button className="app-primary h-11 rounded-xl px-5 text-sm font-semibold">Filtra</button>
        </form>

        <div className="mt-4">
          {feed.items.length === 0 ? (
            hasFilters ? (
              <FirstUseEmptyState
                eyebrow="Filtri senza risultati"
                title="Nessuna opportunità corrisponde ai filtri"
                description="Azzera prodotto, paese e scadenza per tornare a tutte le opportunità disponibili."
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
                title="Nessuna opportunità aperta in questo momento"
                description="Puoi comunque lavorare lato acquisti oppure completare il profilo tecnico per ricevere match migliori quando arrivano nuove richieste."
                primaryAction={
                  canWrite
                    ? {
                        href: appRoutes.marketplace.rfqHub,
                        label: "Apri RFQ Hub",
                      }
                    : {
                        href: appRoutes.marketplace.procurementInbox,
                        label: "Apri Acquisti",
                      }
                }
                secondaryAction={
                  canAdmin
                    ? {
                        href: appRoutes.network.manage,
                        label: "Completa Company Profile",
                      }
                    : {
                        href: appRoutes.marketplace.notifications,
                        label: "Opportunità per te",
                      }
                }
                note="Commercial Memory e Marketplace restano separati: nessuna RFQ privata viene pubblicata automaticamente."
              />
            )
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {feed.items.map((item) => {
                const firstLine = item.teaser_lines[0];

                return (
                  <Link
                    key={item.request_id}
                    href={appRoutes.marketplace.opportunity(item.request_id)}
                    className="group rounded-2xl border border-[#dce2df] bg-white p-5 transition hover:border-[#b8d2c8] hover:shadow-sm"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={[
                              "rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em]",
                              item.effective_status === "closing_soon"
                                ? "bg-amber-50 text-amber-800"
                                : "bg-emerald-50 text-emerald-800",
                            ].join(" ")}
                          >
                            {item.effective_status === "closing_soon" ? "In scadenza" : "Aperta"}
                          </span>
                          <span className="rounded-full bg-[#f2f4f3] px-2.5 py-1 text-[10px] font-semibold text-[#5d6a65]">
                            {buyerLabel(item)}
                          </span>
                        </div>

                        <h3 className="mt-3 text-lg font-semibold text-[#1d2824]">
                          {opportunityHeadline(item)}
                        </h3>
                        <p className="mt-1 text-sm text-[#5d6a65]">{deliveryLabel(item)}</p>
                      </div>

                      <div className="text-right">
                        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#5d6a65]">
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
                          <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#5d6a65]">
                            Processo
                          </p>
                          <p className="mt-1 text-sm font-semibold text-[#43524c]">
                            {firstLine.manufacturing_process || "Non specificato"}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#5d6a65]">
                            Quantità
                          </p>
                          <p className="mt-1 text-sm font-semibold text-[#43524c]">
                            {firstLine.quantity_band}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#5d6a65]">
                            Consegna
                          </p>
                          <p className="mt-1 text-sm font-semibold text-[#43524c]">
                            {firstLine.delivery_country_code}
                            {firstLine.delivery_region ? ` · ${firstLine.delivery_region}` : ""}
                          </p>
                        </div>
                      </div>
                    ) : null}

                    <div className="mt-4 flex items-center justify-between text-xs">
                      <span className="text-[#5d6a65]">
                        {item.line_count} {item.line_count === 1 ? "linea prodotto" : "linee prodotto"}
                      </span>
                      <span className="font-semibold text-[#173f35] group-hover:underline">
                        Apri opportunità →
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-[#d9e8e2] bg-[#f3f7f5] px-5 py-4">
        <p className="text-sm font-semibold text-[#173f35]">Informazioni protette</p>
        <p className="mt-1 text-sm leading-6 text-[#52615b]">
          Il Marketplace mostra solo le informazioni consentite dal livello di accesso e dalla
          modalità di pubblicazione della richiesta. I dettagli commerciali privati e la Commercial
          Memory della tua azienda restano separati.
        </p>
      </section>
    </FocusPage>
  );
}
