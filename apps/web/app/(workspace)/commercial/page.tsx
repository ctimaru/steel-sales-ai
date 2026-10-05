import { FocusHeader, FocusLink, FocusPage, FocusPanel } from "@/components/focus-ui";
import { appRoutes } from "@/lib/routes";

const secondary = [
  {
    href: appRoutes.commercial.products,
    title: "Prodotti",
    description: "Product 360 con richieste, offerte, ordini, prezzi ed evidenze.",
  },
  {
    href: appRoutes.commercial.companies,
    title: "Aziende commerciali",
    description: "Clienti, fornitori e storico delle relazioni private del workspace.",
  },
  {
    href: appRoutes.commercial.assistant,
    title: "Assistente",
    description: "Interroga la memoria commerciale mantenendo fonti e provenance.",
  },
] as const;

const intelligence = [
  ["Commercial Explorer", appRoutes.commercial.explorer],
  ["Price Intelligence", appRoutes.commercial.priceIntelligence],
  ["Market Intelligence", appRoutes.commercial.marketIntelligence],
  ["Riattivazione", appRoutes.commercial.reengagement],
  ["Segnali di domanda", appRoutes.commercial.demand],
  ["Conversione", appRoutes.commercial.conversion],
  ["Relazioni cross-thread", appRoutes.commercial.crossThreadRelationships],
] as const;

export default function CommercialHomePage() {
  return (
    <FocusPage>
      <FocusHeader
        eyebrow="Commerciale"
        title="Memoria, ricerca e intelligence commerciale"
        description="Parti dalla ricerca. Prodotti, aziende, documenti e intelligence restano strumenti di approfondimento, non punti d’ingresso concorrenti."
      />

      <FocusPanel>
        <p className="app-kicker">Azione principale</p>
        <FocusLink
          href={appRoutes.commercial.search}
          title="Cerca nello storico"
          description="Trova prodotto, cliente, RFQ, offerta, ordine o documento da un solo punto."
          primary
        />

        <div className="mt-5">
          <p className="mb-2 text-xs font-semibold text-[#66736e]">Approfondisci quando serve</p>
          <div className="grid gap-2 md:grid-cols-3">
            {secondary.map((item) => (
              <FocusLink key={item.href} {...item} />
            ))}
          </div>
        </div>
      </FocusPanel>

      <details className="rounded-2xl border border-[#dce2df] bg-white">
        <summary className="cursor-pointer list-none px-5 py-4 text-sm font-semibold text-[#43524c] hover:text-[#173f35]">
          Intelligence avanzata <span className="ml-1 text-xs font-normal text-[#7b8782]">· 7 strumenti</span>
        </summary>
        <div className="grid gap-2 border-t border-[#e7ece9] p-4 sm:grid-cols-2">
          {intelligence.map(([label, href]) => (
            <FocusLink key={href} href={href} title={label} />
          ))}
        </div>
      </details>
    </FocusPage>
  );
}
