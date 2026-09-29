import Link from "next/link";

import { appRoutes } from "@/lib/routes";

const primary = [
  {
    href: appRoutes.commercial.search,
    eyebrow: "Ricerca",
    title: "Cerca nello storico",
    description: "Prodotti, clienti, RFQ, offerte, ordini e documenti in un unico punto.",
  },
  {
    href: appRoutes.commercial.products,
    eyebrow: "Product 360",
    title: "Prodotti",
    description: "Apri la vista prodotto con richieste, offerte, ordini, prezzi ed evidenze.",
  },
  {
    href: appRoutes.commercial.companies,
    eyebrow: "Company 360",
    title: "Aziende commerciali",
    description: "Consulta clienti, fornitori e storico delle relazioni private del workspace.",
  },
  {
    href: appRoutes.commercial.assistant,
    eyebrow: "AI",
    title: "Assistente",
    description: "Interroga la memoria commerciale mantenendo fonti, contesto e provenance.",
  },
];

const intelligence = [
  ["Commercial Explorer", appRoutes.commercial.explorer],
  ["Price Intelligence", appRoutes.commercial.priceIntelligence],
  ["Market Intelligence", appRoutes.commercial.marketIntelligence],
  ["Riattivazione", appRoutes.commercial.reengagement],
  ["Segnali di domanda", appRoutes.commercial.demand],
  ["Conversione", appRoutes.commercial.conversion],
] as const;

export default function CommercialHomePage() {
  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <section className="rounded-3xl border border-[#dce2df] bg-white p-6 shadow-[0_1px_2px_rgba(20,46,38,0.03)] sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.15em] text-[#173f35]">
          Commerciale
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#1d2824]">
          Memoria, ricerca e intelligence commerciale
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-[#66736e] sm:text-base">
          Tutto ciò che riguarda il lavoro commerciale privato della tua azienda resta qui:
          storico, prodotti, aziende, documenti, segnali e strumenti di analisi.
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {primary.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-2xl border border-[#dce2df] bg-[#f8faf9] p-5 transition hover:border-[#b8d2c8] hover:bg-[#f2f6f4]"
            >
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#173f35]">
                {item.eyebrow}
              </p>
              <h2 className="mt-2 font-semibold text-[#1d2824]">{item.title}</h2>
              <p className="mt-2 text-sm leading-6 text-[#66736e]">{item.description}</p>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-3">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#7b8782]">
            Intelligence
          </p>
          <h2 className="mt-1 text-xl font-semibold text-[#1d2824]">
            Analisi e segnali
          </h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {intelligence.map(([label, href]) => (
            <Link
              key={href}
              href={href}
              className="flex items-center justify-between rounded-2xl border border-[#dce2df] bg-white px-5 py-4 text-sm font-semibold text-[#43524c] transition hover:border-[#b8d2c8] hover:text-[#173f35]"
            >
              <span>{label}</span>
              <span aria-hidden="true">→</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
