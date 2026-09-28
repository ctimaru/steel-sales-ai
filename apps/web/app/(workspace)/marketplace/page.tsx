import Link from "next/link";

import { appRoutes } from "@/lib/routes";

export const dynamic = "force-dynamic";

export default function MarketplaceHomePage() {
  return (
    <div className="mx-auto max-w-7xl space-y-7">
      <section className="overflow-hidden rounded-3xl border border-[#dce7f7] bg-white shadow-[0_1px_2px_rgba(30,43,69,0.025),0_12px_36px_rgba(30,43,69,0.035)]">
        <div className="h-1 bg-[#2f6fed]" />
        <div className="p-6 sm:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-[#eef5ff] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-[#2f6fed]">
                  Spazio condiviso
                </span>
                <span className="rounded-full bg-amber-50 px-3 py-1 text-[11px] font-semibold text-amber-700">
                  Prossima priorità
                </span>
              </div>
              <h1 className="mt-4 text-3xl font-semibold tracking-tight text-[#1e2b45] sm:text-4xl">
                Marketplace
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-[#68788e] sm:text-base">
                Qui nascerà il Demand Board comune di Steel Sales AI: richieste prodotto visibili o anonime,
                countdown e accesso controllato alle opportunità commerciali.
              </p>
            </div>
            <Link
              href={appRoutes.network.directory}
              className="inline-flex h-10 items-center justify-center rounded-xl border border-[#dbe5f1] bg-white px-4 text-sm font-semibold text-[#40516a] hover:border-[#bdd1f4] hover:bg-[#f3f7ff] hover:text-[#2f6fed]"
            >
              Esplora il Network
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          ["Richiesta prodotto", "Una domanda strutturata per prodotto, norma, grado, dimensioni, quantità e timing."],
          ["Visibile o anonima", "L'azienda potrà scegliere se mostrarsi nel Marketplace oppure proteggere la propria identità."],
          ["Countdown", "Ogni opportunità avrà una finestra temporale chiara per rendere la domanda azionabile."],
          ["Pay to see / unlock", "L'accesso ai dettagli commerciali sarà governato da entitlement e unlock, non da esposizione indiscriminata."],
        ].map(([title, description]) => (
          <article key={title} className="rounded-2xl border border-[#e1e8f2] bg-white p-5">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#2f6fed]">Marketplace foundation</p>
            <h2 className="mt-3 text-base font-semibold text-[#1e2b45]">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-[#68788e]">{description}</p>
          </article>
        ))}
      </section>

      <section className="rounded-2xl border border-dashed border-[#cbd8ea] bg-[#f8fbff] p-6">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#7f8da3]">Stato attuale</p>
        <h2 className="mt-2 text-lg font-semibold text-[#1e2b45]">La superficie è pronta; il workflow non è ancora attivo.</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[#68788e]">
          Nessuna richiesta viene pubblicata o sbloccata da questa pagina oggi. Il prossimo blocco di sviluppo
          costruirà il contratto operativo del Demand Board sopra Company Profile, Network e Steel Knowledge già esistenti.
        </p>
      </section>
    </div>
  );
}
