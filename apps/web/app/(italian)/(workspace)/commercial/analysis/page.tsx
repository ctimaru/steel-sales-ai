import Link from "next/link";

import { appRoutes } from "@/lib/routes";

// COMM-UX1A: a task-oriented entry point, not seven more permanent tabs.
// Existing private engines, evidence links, roles and deep links are unchanged.
const analysisGroups = [
  {
    title: "Prezzi e prodotti",
    description: "Verifica prezzi realmente offerti e trova articoli comparabili nello storico.",
    links: [
      { label: "Storico prezzi", href: appRoutes.commercial.priceIntelligence, detail: "Offerte, date e provenienza" },
      { label: "Product 360", href: appRoutes.commercial.products, detail: "Prodotti, norme, misure e quantità" },
    ],
  },
  {
    title: "Mercato e domanda",
    description: "Consulta evidenze operative e indicatori senza confondere fonti esterne e prezzi privati.",
    links: [
      { label: "Indicatori di mercato", href: appRoutes.commercial.marketIntelligence, detail: "Serie esterne e relative fonti" },
      { label: "Commercial Explorer", href: appRoutes.commercial.explorer, detail: "Filtri per prodotti, norme e ruoli" },
      { label: "Segnali di domanda", href: appRoutes.commercial.demand, detail: "Segnali documentati dal workspace" },
    ],
  },
  {
    title: "Opportunità e relazioni",
    description: "Individua occasioni da approfondire, mantenendo l'utente responsabile delle azioni.",
    links: [
      { label: "Riattivazione clienti", href: appRoutes.commercial.reengagement, detail: "Clienti e trattative da riprendere" },
      { label: "Conversione", href: appRoutes.commercial.conversion, detail: "Richieste, offerte e ordini" },
      { label: "Relazioni tra conversazioni", href: appRoutes.commercial.crossThreadRelationships, detail: "Connessioni supportate dalle fonti" },
    ],
  },
] as const;

export default function CommercialAnalysisPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-5 pb-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#246c53]">Commerciale · Analisi</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#173f35]">Analisi per decidere</h1>
          <p className="mt-1 max-w-2xl text-sm leading-5 text-[#53665b]">
            Parti dalla domanda commerciale, poi apri lo strumento adatto. Fonti e autorizzazioni restano quelle dei dati originali.
          </p>
        </div>
        <Link href={appRoutes.commercial.home} className="inline-flex min-h-10 items-center rounded-lg border border-[#d1ded7] bg-white px-3 text-xs font-semibold text-[#173f35] hover:bg-[#f3f7f5]">
          ← Torna alle attività
        </Link>
      </header>
      <div className="grid gap-3 lg:grid-cols-3">
        {analysisGroups.map((group) => (
          <section key={group.title} className="min-w-0 rounded-xl border border-[#dce2df] bg-white p-4">
            <h2 className="text-base font-semibold text-[#173f35]">{group.title}</h2>
            <p className="mt-1 min-h-10 text-xs leading-5 text-[#53665b]">{group.description}</p>
            <ul className="mt-3 space-y-1.5">
              {group.links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="flex min-h-14 items-center justify-between gap-2 rounded-lg border border-[#e4ebe7] bg-[#f8faf9] px-3 py-2 transition hover:border-[#97bba9] hover:bg-[#edf5f0] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#246c53]">
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-[#173f35]">{link.label}</span>
                      <span className="block text-xs leading-4 text-[#5d6b64]">{link.detail}</span>
                    </span>
                    <span aria-hidden="true" className="shrink-0 text-[#246c53]">→</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      <p className="text-xs text-[#53665b]">L'analisi non invia offerte, non pubblica richieste nel Marketplace e non crea automaticamente relazioni CRM.</p>
    </div>
  );
}
