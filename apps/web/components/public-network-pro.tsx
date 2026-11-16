import Link from "next/link";

import { getPublicNetworkCounts } from "@/lib/public-network-counts";

/**
 * HOME-NETPRO-PUBLIC1 (founder decision, 16 Nov 2026): Network PRO advertising
 * on the public home, in the same style as the workspace card. Server components
 * on a statically generated page: real published totals (or no numbers), no
 * price on public pages, CTA to registration.
 */
const fmt = (value: number) => value.toLocaleString("it-IT");

export async function PublicNetworkProPill() {
  const counts = await getPublicNetworkCounts();
  return (
    <a href="#network-pro" data-testid="public-network-pro-pill"
      className="mt-5 inline-flex max-w-full items-center gap-2 rounded-full border border-white/20 bg-white/[0.08] py-1.5 pl-1.5 pr-3.5 text-xs font-semibold text-[#e3f1ea] backdrop-blur transition-colors hover:bg-white/[0.14] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8af3c0]">
      <span className="shrink-0 rounded-full bg-[#f2b544] px-2 py-0.5 text-[10px] font-extrabold tracking-[0.06em] text-[#3a2600]">NOVITÀ · PRO</span>
      <span className="min-w-0 truncate">
        Network{counts ? ": " + fmt(counts.total) + " aziende della filiera" : " della filiera dell’acciaio"} · Intelligence Produttori
      </span>
      <span aria-hidden="true" className="shrink-0">→</span>
    </a>
  );
}

function Check() {
  return (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f2b544" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0">
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}

export async function PublicNetworkProShowcase() {
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
    <div id="network-pro" data-testid="public-network-pro-showcase"
      className="relative mb-10 scroll-mt-24 overflow-hidden rounded-[26px] bg-[#123a2e] p-6 text-white shadow-[0_18px_44px_rgba(18,58,46,0.25)] sm:p-8">
      <svg aria-hidden="true" width="300" height="300" viewBox="0 0 300 300" className="pointer-events-none absolute -right-20 -top-24 opacity-[0.12]">
        <circle cx="150" cy="150" r="126" fill="none" stroke="#9fd3bc" strokeWidth="24" />
        <circle cx="150" cy="150" r="74" fill="none" stroke="#9fd3bc" strokeWidth="15" />
      </svg>
      <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:items-start">
        <div>
          <p className="flex flex-wrap items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#a9dcc5]">
            Network <span className="rounded-[5px] bg-[#f2b544] px-1.5 py-px text-[10px] tracking-[0.06em] text-[#3a2600]">PRO</span> · La filiera dell’acciaio
          </p>
          <h2 className="mt-3 text-[28px] font-extrabold leading-[1.12] tracking-tight sm:text-[36px]">
            Tutta la filiera dell’acciaio. Una sola ricerca.
          </h2>
          {counts ? (
            <div className="mt-6" data-testid="public-network-pro-counts">
              <p className="text-[52px] font-extrabold leading-none tracking-tight tabular-nums text-[#f2b544]">{fmt(counts.total)}</p>
              <p className="mt-2 text-base font-semibold">aziende della filiera già nel Network</p>
              <p className="text-sm text-[#b8d9ca]">di cui {fmt(counts.italy)} in Italia · nuove aziende ogni giorno</p>
              <dl className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                {tiles.map((tile) => (
                  <div key={tile.label} className="rounded-2xl border border-white/10 bg-white/[0.06] px-3.5 py-3">
                    <dd className="text-2xl font-extrabold tabular-nums">{fmt(tile.value)}</dd>
                    <dt className="text-xs leading-4 text-[#cdebdd]">{tile.label}</dt>
                  </div>
                ))}
              </dl>
            </div>
          ) : (
            <p className="mt-4 max-w-xl text-sm leading-6 text-[#d3e7dd]">
              Produttori, commercianti, carpenterie e utilizzatori industriali della filiera, in un’unica ricerca.
            </p>
          )}
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 sm:p-6">
          <p className="text-sm font-extrabold">Cosa ottieni con Network PRO</p>
          <ul className="mt-3 space-y-2.5 text-sm leading-6 text-[#e3f1ea]">
            <li className="flex gap-2.5"><Check /><span><strong className="text-white">Intelligence Produttori</strong>: cataloghi ufficiali, dati tecnici con fonte e confronto fino a 3 aziende.</span></li>
            <li className="flex gap-2.5"><Check /><span><strong className="text-white">Mappa dei commercianti</strong>: stockholder, distributori, grossisti e trader.</span></li>
            <li className="flex gap-2.5"><Check /><span><strong className="text-white">Filtri avanzati</strong> per ruolo, prodotto, capability, mercato e zona.</span></li>
            <li className="flex gap-2.5"><Check /><span><strong className="text-white">Contatti diretti</strong> con le aziende e fornitori trovati portati nelle tue RFQ.</span></li>
          </ul>
          <div className="mt-6 flex flex-wrap gap-2">
            <Link href="/register" data-testid="public-network-pro-register"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#f2b544] px-5 text-sm font-extrabold text-[#2a1c00] transition-colors hover:bg-[#f6c460] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f2b544]">
              Registra l’azienda e attiva il Network <span aria-hidden="true">→</span>
            </Link>
            <Link href="/login"
              className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/30 px-5 text-sm font-bold text-white transition-colors hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
              Accedi
            </Link>
          </div>
          <p className="mt-3 text-xs leading-5 text-[#9fc7b6]">
            Il profilo aziendale è gratuito. Network PRO si attiva dal workspace, scegliendo i moduli che ti servono.
          </p>
        </div>
      </div>
    </div>
  );
}
