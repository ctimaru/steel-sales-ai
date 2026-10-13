import Link from "next/link";
import { DashboardTrackedLink } from "@/components/dashboard-tracked-link";

import {
  selectDashboardFollowedUpdates,
  selectDashboardOpportunities,
} from "@/lib/dashboard-discovery";
import type { MarketplaceFeedResponse } from "@/lib/marketplace";
import type { NetworkActivityItem } from "@/lib/network";
import type { PulseAdvancedInterests } from "@/lib/steel-pulse-advanced";
import { appRoutes } from "@/lib/routes";

export function DashboardDiscoveryFeed({
  networkEnabled, networkEntitled, activity, marketplace, interests,
}: {
  networkEnabled: boolean;
  networkEntitled: boolean;
  activity: readonly NetworkActivityItem[];
  marketplace: MarketplaceFeedResponse | null;
  interests: PulseAdvancedInterests;
}) {
  const updates = networkEntitled ? selectDashboardFollowedUpdates(activity) : [];
  const opportunities = marketplace?.contract === "P5.2-feed-v1"
    ? selectDashboardOpportunities(marketplace.items, interests)
    : [];
  const hasUpdates = updates.length > 0;
  const hasOpportunities = opportunities.length > 0;

  return (
    <section id="dashboard-discovery" aria-labelledby="dashboard-discovery-heading" className="min-w-0 scroll-mt-24 space-y-4">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#22634f]">Network e Marketplace</p>
        <h2 id="dashboard-discovery-heading" className="mt-1 text-xl font-semibold tracking-tight text-[#173f35]">
          Dalla rete, per te
        </h2>
        <p className="mt-1 text-sm text-[#52615b]">
          Aggiornamenti pubblicati dalle aziende seguite e opportunità consultabili con il tuo accesso.
        </p>
      </div>

      {hasUpdates ? (
        <div className="space-y-2" aria-label="Aggiornamenti dalle aziende seguite">
          {updates.map((item) => (
            <article key={item.id} className="min-w-0 break-words rounded-2xl border border-[#d7e3dc] bg-white p-4">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded-full bg-[#edf3fa] px-2.5 py-1 font-semibold text-[#365a81]">Network · Segui</span>
                {item.unread ? <span className="font-semibold text-[#195543]">Nuovo</span> : null}
                <time dateTime={item.occurredAt} className="ml-auto text-[#52615b]">
                  {new Intl.DateTimeFormat("it-IT", {dateStyle:"medium",timeZone:"Europe/Rome"}).format(new Date(item.occurredAt))}
                </time>
              </div>
              <h3 className="mt-2 text-base font-semibold text-[#173f35]">{item.companyName}</h3>
              <p className="mt-1 text-sm leading-6 text-[#43554d]">{item.summary}</p>
              <DashboardTrackedLink engagementKind="network_profile" href={appRoutes.network.company(item.companyId)} className="mt-3 inline-flex min-h-11 items-center text-xs font-semibold text-[#175640] underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#246a50]">
                Apri profilo pubblico →
              </DashboardTrackedLink>
            </article>
          ))}
          <Link href={appRoutes.network.activity} className="inline-flex min-h-11 items-center text-xs font-semibold text-[#175640] underline underline-offset-4">
            Tutte le attività delle aziende seguite →
          </Link>
        </div>
      ) : networkEnabled && networkEntitled ? (
        <div className="rounded-xl border border-dashed border-[#c9dbd1] bg-white px-4 py-3">
          <p className="text-xs leading-5 text-[#52615b]">
            Nessun nuovo aggiornamento dalle aziende seguite. Segui un’azienda per ricevere le sue prossime pubblicazioni.
          </p>
          <Link href={appRoutes.network.following} className="inline-flex min-h-10 items-center text-xs font-semibold text-[#175640] underline underline-offset-4">Gestisci aziende seguite →</Link>
        </div>
      ) : networkEnabled ? (
        <div className="rounded-xl border border-[#d9e5dd] bg-white px-4 py-3">
          <p className="text-xs leading-5 text-[#52615b]">
            Gli aggiornamenti delle aziende seguite diventano disponibili quando il Network è abilitato per la tua organizzazione.
          </p>
          <Link href={appRoutes.network.directory} className="inline-flex min-h-10 items-center text-xs font-semibold text-[#175640] underline underline-offset-4">Scopri il Network →</Link>
        </div>
      ) : null}

      <div className="space-y-2" aria-label="Opportunità Marketplace visibili">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-base font-semibold text-[#173f35]">Opportunità Marketplace</h3>
          <Link href={appRoutes.marketplace.home} className="inline-flex min-h-10 items-center text-xs font-semibold text-[#175640] underline underline-offset-4">
            Esplora tutte →
          </Link>
        </div>
        {hasOpportunities ? opportunities.map((item) => (
          <article key={item.id} className="min-w-0 break-words rounded-2xl border border-[#d7e3dc] bg-white p-4">
            <div className="flex flex-wrap items-center gap-2 text-xs text-[#52615b]">
              <span className="rounded-full bg-[#eaf5ee] px-2.5 py-1 font-semibold text-[#205b45]">Marketplace · Teaser pubblico</span>
              <span>{item.anonymousBuyer ? "Buyer riservato" : "Buyer visibile"}</span>
              {item.closingSoon ? <span className="font-semibold text-[#815017]">In scadenza</span> : null}
            </div>
            <h4 className="mt-2 text-base font-semibold text-[#173f35]">
              {item.product}{item.lineCount > 1 ? ` + ${item.lineCount - 1} linee` : ""}
            </h4>
            <p className="mt-1 text-sm text-[#52615b]">Consegna: {item.delivery}</p>
            {item.reason ? <p className="mt-2 text-xs font-medium text-[#246c53]">Per te: {item.reason}</p> : null}
            <DashboardTrackedLink engagementKind="marketplace_teaser" href={appRoutes.marketplace.opportunity(item.id)} className="mt-2 inline-flex min-h-11 items-center text-xs font-semibold text-[#175640] underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#246a50]">
              Apri opportunità e verifica l’accesso →
            </DashboardTrackedLink>
          </article>
        )) : (
          <div className="rounded-xl border border-dashed border-[#c9dbd1] bg-white px-4 py-3">
            <p role="status" className="text-xs leading-5 text-[#52615b]">
              {marketplace === null ? "Il Marketplace non è disponibile in questo momento."
                : "Nessuna opportunità pubblicabile e visibile al momento."}
            </p>
          </div>
        )}
        <p className="text-[11px] leading-5 text-[#65746c]">
          Sono mostrati soltanto teaser consentiti dal Marketplace. Le RFQ private e i dettagli riservati non compaiono nella Home;
          l’accesso al dettaglio e alle risposte viene sempre verificato nella pagina di destinazione.
        </p>
      </div>
    </section>
  );
}
