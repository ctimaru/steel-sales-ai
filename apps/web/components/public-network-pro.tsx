import Link from "next/link";

import { getPublicNetworkCounts } from "@/lib/public-network-counts";

/**
 * HOME-NETPRO-PUBLIC1/2 (founder decisions, 16 Nov 2026): Network PRO advertising
 * on the public home. PUBLIC2: the card lives in the hero, next to the headline,
 * so title, tools and Network share the first screen. Server component on a
 * statically generated page: real published totals (or no numbers), no price on
 * public pages, CTA to registration.
 */
const fmt = (value: number) => value.toLocaleString("it-IT");

function Check() {
  return (
    <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#f2b544" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" className="mt-[3px] shrink-0">
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}

export async function PublicNetworkProHeroCard() {
  const counts = await getPublicNetworkCounts();
  const tiles = counts
    ? [
        { label: "Produttori", value: counts.producers },
        { label: "Commercianti", value: counts.distributors },
        { label: "Carpenterie e lavorazioni", value: counts.processors },
        { label: "Utilizzatori industriali", value: counts.endUsers },
      ]
    : [];
  return (
    <aside id="network-pro" aria-labelledby="public-network-pro-title" data-testid="public-network-pro-showcase"
      className="relative z-[5] mt-8 w-full max-w-[460px] shrink-0 scroll-mt-24 overflow-hidden rounded-[22px] border border-[#86e8b9]/30 bg-[#0d2c23]/95 p-5 text-white max-[700px]:p-4 shadow-[0_24px_60px_rgba(0,10,8,0.55)] backdrop-blur lg:ml-auto lg:mt-0 lg:w-[440px]">
      <svg aria-hidden="true" width="220" height="220" viewBox="0 0 220 220" className="pointer-events-none absolute -right-16 -top-16 opacity-[0.12]">
        <circle cx="110" cy="110" r="92" fill="none" stroke="#9fd3bc" strokeWidth="18" />
        <circle cx="110" cy="110" r="54" fill="none" stroke="#9fd3bc" strokeWidth="11" />
      </svg>
      {/* HOME-MOBILE-A2: on phones the register CTA comes right after the numbers (order-0),
          benefits and footnote follow (order-1/2). Desktop keeps source order. */}
      <div className="relative flex flex-col">
        <p className="flex flex-wrap items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-[0.12em] text-[#a9dcc5]">
          Network <span className="rounded-[4px] bg-[#f2b544] px-1.5 py-px text-[10px] tracking-[0.06em] text-[#3a2600]">PRO</span> · La filiera dell’acciaio
        </p>
        <h2 id="public-network-pro-title" className="mt-2 text-[22px] font-extrabold leading-[1.15] tracking-tight max-[700px]:text-[20px]">
          Tutta la filiera dell’acciaio. Una sola ricerca.
        </h2>
        {counts ? (
          <div className="mt-4" data-testid="public-network-pro-counts">
            <div className="flex items-baseline gap-3">
              <p className="text-[44px] max-[700px]:text-[40px] font-extrabold leading-none tracking-tight tabular-nums text-[#f2b544]">{fmt(counts.total)}</p>
              <p className="text-[13px] font-semibold leading-4">aziende della filiera<br /><span className="font-normal text-[#b8d9ca]">di cui {fmt(counts.italy)} in Italia</span></p>
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-2">
              {tiles.map((tile) => (
                <div key={tile.label} className="rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2 max-[700px]:py-1.5">
                  <dd className="text-lg font-extrabold leading-6 tabular-nums">{fmt(tile.value)}</dd>
                  <dt className="text-xs leading-4 text-[#cdebdd]">{tile.label}</dt>
                </div>
              ))}
            </dl>
          </div>
        ) : (
          <p className="mt-3 text-sm leading-6 text-[#d3e7dd]">
            Produttori, commercianti, carpenterie e utilizzatori industriali della filiera, in un’unica ricerca.
          </p>
        )}
        <ul className="mt-4 space-y-1.5 text-[13px] leading-5 text-[#e3f1ea] max-[700px]:order-1">
          <li className="flex gap-2"><Check /><span><strong className="text-white">Intelligence Produttori</strong>: cataloghi ufficiali e dati tecnici con fonte</span></li>
          <li className="flex gap-2"><Check /><span><strong className="text-white">Commercianti</strong>: stockholder, distributori e trader</span></li>
          <li className="flex gap-2"><Check /><span><strong className="text-white">Filtri avanzati</strong> per ruolo, prodotto, mercato e zona</span></li>
          <li className="flex gap-2"><Check /><span><strong className="text-white">Contatti diretti</strong> e fornitori portati nelle tue RFQ</span></li>
        </ul>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/register" data-testid="public-network-pro-register" style={{ color: "#2a1c00", WebkitTextFillColor: "#2a1c00" }}
            className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl py-2 text-center bg-[#f2b544] px-4 text-sm font-extrabold text-[#2a1c00] transition-colors hover:bg-[#f6c460] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f2b544]">
            Registra l’azienda e attiva il Network <span aria-hidden="true">→</span>
          </Link>
          <Link href="/login"
            className="inline-flex min-h-11 items-center max-[700px]:hidden justify-center rounded-xl border border-white/30 px-4 text-sm font-bold text-white transition-colors hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
            Accedi
          </Link>
        </div>
        <p className="mt-2.5 text-xs leading-4 text-[#9fc7b6] max-[700px]:order-2">
          Profilo aziendale gratuito. Network PRO si attiva dal workspace, scegliendo i moduli.
        </p>
      </div>
    </aside>
  );
}
