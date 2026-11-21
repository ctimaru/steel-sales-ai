import Link from "next/link";

import { NETWORK_PRO_PRICE_BOOK } from "@/lib/network-pro-catalog";
import type { NetworkProCoverage } from "@/lib/network-pro-coverage";
import { appRoutes } from "@/lib/routes";

/**
 * HOME-NETPRO2 (founder request, 16 Nov 2026): strong marketing card that sells
 * Network PRO from the Home right rail, with the Network's real numbers.
 *
 * Presentation only. Access is decided server-side by the existing entitlement
 * (pa1_3_network_access_state); this card never grants anything. Every number
 * comes from netpro1b_catalog_coverage (published companies, per module); when
 * coverage is unavailable the numbers are hidden, never estimated. The starting
 * price is read from the same proposed price book as /network/pro.
 */
export type NetworkProCardStats = {
  total: number;
  italy: number;
  countries: number;
  producers: number;
  distributors: number;
  processors: number;
  endUsers: number;
};

export function summarizeNetworkProCoverage(coverage: NetworkProCoverage | null): NetworkProCardStats | null {
  if (!coverage || coverage.countries.length === 0) return null;
  const stats: NetworkProCardStats = {
    total: 0, italy: 0, countries: coverage.countries.length,
    producers: 0, distributors: 0, processors: 0, endUsers: 0,
  };
  for (const country of coverage.countries) {
    stats.total += country.published;
    if (country.countryCode === "IT") stats.italy += country.published;
    stats.producers += country.publishedModules.producers;
    stats.distributors += country.publishedModules.distributors;
    stats.processors += country.publishedModules.processors;
    stats.endUsers += country.publishedModules.end_users;
  }
  return stats.total > 0 ? stats : null;
}

const startingMonthlyPrice = Math.min(
  ...Object.values(NETWORK_PRO_PRICE_BOOK.IT).filter((price) => price > 0),
);

const fmt = (value: number) => value.toLocaleString("it-IT");

function Check() {
  return (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f2b544" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0">
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}

export function HomeNetworkProCard({
  entitled,
  stats,
}: {
  entitled: boolean;
  stats: NetworkProCardStats | null;
}) {
  const tiles = stats
    ? [
        { label: "Produttori", value: stats.producers },
        { label: "Commercianti", value: stats.distributors },
        { label: "Carpenterie e lavorazioni", value: stats.processors },
        { label: "Utilizzatori industriali", value: stats.endUsers },
      ]
    : [];

  return (
    <section
      aria-labelledby="home-netpro-heading"
      data-testid="home-network-pro-card"
      data-state={entitled ? "entitled" : "locked"}
      className="relative overflow-hidden rounded-2xl bg-[#123a2e] text-white shadow-[0_14px_34px_rgba(18,58,46,0.22)]"
    >
      <svg aria-hidden="true" width="190" height="190" viewBox="0 0 190 190" className="pointer-events-none absolute -right-14 -top-14 opacity-[0.14]">
        <circle cx="95" cy="95" r="80" fill="none" stroke="#9fd3bc" strokeWidth="16" />
        <circle cx="95" cy="95" r="46" fill="none" stroke="#9fd3bc" strokeWidth="10" />
      </svg>

      <div className="relative space-y-4 p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 text-[12px] font-extrabold tracking-[0.14em]">
            NETWORK
            <span className="rounded-[5px] bg-[#f2b544] px-1.5 py-[1px] text-[11px] tracking-[0.06em] text-[#3a2600]">PRO</span>
          </p>
          {entitled ? (
            <span className="rounded-full border border-[#9fd3bc]/40 px-2 py-0.5 text-[10px] font-bold text-[#cdebdd]">Attivo</span>
          ) : null}
        </div>

        <h2 id="home-netpro-heading" className="text-[20px] font-extrabold leading-[1.2] tracking-tight">
          Tutta la filiera dell’acciaio. Una sola ricerca.
        </h2>

        {stats ? (
          <div data-testid="home-network-pro-stats" className="space-y-3">
            <div>
              <p className="text-[40px] font-extrabold leading-none tracking-tight tabular-nums text-[#f2b544]">{fmt(stats.total)}</p>
              <p className="mt-1 text-[13px] font-semibold leading-5 text-white">aziende pubblicate nel Network</p>
              <p className="text-[11.5px] leading-4 text-[#b8d9ca]">
                {stats.italy > 0 ? "di cui " + fmt(stats.italy) + " in Italia · " : ""}nuove aziende ogni giorno
              </p>
            </div>
            <dl className="grid grid-cols-2 gap-2">
              {tiles.map((tile) => (
                <div key={tile.label} className="rounded-xl border border-white/10 bg-white/[0.06] px-2.5 py-2">
                  <dd className="text-[19px] font-extrabold leading-6 tabular-nums">{fmt(tile.value)}</dd>
                  <dt className="text-[10.5px] leading-[14px] text-[#cdebdd]">{tile.label}</dt>
                </div>
              ))}
            </dl>
          </div>
        ) : null}

        <ul className="space-y-2 text-[12.5px] leading-[18px] text-[#e3f1ea]">
          <li className="flex gap-2"><Check /><span><strong className="text-white">Intelligence Produttori</strong>: cataloghi ufficiali, confronto tecnico e ricerca guidata.</span></li>
          <li className="flex gap-2"><Check /><span><strong className="text-white">Mappa dei commercianti</strong>: stockholder, distributori, grossisti e trader.</span></li>
          <li className="flex gap-2"><Check /><span><strong className="text-white">Filtri avanzati</strong> per ruolo, prodotto, capability, mercato e zona.</span></li>
          <li className="flex gap-2"><Check /><span><strong className="text-white">Contatti diretti</strong> con le aziende, dentro la piattaforma.</span></li>
        </ul>

        {entitled ? null : (
          <div className="flex items-end justify-between gap-2 border-t border-white/10 pt-3">
            <p className="text-[11px] leading-4 text-[#b8d9ca]">
              Scegli solo i moduli<br />che ti servono
            </p>
            <p className="text-right leading-none">
              <span className="text-[11px] text-[#b8d9ca]">da </span>
              <span data-testid="home-network-pro-price" className="text-[22px] font-extrabold tabular-nums">{startingMonthlyPrice} €</span>
              <span className="text-[11px] text-[#b8d9ca]"> / mese</span>
              <span className="mt-1 block text-[10px] text-[#9fc7b6]">IVA esclusa</span>
            </p>
          </div>
        )}

        <Link
          href={entitled ? appRoutes.network.directory : appRoutes.network.pro}
          data-testid="home-network-pro-cta"
          style={{ color: "#2a1c00", WebkitTextFillColor: "#2a1c00" }}
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#f2b544] px-3 text-[15px] font-extrabold text-[#2a1c00] hover:bg-[#f6c460] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f2b544]"
        >
          {entitled ? "Apri il Network" : "Passa a Network PRO"}
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14" />
            <path d="M13 6l6 6-6 6" />
          </svg>
        </Link>
        {entitled ? null : (
          <p className="text-center text-[10.5px] leading-4 text-[#9fc7b6]">
            Il profilo della tua azienda resta gratuito.
          </p>
        )}
      </div>
    </section>
  );
}
