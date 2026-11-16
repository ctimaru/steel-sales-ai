import Link from "next/link";

import { NETWORK_PRO_PRICE_BOOK } from "@/lib/network-pro-catalog";

/**
 * One visible and consistent entry point from Free and PRO Network.
 * This is navigation only: the destination checks producers/IT entitlement
 * server-side before returning any manufacturer data.
 *
 * NET-PRO-UX2 (founder request, 16 Nov 2026): one strip with the two PRO
 * entries side by side — Intelligence Produttori (primary) and Moduli e prezzi
 * (starting price from the same proposed price book as /network/pro).
 * No data reads here, so it never slows the Network page down.
 */
const startingMonthlyPrice = Math.min(
  ...Object.values(NETWORK_PRO_PRICE_BOOK.IT).filter((price) => price > 0),
);

function FactoryIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 21V11l6 4v-4l6 4V5h4v16z" />
      <path d="M7 18h2M12 18h2" />
    </svg>
  );
}

export function NetworkProducersEntry(){
  return (
    <section
      aria-label="Intelligence Produttori"
      data-testid="network-producers-entry"
      className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1.75fr)_minmax(0,1fr)]"
    >
      <div className="relative min-w-0 overflow-hidden rounded-2xl bg-[#123a2e] p-4 text-white shadow-[0_10px_28px_rgba(18,58,46,0.18)] sm:p-5">
        <svg aria-hidden="true" width="180" height="180" viewBox="0 0 180 180" className="pointer-events-none absolute -right-12 -top-16 opacity-[0.13]">
          <circle cx="90" cy="90" r="76" fill="none" stroke="#9fd3bc" strokeWidth="16" />
          <circle cx="90" cy="90" r="44" fill="none" stroke="#9fd3bc" strokeWidth="10" />
        </svg>
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-3.5">
            <span aria-hidden="true" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/10 text-[#f2b544]">
              <FactoryIcon />
            </span>
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#a9dcc5]">
                Network <span className="rounded-[4px] bg-[#f2b544] px-1 py-px text-[9px] tracking-[0.06em] text-[#3a2600]">PRO</span> · Incluso nel modulo Produttori
              </p>
              <h2 className="mt-1 text-lg font-extrabold leading-6 tracking-tight">Intelligence Produttori</h2>
              <p className="mt-1 max-w-[560px] text-[13px] leading-5 text-[#d3e7dd]">
                Cerca e confronta produttori, cataloghi, norme e gamme con fonti ufficiali.
              </p>
              <ul className="mt-2.5 flex flex-wrap gap-1.5 text-[11px] font-semibold text-[#e3f1ea]">
                <li className="rounded-full border border-white/15 bg-white/[0.07] px-2.5 py-1">Cataloghi ufficiali</li>
                <li className="rounded-full border border-white/15 bg-white/[0.07] px-2.5 py-1">Dati tecnici con fonte</li>
                <li className="rounded-full border border-white/15 bg-white/[0.07] px-2.5 py-1">Confronto fino a 3</li>
              </ul>
            </div>
          </div>
          <Link href="/network/pro/producers"
            data-testid="network-producers-entry-link" style={{ color: "#2a1c00", WebkitTextFillColor: "#2a1c00" }}
            className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#f2b544] px-4 text-sm font-extrabold text-[#2a1c00] transition-colors hover:bg-[#f6c460] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f2b544]"
          >
            Esplora produttori
            <span aria-hidden="true">→</span>
          </Link>
        </div>
      </div>

      <Link href="/network/pro" data-testid="network-pro-plans-entry"
        className="group flex min-w-0 flex-col justify-between gap-3 rounded-2xl border border-[#efdcae] bg-[#fffaf0] p-4 transition-colors hover:border-[#e2c06b] hover:bg-[#fff5df] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#175640] sm:p-5">
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#7a5300]">Network PRO · Moduli e prezzi</p>
          <p className="mt-1 text-base font-extrabold leading-6 text-[#173f35]">Paghi solo i moduli che ti servono</p>
          <p className="mt-1 text-xs leading-5 text-[#5b5340]">Produttori, Commercianti, Carpenterie, Utilizzatori · Italia o Europa</p>
        </div>
        <div className="flex items-end justify-between gap-2">
          <p className="leading-none text-[#173f35]">
            <span className="text-[11px] text-[#5b5340]">da </span>
            <span className="text-[22px] font-extrabold tabular-nums">{startingMonthlyPrice} €</span>
            <span className="text-[11px] text-[#5b5340]"> / mese · IVA esclusa</span>
          </p>
          <span className="inline-flex items-center gap-1 text-xs font-extrabold text-[#175640] group-hover:underline">
            Configura <span aria-hidden="true">→</span>
          </span>
        </div>
      </Link>
    </section>
  );
}
