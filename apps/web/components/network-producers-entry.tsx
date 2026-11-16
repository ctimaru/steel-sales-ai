import Link from "next/link";

/**
 * One visible and consistent entry point from Free and PRO Network.
 * This is navigation only: the destination checks producers/IT entitlement
 * server-side before returning any manufacturer data.
 */
export function NetworkProducersEntry(){
  return (
    <section
      aria-label="Intelligence Produttori"
      data-testid="network-producers-entry"
      className="flex min-w-0 flex-col gap-3 rounded-2xl border border-[#bddac7] bg-white px-3.5 py-3.5 shadow-[0_4px_18px_rgba(17,73,47,0.045)] sm:flex-row sm:items-center sm:justify-between sm:gap-5 sm:px-4"
    >
      <div className="flex min-w-0 items-start gap-3 sm:items-center">
        <span aria-hidden="true"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#eaf4ed] text-xl">🏭</span>
        <div className="min-w-0">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.08em] text-[#216247]">
            Network PRO · Produttori
          </p>
          <p className="mt-0.5 text-sm font-extrabold leading-5 text-[#173f30]">
            Intelligence Produttori
          </p>
          <p className="mt-0.5 text-xs leading-4 text-[#52695a]">
            Cerca e confronta produttori, cataloghi, norme e gamme con fonti ufficiali.
            <span className="ml-1 text-[#63786a]">Dati avanzati riservati al modulo Produttori.</span>
          </p>
        </div>
      </div>
      <Link href="/network/pro/producers"
        data-testid="network-producers-entry-link"
        className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#175640] px-4 text-xs font-bold text-white transition-colors hover:bg-[#0f4431] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#175640]"
      >
        Esplora produttori
        <span aria-hidden="true">→</span>
      </Link>
    </section>
  );
}
