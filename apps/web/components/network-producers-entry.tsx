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

export function NetworkProducersEntry({country="IT"}:{country?:string}={}){
  return (
    <section
      aria-label="Intelligence Produttori"
      data-testid="network-producers-entry"
      className="grid min-w-0 gap-2 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]"
    >
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 rounded-xl bg-[#123a2e] px-3 py-2.5 text-white sm:flex-nowrap">
        <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10 text-[#f2b544] [&_svg]:h-5 [&_svg]:w-5">
          <FactoryIcon />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold text-[#a9dcc5]">Network PRO · Incluso nel modulo Produttori</p>
          <h2 className="text-sm font-extrabold leading-5">Intelligence Produttori</h2>
          <p className="text-[11px] leading-4 text-[#d3e7dd]">Cataloghi, norme e gamme da fonti ufficiali · <Link href="/network/cataloghi" className="font-bold text-white underline underline-offset-2 hover:text-[#f2b544]">Vedi cataloghi</Link></p>
        </div>
        <Link href={"/network/pro/producers?country="+encodeURIComponent(country)}
          data-testid="network-producers-entry-link" style={{ color: "#2a1c00", WebkitTextFillColor: "#2a1c00" }}
          className="inline-flex min-h-11 shrink-0 items-center justify-center gap-1 rounded-lg bg-[#f2b544] px-3 text-xs font-extrabold text-[#2a1c00] hover:bg-[#f6c460] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f2b544]"
        >
          Esplora produttori <span aria-hidden="true">→</span>
        </Link>
      </div>

      <Link href="/network/pro" data-testid="network-pro-plans-entry"
        className="group flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-xl border border-[#efdcae] bg-[#fffaf0] px-3 py-2.5 hover:border-[#e2c06b] hover:bg-[#fff5df] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#175640]">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold text-[#7a5300]">Network PRO · Moduli e prezzi</p>
          <p className="text-sm font-extrabold leading-5 text-[#173f35]">Acquista moduli</p>
          <p className="text-[11px] leading-4 text-[#5b5340]">Solo i moduli che ti servono</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <p className="whitespace-nowrap text-[#173f35]">
            <span className="text-[10px] text-[#5b5340]">da </span>
            <span className="text-lg font-extrabold tabular-nums">{startingMonthlyPrice} €</span>
            <span className="text-[10px] text-[#5b5340]">/mese</span>
          </p>
          <span className="text-xs font-extrabold text-[#175640] group-hover:underline">Configura →</span>
        </div>
        <span className="sr-only">Prezzi IVA esclusa · Produttori, Commercianti, Carpenterie e Utilizzatori · Italia o Europa</span>
      </Link>
    </section>
  );
}
