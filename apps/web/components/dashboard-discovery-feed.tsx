import Link from "next/link";
import { DashboardTrackedLink } from "@/components/dashboard-tracked-link";

import { selectDashboardOpportunities } from "@/lib/dashboard-discovery";
import type { MarketplaceFeedResponse } from "@/lib/marketplace";
import type { NetworkActivityItem } from "@/lib/network";
import type { PulseAdvancedInterests } from "@/lib/steel-pulse-advanced";
import type { DashboardNetworkMatch } from "@/lib/dashboard-network-discovery";
import type { FreeNetworkPreview } from "@/lib/dashboard-free-network-preview";
import { appRoutes } from "@/lib/routes";

/**
 * DASH-NEXT1C.1 — Compact, permission-aware discovery radar.
 * Reads only the existing approved P4 activity and P5.2 public teaser contracts.
 * This is not a generated AI recommendation, urgency queue, or a private RFQ feed.
 */
export function DashboardDiscoveryFeed({
  networkEnabled, networkEntitled, marketplace, interests, networkCompanies, networkDiscoveryAvailable, canWriteCommercial,
  freeNetworkReadEnabled = false, freeNetworkPreview = null,
}: {
  networkEnabled: boolean;
  networkEntitled: boolean;
  /** Kept for call-site compatibility; followed-company updates were removed (NET-UX LOT1). */
  activity?: readonly NetworkActivityItem[];
  marketplace: MarketplaceFeedResponse | null;
  interests: PulseAdvancedInterests;
  networkCompanies: readonly DashboardNetworkMatch[];
  networkDiscoveryAvailable: boolean;
  canWriteCommercial: boolean;
  /** HOME-NETPREVIEW1: free read of the published Network is on for this non-Pro organization. */
  freeNetworkReadEnabled?: boolean;
  /** HOME-NETPREVIEW1: first published page from the free browse RPC, or null if unavailable. */
  freeNetworkPreview?: FreeNetworkPreview | null;
}) {
  const opportunities = marketplace?.contract === "P5.2-feed-v1"
    ? selectDashboardOpportunities(marketplace.items, interests, 2)
    : [];

  return (
    <section
      id="dashboard-discovery"
      aria-labelledby="dashboard-discovery-heading"
      data-testid="dashboard-opportunity-radar"
      className="min-w-0 scroll-mt-24 space-y-3"
    >
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#22634f]">Network e Marketplace</p>
          <h2 id="dashboard-discovery-heading" className="mt-0.5 text-base font-semibold tracking-tight text-[#173f35]">
            Dalla rete, per te
          </h2>
          <p className="mt-0.5 text-xs leading-5 text-[#52615b]">
            Aziende pertinenti e opportunità consultabili con il tuo accesso.
          </p>
        </div>
      </div>

      <div className={networkEnabled ? "grid min-w-0 gap-3 md:grid-cols-2" : "grid min-w-0 gap-3"}>
        {networkEnabled ? (
          <section aria-label="Network industriale" className="min-w-0 rounded-xl border border-[#d5e4da] bg-[#f9fcfa] p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-[#173f35]">Network industriale</h3>
              <Link
                href={networkEntitled ? appRoutes.network.connections : appRoutes.network.directory}
                className="inline-flex min-h-10 items-center text-xs font-semibold text-[#175640] underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                {networkEntitled ? "Le mie connessioni →" : "Esplora Network →"}
              </Link>
            </div>
            {networkEntitled ? (
              <div aria-label="Aziende pertinenti dal catalogo Network" className="mt-2 rounded-lg border border-[#dbe9df] bg-white px-3 py-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="text-xs font-semibold text-[#173f35]">Aziende da esplorare</h4>
                  <Link
                    href={appRoutes.network.directory + "?product=tubes_pipes&advanced=1"}
                    className="inline-flex min-h-10 items-center text-[11px] font-semibold text-[#175640] underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2"
                  >
                    Ricerca completa →
                  </Link>
                </div>
                {networkCompanies.length > 0 ? (
                  <div className="divide-y divide-[#e5eee8]">
                    {networkCompanies.slice(0, 2).map((company) => (
                      <article key={company.id} className="min-w-0 py-2">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <h5 className="min-w-0 flex-1 break-words text-xs font-semibold text-[#173f35]">{company.name}</h5>
                          <span className="shrink-0 text-[10px] font-medium text-[#53665b]">
                            {company.verifiedProfile ? "Identità verificata" : "Scheda pubblicata"}
                          </span>
                        </div>
                        <p className="mt-0.5 break-words text-xs leading-5 text-[#52615b]">
                          {company.category ? company.category + " · " : ""}{company.countryCode} · Prodotto a catalogo: {company.product}
                        </p>
                        {company.capability ? (
                          <p className="line-clamp-1 text-[11px] leading-4 text-[#53665b]">Capacità a catalogo: {company.capability}</p>
                        ) : null}
                        {company.reasons.length > 0 ? (
                          <p className="mt-0.5 line-clamp-2 text-[11px] leading-4 text-[#246c53]">
                            Perché compare: {company.reasons.join(" · ")}
                          </p>
                        ) : null}
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          <DashboardTrackedLink
                            engagementKind="network_profile"
                            href={appRoutes.network.company(company.id)}
                            className="inline-flex min-h-10 items-center text-xs font-semibold text-[#175640] underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2"
                          >
                            Profilo Network →
                          </DashboardTrackedLink>
                          <Link
                            href={appRoutes.commercial.home + "?network=" + encodeURIComponent(company.id) +
                              (canWriteCommercial ? "&compose=1#commercial-compose" : "#network-commercial-context")}
                            className="inline-flex min-h-10 items-center rounded-lg border border-[#a9cdb7] bg-[#eff7f2] px-2.5 text-xs font-semibold text-[#175640] hover:bg-[#e2f0e7] focus-visible:outline-2 focus-visible:outline-offset-2"
                          >
                            {canWriteCommercial ? "Prepara richiesta →" : "Consulta in Commerciale →"}
                          </Link>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <p role="status" className="mt-1 text-xs leading-5 text-[#52615b]">
                    {networkDiscoveryAvailable
                      ? "Nessuna azienda pertinente nei primi risultati pubblicati. Usa i filtri Network per ampliare la ricerca."
                      : "La ricerca delle aziende non è disponibile adesso. Il Network completo rimane consultabile."}
                  </p>
                )}
                <p className="text-[10px] leading-4 text-[#65746c]">
                  Selezione dai primi risultati pubblicati; prodotti e capacità a catalogo non attestano l’idoneità tecnica per una RFQ.
                </p>
              </div>
            ) : null}
            {/* NET-UX LOT1: Segui/Salva removed by founder decision (2 Nov 2026); the
                Network relationship is Connetti only. */}
            {!networkEntitled && freeNetworkReadEnabled ? (
              <div aria-label="Aziende pubblicate nel Network" data-testid="dashboard-free-network-preview" className="mt-2 rounded-lg border border-[#dbe9df] bg-white px-3 py-2">
                {freeNetworkPreview && freeNetworkPreview.companies.length > 0 ? (
                  <>
                    <ul className="divide-y divide-[#e5eee8]">
                      {freeNetworkPreview.companies.map((company) => (
                        <li key={company.id} className="min-w-0 py-1">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <DashboardTrackedLink
                              engagementKind="network_profile"
                              href={appRoutes.network.company(company.id)}
                              className="inline-flex min-h-10 min-w-0 flex-1 items-center break-words text-xs font-semibold text-[#173f35] underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
                            >
                              {company.name}
                            </DashboardTrackedLink>
                            {company.verified ? (
                              <span className="shrink-0 text-[10px] font-medium text-[#53665b]">Identità verificata</span>
                            ) : null}
                          </div>
                          {company.role || company.place ? (
                            <p className="mt-0.5 break-words text-[11px] leading-4 text-[#52615b]">
                              {[company.role, company.place].filter(Boolean).join(" · ")}
                            </p>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                    <Link
                      href={appRoutes.network.directory}
                      className="inline-flex min-h-10 items-center text-xs font-semibold text-[#175640] underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2"
                    >
                      {freeNetworkPreview.total > freeNetworkPreview.companies.length
                        ? "Vedi tutte le " + freeNetworkPreview.total.toLocaleString("it-IT") + " aziende →"
                        : "Apri il Network →"}
                    </Link>
                    <p className="text-[10px] leading-4 text-[#65746c]">
                      Prime aziende pubblicate nel Network; l’elenco non è una selezione di fornitori per una RFQ.
                    </p>
                  </>
                ) : (
                  <p role="status" className="text-xs leading-5 text-[#52615b]">
                    {freeNetworkPreview
                      ? "Nessuna azienda pubblicata al momento. Il Network completo rimane consultabile."
                      : "L’anteprima delle aziende non è disponibile adesso. Il Network completo rimane consultabile."}
                  </p>
                )}
              </div>
            ) : null}
            {!networkEntitled && !freeNetworkReadEnabled ? (
              <p role="status" className="mt-2 rounded-lg bg-white px-3 py-2 text-xs leading-5 text-[#52615b]">
                Il Network diventa disponibile quando è abilitato per la tua organizzazione.
              </p>
            ) : null}
          </section>
        ) : null}

        <section aria-label="Opportunità Marketplace visibili" className="min-w-0 rounded-xl border border-[#d5e4da] bg-white p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-[#173f35]">Opportunità Marketplace</h3>
            <Link href={appRoutes.marketplace.home} className="inline-flex min-h-10 items-center text-xs font-semibold text-[#175640] underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2">
              Esplora tutte →
            </Link>
          </div>
          {opportunities.length > 0 ? (
            <div className="mt-1 divide-y divide-[#e3eee6]">
              {opportunities.map((item) => (
                <article key={item.id} className="min-w-0 py-2">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <h4 className="min-w-0 flex-1 break-words text-xs font-semibold text-[#173f35]">
                      {item.product}{item.lineCount > 1 ? " + " + (item.lineCount - 1) + " linee" : ""}
                    </h4>
                    {item.closingSoon ? <span className="shrink-0 rounded-full bg-[#fff2df] px-2 py-0.5 text-[10px] font-semibold text-[#815017]">In scadenza</span> : null}
                  </div>
                  <p className="mt-0.5 text-xs leading-5 text-[#52615b]">
                    {item.anonymousBuyer ? "Buyer riservato" : "Buyer visibile"} · Consegna: {item.delivery}
                  </p>
                  {item.reason ? <p className="text-[11px] leading-4 text-[#246c53]">Interessi dichiarati: {item.reason.toLowerCase()}</p> : null}
                  <DashboardTrackedLink
                    engagementKind="marketplace_teaser"
                    href={appRoutes.marketplace.opportunity(item.id)}
                    className="inline-flex min-h-10 items-center text-xs font-semibold text-[#175640] underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2"
                  >
                    Apri opportunità e verifica l’accesso →
                  </DashboardTrackedLink>
                </article>
              ))}
            </div>
          ) : (
            <p role="status" className="mt-2 rounded-lg bg-[#f9fcfa] px-3 py-3 text-xs leading-5 text-[#52615b]">
              {marketplace === null ? "Il Marketplace non è disponibile in questo momento."
                : "Nessuna opportunità pubblicabile e visibile al momento."}
            </p>
          )}
        </section>
      </div>
      <p className="text-[10px] leading-4 text-[#64746a]">
        Mostriamo solo attività autorizzate e teaser pubblici. Le RFQ private e i dettagli riservati non compaiono nella Home;
        l’accesso al dettaglio e alle risposte viene sempre verificato nella pagina di destinazione.
      </p>
    </section>
  );
}
